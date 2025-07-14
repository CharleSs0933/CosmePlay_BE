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
        const { shippingCost = 0, addressId, couponId, isMobile } = req.body;
        // 1. Lấy giỏ hàng
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
        // 2. Kiểm tra địa chỉ giao hàng
        const address = yield prisma_1.default.address.findUnique({
            where: {
                id: addressId,
                user_id: user.id,
            },
        });
        if (!address) {
            return next(new error_handler_1.ValidationError("Address not found!"));
        }
        // 3. Kiểm tra hợp lệ mã giảm giá
        let validCoupon = undefined;
        if (couponId) {
            const coupon = yield prisma_1.default.voucher.findUnique({
                where: {
                    stripe_coupon_id: couponId,
                },
            });
            if (!coupon) {
                return next(new error_handler_1.ValidationError("Coupon not found!"));
            }
            validCoupon = couponId;
        }
        // 4. Kiểm tra hoặc tạo customer trong Stripe
        const customerList = yield stripe_1.default.customers.list({
            email: user.email || `${user.username}@email.com`,
            limit: 1,
        });
        let customer = customerList.data[0];
        if (!customer) {
            customer = yield stripe_1.default.customers.create({
                name: user.username,
                email: user.email || `${user.username}@email.com`,
            });
        }
        // 5. Tạo phiên thanh toán
        const session = yield stripe_1.default.checkout.sessions.create(Object.assign(Object.assign({ mode: "payment", line_items: cart.cartItems.map((item) => ({
                price: item.product.stripe_price_id,
                quantity: item.quantity,
            })) }, (validCoupon && {
            discounts: [
                {
                    coupon: validCoupon,
                },
            ],
        })), { success_url: isMobile
                ? `${process.env.MOBILE_CLIENT_BASE_URL}?path=/Success`
                : `${process.env.CLIENT_BASE_URL}/checkout/success`, cancel_url: isMobile
                ? `${process.env.MOBILE_CLIENT_BASE_URL}?path=/Failure`
                : `${process.env.CLIENT_BASE_URL}/checkout/failure`, customer: customer.id, metadata: {
                cartId: cart.id,
                userId: user.id,
                addressId,
                couponId: validCoupon || "",
            }, shipping_options: [
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
            ] }));
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
                const cartId = (_a = session.metadata) === null || _a === void 0 ? void 0 : _a.cartId;
                const userId = (_b = session.metadata) === null || _b === void 0 ? void 0 : _b.userId;
                const addressId = (_c = session.metadata) === null || _c === void 0 ? void 0 : _c.addressId;
                if (!cartId || !userId || !addressId) {
                    return next(new error_handler_1.ValidationError("Missing metadata!"));
                }
                const cart = yield prisma_1.default.cart.findUnique({
                    where: {
                        id: cartId,
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
                // Lấy danh sách sản phẩm từ session
                const lineItems = yield stripe_1.default.checkout.sessions.listLineItems(session.id, {
                    expand: ["data.price.product"],
                });
                // Duyệt từng item, truy vấn product từ DB bằng stripe_product_id
                const orderItemsData = lineItems.data.map((item) => {
                    var _a, _b;
                    const stripeProduct = item.price.product;
                    const quantity = (_a = item.quantity) !== null && _a !== void 0 ? _a : 1;
                    const total = ((_b = item.amount_total) !== null && _b !== void 0 ? _b : 0) / 100;
                    const unitPrice = total / quantity;
                    return {
                        product_id: stripeProduct.metadata.local_product_id,
                        quantity,
                        title: stripeProduct.name,
                        price: unitPrice * 100,
                        image_url: stripeProduct.images[0],
                    };
                });
                const { order } = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
                    // 1. Create Order
                    const order = yield tx.order.create({
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
                                    data: 
                                    // cart.cartItems.map((item) => ({
                                    //   product_id: item.product.id,
                                    //   quantity: item.quantity,
                                    //   title: item.product.title,
                                    //   price: item.product.sale_price || item.product.price,
                                    //   image_url: item.product.image_url,
                                    // })),
                                    orderItemsData,
                                },
                            },
                        },
                    });
                    // 2. Decrement batch stock (FIFO)
                    for (const item of cart.cartItems) {
                        const productId = item.product.id;
                        let quantityToDeduct = item.quantity;
                        const batches = yield tx.batch.findMany({
                            where: {
                                product_id: productId,
                                current_stock: { gt: 0 },
                                expired_at: {
                                    gt: new Date(),
                                },
                            },
                            orderBy: { expired_at: "asc" },
                        });
                        for (const batch of batches) {
                            if (quantityToDeduct <= 0)
                                break;
                            const deduct = Math.min(quantityToDeduct, batch.current_stock);
                            yield tx.batch.update({
                                where: { id: batch.id },
                                data: {
                                    current_stock: { decrement: deduct },
                                },
                            });
                            quantityToDeduct -= deduct;
                        }
                        if (quantityToDeduct > 0) {
                            throw new Error(`Not enough stock in batches for product ${productId}`);
                        }
                        // 3. Update total stock (optional)
                        yield tx.product.update({
                            where: { id: productId },
                            data: {
                                total_stock: { decrement: item.quantity },
                            },
                        });
                    }
                    // 4. Delete cart
                    yield tx.cart.delete({
                        where: {
                            id: cartId,
                            user_id: userId,
                        },
                    });
                    return { order };
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
                                order_id: order.id,
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
                // Tính ngày hiện tại + 14 ngày
                const today = new Date();
                const twoWeeksLater = new Date();
                twoWeeksLater.setDate(today.getDate() + 14);
                // Truy vấn các sản phẩm có lô hàng sắp hết hạn (trong vòng 14 ngày)
                const expiringBatches = yield prisma_1.default.batch.findMany({
                    where: {
                        expired_at: { lte: twoWeeksLater },
                        current_stock: { gt: 0 },
                    },
                    select: { product_id: true },
                    distinct: ["product_id"],
                });
                const expiringProductIds = expiringBatches.map((b) => b.product_id);
                // Bắt đầu transaction
                yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
                    // Tạo voucher kèm danh sách product_id áp dụng
                    yield tx.voucher.create({
                        data: Object.assign({ user_id: userId, discount_value: coupon.percent_off
                                ? coupon.percent_off
                                : coupon.amount_off, type: coupon.percent_off ? "PERCENT" : "AMOUNT", stripe_coupon_id: coupon.id, event_reward_id: eventRewardId }, (expiringProductIds.length > 0 && {
                            voucherProducts: {
                                create: expiringProductIds.map((productId) => ({
                                    product_id: productId,
                                })),
                            },
                        })),
                    });
                    // Giảm số lượng voucher đã phân phát
                    yield tx.eventReward.update({
                        where: {
                            id: eventRewardId,
                        },
                        data: {
                            voucher_quantity: {
                                decrement: 1,
                            },
                        },
                    });
                }));
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
                voucher: true,
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
                voucher: true,
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
