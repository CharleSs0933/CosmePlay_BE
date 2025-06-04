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
exports.createCheckoutSession = void 0;
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
