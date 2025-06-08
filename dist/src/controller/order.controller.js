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
exports.updateOrderStatus = exports.getAllOrders = exports.getOrderDetail = exports.getOrdersByUser = exports.stripeWebhooks = exports.createCheckoutSession = void 0;
const prisma_1 = __importDefault(require("../libs/prisma"));
const error_handler_1 = require("../packages/error-handler");
const stripe_1 = __importDefault(require("../libs/stripe"));
const createCheckoutSession = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const { shippingCost = 0, addressId, couponId } = req.body;
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
        if (couponId) {
            const coupon = yield prisma_1.default.voucher.findUnique({
                where: {
                    stripe_coupon_id: couponId,
                },
            });
            if (!coupon) {
                return next(new error_handler_1.ValidationError("Coupon not found!"));
            }
        }
        let customer;
        const doesCustomerExist = yield stripe_1.default.customers.list({
            email: user.email || `${user.name}@email.com`,
        });
        if (doesCustomerExist.data.length > 0) {
            customer = doesCustomerExist.data[0];
        }
        else {
            const newCustomer = yield stripe_1.default.customers.create({
                name: user.username,
                email: user.email || `${user.username}@email.com`,
            });
            customer = newCustomer;
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
            discounts: [
                {
                    coupon: couponId ? couponId : undefined,
                },
            ],
            success_url: `${process.env.CLIENT_BASE_URL}/checkout/successs`,
            cancel_url: `${process.env.CLIENT_BASE_URL}/checkout/failure`,
            customer: customer.id,
            metadata: {
                cartId: cart.id,
                userId: user.id,
                addressId,
                couponId,
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
const stripeWebhooks = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
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
                yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
                    // Create order
                    yield tx.order.create({
                        data: {
                            user_id: userId,
                            checkout_session_id: session.id,
                            payment_intent_id: session.payment_intent,
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
                    // Decrement stock
                    yield tx.product.updateMany({
                        where: {
                            id: {
                                in: cart.cartItems.map((item) => item.product.id),
                            },
                        },
                        data: {
                            total_stock: {
                                decrement: cart.cartItems.reduce((total, item) => total + item.quantity, 0),
                            },
                        },
                    });
                    // Delete cart
                    yield tx.cart.delete({
                        where: {
                            id: cardId,
                            user_id: userId,
                        },
                    });
                }));
                if (session.discounts && session.discounts.length > 0) {
                    const discount = session.discounts[0];
                    // Kiểm tra chắc chắn coupon là string
                    const couponId = typeof discount.coupon === "string" ? discount.coupon : null;
                    if (couponId) {
                        yield prisma_1.default.voucher.update({
                            where: {
                                stripe_coupon_id: couponId,
                            },
                            data: {
                                redeemed: true,
                                redeemed_at: new Date(),
                            },
                        });
                    }
                }
                break;
            }
            case `coupon.created`: {
                const coupon = event.data.object;
                const userId = (_d = coupon.metadata) === null || _d === void 0 ? void 0 : _d.userId;
                const eventId = (_e = coupon.metadata) === null || _e === void 0 ? void 0 : _e.eventId;
                const eventRewardId = (_f = coupon.metadata) === null || _f === void 0 ? void 0 : _f.eventRewardId;
                if (!userId || !eventId || !eventRewardId) {
                    return next(new error_handler_1.ValidationError("Missing metadata!"));
                }
                yield prisma_1.default.voucher.create({
                    data: {
                        user_id: userId,
                        discount_value: coupon.percent_off
                            ? coupon.percent_off
                            : coupon.amount_off,
                        type: coupon.percent_off ? "PERCENT" : "AMOUNT",
                        stripe_coupon_id: coupon.id,
                        event_reward_id: eventRewardId,
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
exports.stripeWebhooks = stripeWebhooks;
const getOrdersByUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const orders = yield prisma_1.default.order.findMany({
            where: { user_id: user.id },
            include: {
                orderItems: true,
                address: true,
                user: {
                    select: {
                        email: true,
                        name: true,
                    },
                },
            },
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
            include: {
                orderItems: true,
                address: true,
                user: {
                    select: {
                        email: true,
                        name: true,
                    },
                },
            },
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
const getAllOrders = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const orders = yield prisma_1.default.order.findMany();
        res.status(200).json({ success: true, orders });
    }
    catch (error) {
        next(error);
    }
});
exports.getAllOrders = getAllOrders;
const updateOrderStatus = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!status ||
            (status !== "PROCESSING" &&
                status !== "SHIPPED" &&
                status !== "DELIVERD" &&
                status !== "CANCELLED")) {
            return next(new error_handler_1.ValidationError("Status is invalid!"));
        }
        const order = yield prisma_1.default.order.findUnique({ where: { id } });
        if (!order) {
            return next(new error_handler_1.ValidationError("Order not found!"));
        }
        const updatedOrder = yield prisma_1.default.order.update({
            where: { id },
            data: { status },
        });
        res.status(200).json({ success: true, order: updatedOrder });
    }
    catch (error) {
        next(error);
    }
});
exports.updateOrderStatus = updateOrderStatus;
