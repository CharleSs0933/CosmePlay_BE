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
const order_service_1 = require("../services/order.service");
const createCheckoutSession = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const { shippingCost = 0, addressId, couponId, isMobile } = req.body;
        // 1. Lấy giỏ hàng kèm sản phẩm
        const cart = yield prisma_1.default.cart.findUnique({
            where: { user_id: user.id },
            include: {
                cartItems: {
                    include: { product: true },
                },
            },
        });
        if (!cart || cart.cartItems.length === 0) {
            return next(new error_handler_1.ValidationError("Cart is empty!"));
        }
        // 2. Kiểm tra địa chỉ giao hàng hợp lệ
        const address = yield prisma_1.default.address.findUnique({
            where: {
                id: addressId,
                user_id: user.id,
            },
        });
        if (!address) {
            return next(new error_handler_1.ValidationError("Address not found!"));
        }
        yield (0, order_service_1.checkBatchStock)(cart);
        // 3. Kiểm tra mã giảm giá (nếu có)
        let validCoupon;
        if (couponId) {
            const coupon = yield prisma_1.default.voucher.findUnique({
                where: { stripe_coupon_id: couponId },
                select: {
                    voucherProducts: {
                        select: { product_id: true },
                    },
                },
            });
            if (!coupon) {
                return next(new error_handler_1.ValidationError("Coupon not found!"));
            }
            const voucherProductIds = new Set(coupon.voucherProducts.map((vp) => vp.product_id));
            // Kiểm tra xem có ít nhất 1 sản phẩm trong giỏ hàng thuộc danh sách voucher
            const hasValidProduct = cart.cartItems.some((item) => voucherProductIds.has(item.product.id));
            if (!hasValidProduct) {
                return next(new error_handler_1.ValidationError("Coupon not valid for your cart!"));
            }
            validCoupon = couponId;
        }
        // 4. Kiểm tra hoặc tạo Stripe customer
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
        // 5. Tạo phiên thanh toán Stripe
        const session = yield stripe_1.default.checkout.sessions.create({
            mode: "payment",
            line_items: cart.cartItems.map((item) => ({
                price: item.product.stripe_price_id,
                quantity: item.quantity,
            })),
            discounts: validCoupon
                ? [
                    {
                        coupon: validCoupon,
                    },
                ]
                : undefined,
            success_url: isMobile
                ? `${process.env.MOBILE_CLIENT_BASE_URL}?path=/Success`
                : `${process.env.CLIENT_BASE_URL}/checkout/success`,
            cancel_url: isMobile
                ? `${process.env.MOBILE_CLIENT_BASE_URL}?path=/Failure`
                : `${process.env.CLIENT_BASE_URL}/checkout/failure`,
            customer: customer.id,
            metadata: {
                cartId: cart.id,
                userId: user.id,
                addressId,
                couponId: validCoupon !== null && validCoupon !== void 0 ? validCoupon : "",
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
                            minimum: { unit: "business_day", value: 5 },
                            maximum: { unit: "business_day", value: 7 },
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
    var _a, _b, _c, _d, _e;
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
                const { cartId, userId, addressId } = (_a = session.metadata) !== null && _a !== void 0 ? _a : {};
                if (!cartId || !userId || !addressId) {
                    return next(new error_handler_1.ValidationError("Missing metadata!"));
                }
                // Lấy giỏ hàng và các sản phẩm liên quan
                const cart = yield prisma_1.default.cart.findUnique({
                    where: { id: cartId },
                    include: {
                        cartItems: {
                            include: { product: true },
                        },
                    },
                });
                if (!cart) {
                    return next(new error_handler_1.ValidationError("Cart not found!"));
                }
                // Lấy thông tin sản phẩm từ Stripe session
                const lineItems = yield stripe_1.default.checkout.sessions.listLineItems(session.id, {
                    expand: ["data.price.product"],
                });
                // Map thành dữ liệu order item để lưu vào DB
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
                        price: unitPrice * 100, // Lưu dưới dạng integer
                        image_url: stripeProduct.images[0],
                    };
                });
                // Tạo order + cập nhật tồn kho + xoá cart trong 1 transaction
                const { order } = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
                    // 1. Tạo đơn hàng
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
                                createMany: { data: orderItemsData },
                            },
                        },
                    });
                    // 2. Trừ tồn kho theo lô (FIFO)
                    for (const item of cart.cartItems) {
                        const productId = item.product.id;
                        let quantityToDeduct = item.quantity;
                        const batches = yield tx.batch.findMany({
                            where: {
                                product_id: productId,
                                current_stock: { gt: 0 },
                                expired_at: { gt: new Date() },
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
                            throw new error_handler_1.ValidationError(`Not enough stock for product ${productId}`);
                        }
                        // 3. Cập nhật tổng tồn kho của sản phẩm
                        yield tx.product.update({
                            where: { id: productId },
                            data: {
                                total_stock: { decrement: item.quantity },
                            },
                        });
                    }
                    // 4. Xoá giỏ hàng sau khi hoàn tất order
                    yield tx.cart.delete({
                        where: {
                            id: cartId,
                            user_id: userId,
                        },
                    });
                    return { order };
                }));
                // 5. Đánh dấu voucher là đã sử dụng (nếu có)
                if ((_b = session.discounts) === null || _b === void 0 ? void 0 : _b.length) {
                    const discount = session.discounts[0];
                    const couponId = typeof discount.coupon === "string" ? discount.coupon : null;
                    if (couponId) {
                        yield prisma_1.default.voucher.update({
                            where: { stripe_coupon_id: couponId },
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
                const userId = (_c = coupon.metadata) === null || _c === void 0 ? void 0 : _c.userId;
                const eventId = (_d = coupon.metadata) === null || _d === void 0 ? void 0 : _d.eventId;
                const eventRewardId = (_e = coupon.metadata) === null || _e === void 0 ? void 0 : _e.eventRewardId;
                // Kiểm tra thông tin bắt buộc
                if (!userId || !eventId || !eventRewardId) {
                    return next(new error_handler_1.ValidationError("Missing metadata!"));
                }
                // Tính ngày hiện tại + 9 tháng
                const today = new Date();
                const nineMonthsLater = new Date();
                nineMonthsLater.setMonth(today.getMonth() + 9);
                // Truy vấn danh sách sản phẩm có lô sắp hết hạn (trong vòng 9 tháng)
                const expiringBatches = yield prisma_1.default.batch.findMany({
                    where: {
                        expired_at: { lte: nineMonthsLater },
                        current_stock: { gt: 0 },
                    },
                    select: { product_id: true },
                    distinct: ["product_id"],
                });
                const expiringProductIds = expiringBatches.map((b) => b.product_id);
                // Lấy toàn bộ sản phẩm hợp lệ có stripe_product_id
                const validProducts = yield prisma_1.default.product.findMany({
                    where: {
                        stripe_product_id: { not: null },
                    },
                    select: { id: true, stripe_product_id: true },
                });
                // Tách sản phẩm thành 2 nhóm: sắp hết hạn và còn lại
                const expiringValidProducts = validProducts.filter((p) => expiringProductIds.includes(p.id));
                const otherValidProducts = validProducts.filter((p) => !expiringProductIds.includes(p.id));
                // Hàm trộn ngẫu nhiên
                function shuffle(array) {
                    return array.sort(() => Math.random() - 0.5);
                }
                // Lấy tối đa 5 sản phẩm ưu tiên từ nhóm sắp hết hạn
                let selectedProducts;
                if (expiringValidProducts.length >= 5) {
                    selectedProducts = shuffle(expiringValidProducts).slice(0, 5);
                }
                else {
                    const remaining = 5 - expiringValidProducts.length;
                    selectedProducts = [
                        ...expiringValidProducts,
                        ...shuffle(otherValidProducts).slice(0, remaining),
                    ];
                }
                // Lấy danh sách Stripe Product ID của các sản phẩm đã chọn
                const productIds = selectedProducts.map((p) => p.id);
                // Bắt đầu transaction để tạo voucher và cập nhật eventReward
                yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
                    // Tạo voucher
                    yield tx.voucher.create({
                        data: Object.assign({ user_id: userId, discount_value: coupon.percent_off
                                ? coupon.percent_off
                                : coupon.amount_off, type: coupon.percent_off ? "PERCENT" : "AMOUNT", stripe_coupon_id: coupon.id, event_reward_id: eventRewardId }, (productIds.length > 0 && {
                            voucherProducts: {
                                create: productIds.map((productId) => ({
                                    product_id: productId,
                                })),
                            },
                        })),
                    });
                    // Giảm số lượng voucher đã phát cho phần thưởng sự kiện
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
