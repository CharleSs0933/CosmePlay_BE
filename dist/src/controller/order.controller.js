"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrderDetail = exports.getOrdersByUser = exports.createOrder = exports.createCheckoutSession = void 0;
const prisma_1 = __importDefault(require("../libs/prisma"));
const error_handler_1 = require("../packages/error-handler");
const stripe_1 = __importDefault(require("../libs/stripe"));
const createCheckoutSession = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const { shippingCost = 0, addressId } = req.body;
        const cart = yield prisma_1.default.cart.findUnique({
            where: {
                user_id: user.id,
            },
            include: {
                cartItems: {
                    include: {
                        product: true,
                    },
                },
            },
        });
        if (!cart || cart.cartItems.length === 0) {
            return next(new error_handler_1.ValidationError("Cart is empty!"));
        }
        const address = yield prisma_1.default.address.findUnique({
            where: {
                id: addressId,
                user_id: user.id,
            },
        });
        if (!address) {
            return next(new error_handler_1.ValidationError("Address not found!"));
        }
        const session = yield stripe_1.default.checkout.sessions.create({
            mode: "payment",
            line_items: cart.cartItems.map((item) => ({
                price_data: {
                    currency: "VND",
                    product_data: {
                        name: item.product.title,
                        images: item.product.image_url ? [item.product.image_url] : [],
                    },
                    unit_amount: item.product.price,
                },
                quantity: item.quantity,
            })),
            success_url: `${process.env.CLIENT_BASE_URL}/success`,
            cancel_url: `${process.env.CLIENT_BASE_URL}/cancel`,
            customer_email: user.email,
            metadata: {
                cartId: cart.id,
                userId: user.id,
                addressId,
            },
            shipping_options: [
                {
                    shipping_rate_data: {
                        type: "fixed_amount",
                        fixed_amount: {
                            currency: "VND",
                            amount: shippingCost,
                        },
                        display_name: shippingCost === 0 ? "Free Shipping" : "Standard Shipping",
                        delivery_estimate: {
                            minimum: {
                                unit: "business_day",
                                value: 5,
                            },
                            maximum: {
                                unit: "business_day",
                                value: 7,
                            },
                        },
                    },
                },
            ],
        });
        if (!session.url) {
            return next(new error_handler_1.ValidationError("Failed to create checkout session!"));
        }
        res.status(200).json({ success: true, url: session.url });
    }
    catch (error) {
        next(error);
    }
});
exports.createCheckoutSession = createCheckoutSession;
const createOrder = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        const sig = req.headers["stripe-signature"];
        if (!sig) {
            return next(new error_handler_1.ValidationError("Missing Stripe signature!"));
        }
        const event = stripe_1.default.webhooks.constructEvent(req.body, sig, webhookSecret);
        switch (event.type) {
            case `checkout.session.completed`: {
                const session = event.data.object;
                const cardId = (_a = session.metadata) === null || _a === void 0 ? void 0 : _a.cartId;
                const userId = (_b = session.metadata) === null || _b === void 0 ? void 0 : _b.userId;
                const addressId = (_c = session.metadata) === null || _c === void 0 ? void 0 : _c.addressId;
                if (!cardId || !userId || !addressId) {
                    return next(new error_handler_1.ValidationError("Missing metadata!"));
                }
                const cart = yield prisma_1.default.cart.findUnique({
                    where: {
                        id: cardId,
                    },
                    include: {
                        cartItems: {
                            include: {
                                product: true,
                            },
                        },
                    },
                });
                if (!cart) {
                    return next(new error_handler_1.ValidationError("Cart not found!"));
                }
                const order = yield prisma_1.default.order.create({
                    data: {
                        user_id: userId,
                        checkout_session_id: session.id,
                        address_id: addressId,
                        total_amount: Number(session.amount_total),
                        payment_method: session.payment_method_types[0],
                        status: "PROCESSING",
                        orderItems: {
                            createMany: {
                                data: cart.cartItems.map((item) => ({
                                    product_id: item.product.id,
                                    quantity: item.quantity,
                                    title: item.product.title,
                                    price: item.product.price,
                                    image_url: item.product.image_url,
                                })),
                            },
                        },
                    },
                });
                yield prisma_1.default.cart.delete({
                    where: {
                        id: cardId,
                        user_id: userId,
                    },
                });
                break;
            }
            default: {
                console.log(`Unhandled event type: ${event.type}`);
                break;
            }
        }
        res.status(200).json({ success: true, message: "Order created!" });
    }
    catch (error) {
        next(error);
    }
});
exports.createOrder = createOrder;
const getOrdersByUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const orders = yield prisma_1.default.order.findMany({
            where: { user_id: user.id },
            include: { orderItems: true, address: true },
        });
        res.status(200).json({ success: true, orders });
    }
    catch (error) {
        next(error);
    }
});
exports.getOrdersByUser = getOrdersByUser;
const getOrderDetail = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const order = yield prisma_1.default.order.findUnique({
            where: { id },
            include: { orderItems: true, address: true },
        });
        if (!order) {
            return next(new error_handler_1.ValidationError("Order not found!"));
        }
        res.status(200).json({ success: true, order });
    }
    catch (error) {
        next(error);
    }
});
exports.getOrderDetail = getOrderDetail;
