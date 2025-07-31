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
exports.updateOrderStatus = exports.getAllOrders = exports.getOrderDetail = exports.getOrdersByUser = exports.cancelOrder = exports.stripeWebhooks = exports.createCheckoutSession = void 0;
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
                    voucherTemplate: {
                        select: {
                            voucherProducts: {
                                select: {
                                    product: {
                                        select: {
                                            id: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });
            if (!coupon) {
                return next(new error_handler_1.ValidationError("Coupon not found!"));
            }
            const voucherProductIds = new Set(coupon.voucherTemplate.voucherProducts.map((vp) => vp.product.id));
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
    var _a, _b, _c, _d, _e, _f, _g;
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
                let voucher = null;
                if ((_b = session.discounts) === null || _b === void 0 ? void 0 : _b.length) {
                    const discount = session.discounts[0];
                    const couponId = typeof discount.coupon === "string" ? discount.coupon : null;
                    if (couponId) {
                        voucher = yield prisma_1.default.voucher.findUnique({
                            where: { id: couponId },
                            include: {
                                voucherTemplate: true,
                            },
                        });
                    }
                }
                // Tính toán chi tiết giá cả
                const subtotal = cart.cartItems.reduce((sum, item) => {
                    const itemPrice = item.product.sale_price || item.product.price;
                    return sum + itemPrice * item.quantity;
                }, 0);
                // Tính discount amount từ Stripe session
                const discountAmount = ((_c = session.total_details) === null || _c === void 0 ? void 0 : _c.amount_discount) || 0;
                const shippingFee = ((_d = session.shipping_cost) === null || _d === void 0 ? void 0 : _d.amount_total) || 0;
                const totalAmount = session.amount_total || 0;
                // Tạo order number unique
                const orderNumber = `ORD-${Date.now()}-${Math.random()
                    .toString(36)
                    .substr(2, 9)}`;
                // Chuẩn bị dữ liệu OrderItems với thông tin chi tiết
                const orderItemsData = cart.cartItems.map((item) => {
                    const unitPrice = item.product.sale_price || item.product.price;
                    const discountPerItem = voucher
                        ? voucher.voucherTemplate.type === "PERCENT"
                            ? (unitPrice * voucher.voucherTemplate.discount_value) / 100
                            : voucher.voucherTemplate.discount_value / cart.cartItems.length
                        : 0;
                    const finalPrice = unitPrice - discountPerItem;
                    const totalPrice = finalPrice * item.quantity;
                    return {
                        product_id: item.product.id,
                        title: item.product.title,
                        image_url: item.product.image_url,
                        quantity: item.quantity,
                        unit_price: unitPrice,
                        discount_per_item: discountPerItem,
                        final_price: finalPrice,
                        total_price: totalPrice,
                    };
                });
                // Tạo order + cập nhật tồn kho + xoá cart trong 1 transaction
                const { order } = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
                    // 1. Tạo đơn hàng với thông tin đầy đủ
                    const order = yield tx.order.create({
                        data: {
                            order_number: orderNumber,
                            user_id: userId,
                            address_id: addressId,
                            status: "PROCESSING",
                            // Chi tiết các khoản tiền
                            subtotal: subtotal / 100, // Convert from cents to currency unit
                            discount_amount: discountAmount / 100,
                            shipping_fee: shippingFee / 100,
                            total_amount: totalAmount / 100,
                            // Thông tin thanh toán
                            checkout_session_id: session.id,
                            payment_intent_id: session.payment_intent,
                            payment_method: session.payment_method_types[0],
                            payment_status: "PAID",
                            // Thông tin voucher
                            voucher_id: voucher ? voucher.id : null,
                            // Tạo OrderItems
                            orderItems: {
                                createMany: {
                                    data: orderItemsData,
                                },
                            },
                        },
                        include: {
                            orderItems: true,
                        },
                    });
                    // 2. Trừ tồn kho theo lô (FIFO)
                    for (const item of cart.cartItems) {
                        const productId = item.product.id;
                        let quantityToDeduct = item.quantity;
                        // Lấy các batch còn hàng, sắp xếp theo ngày hết hạn (FIFO)
                        const batches = yield tx.batch.findMany({
                            where: {
                                product_id: productId,
                                current_stock: { gt: 0 },
                                expired_at: { gt: new Date() },
                            },
                            orderBy: { expired_at: "asc" },
                        });
                        // Trừ stock từng batch
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
                        // Kiểm tra còn thiếu hàng không
                        if (quantityToDeduct > 0) {
                            throw new error_handler_1.ValidationError(`Not enough stock for product ${item.product.title} (${productId}). Missing: ${quantityToDeduct} units`);
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
                if (voucher) {
                    yield prisma_1.default.voucher.update({
                        where: { id: voucher.id },
                        data: {
                            redeemed: true,
                            redeemed_at: new Date(),
                            order_id: order.id,
                        },
                    });
                }
                break;
            }
            case `coupon.created`: {
                const coupon = event.data.object;
                const userId = (_e = coupon.metadata) === null || _e === void 0 ? void 0 : _e.userId;
                const eventId = (_f = coupon.metadata) === null || _f === void 0 ? void 0 : _f.eventId;
                const eventRewardId = (_g = coupon.metadata) === null || _g === void 0 ? void 0 : _g.eventRewardId;
                // Kiểm tra thông tin bắt buộc
                if (!userId || !eventId || !eventRewardId) {
                    return next(new error_handler_1.ValidationError("Missing metadata!"));
                }
                // Tính ngày hiện tại + 9 tháng
                // const today = new Date();
                // const nineMonthsLater = new Date();
                // nineMonthsLater.setMonth(today.getMonth() + 9);
                // // Truy vấn danh sách sản phẩm có lô sắp hết hạn (trong vòng 9 tháng)
                // const expiringBatches = await prisma.batch.findMany({
                //   where: {
                //     expired_at: { lte: nineMonthsLater },
                //     current_stock: { gt: 0 },
                //   },
                //   select: { product_id: true },
                //   distinct: ["product_id"],
                // });
                // const expiringProductIds = expiringBatches.map((b) => b.product_id);
                // // Lấy toàn bộ sản phẩm hợp lệ có stripe_product_id
                // const validProducts = await prisma.product.findMany({
                //   where: {
                //     stripe_product_id: { not: null },
                //   },
                //   select: { id: true, stripe_product_id: true },
                // });
                // // Tách sản phẩm thành 2 nhóm: sắp hết hạn và còn lại
                // const expiringValidProducts = validProducts.filter((p) =>
                //   expiringProductIds.includes(p.id)
                // );
                // const otherValidProducts = validProducts.filter(
                //   (p) => !expiringProductIds.includes(p.id)
                // );
                // // Hàm trộn ngẫu nhiên
                // function shuffle<T>(array: T[]): T[] {
                //   return array.sort(() => Math.random() - 0.5);
                // }
                // // Lấy tối đa 5 sản phẩm ưu tiên từ nhóm sắp hết hạn
                // let selectedProducts: typeof validProducts;
                // if (expiringValidProducts.length >= 5) {
                //   selectedProducts = shuffle(expiringValidProducts).slice(0, 5);
                // } else {
                //   const remaining = 5 - expiringValidProducts.length;
                //   selectedProducts = [
                //     ...expiringValidProducts,
                //     ...shuffle(otherValidProducts).slice(0, remaining),
                //   ];
                // }
                // // Lấy danh sách Stripe Product ID của các sản phẩm đã chọn
                // const productIds = selectedProducts.map((p) => p.id);
                // // Bắt đầu transaction để tạo voucher và cập nhật eventReward
                // await prisma.$transaction(async (tx) => {
                //   // Tạo voucher
                //   await tx.voucher.create({
                //     data: {
                //       user_id: userId,
                //       discount_value: coupon.percent_off
                //         ? coupon.percent_off
                //         : coupon.amount_off!,
                //       type: coupon.percent_off ? "PERCENT" : "AMOUNT",
                //       stripe_coupon_id: coupon.id,
                //       event_reward_id: eventRewardId,
                //       ...(productIds.length > 0 && {
                //         voucherProducts: {
                //           create: productIds.map((productId) => ({
                //             product_id: productId,
                //           })),
                //         },
                //       }),
                //     },
                //   });
                //   // Giảm số lượng voucher đã phát cho phần thưởng sự kiện
                //   await tx.eventReward.update({
                //     where: {
                //       id: eventRewardId,
                //     },
                //     data: {
                //       voucher_quantity: {
                //         decrement: 1,
                //       },
                //     },
                //   });
                // });
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
const cancelOrder = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const user = req.user;
        const order = yield prisma_1.default.order.findUnique({ where: { id } });
        if (!order) {
            return next(new error_handler_1.ValidationError("Order not found!"));
        }
        if (order.user_id !== user.id) {
            return next(new error_handler_1.ValidationError("You are not allowed to cancel this order!"));
        }
        if (order.status !== "PROCESSING") {
            return next(new error_handler_1.ValidationError("You can only cancel orders that are processing!"));
        }
        yield stripe_1.default.refunds.create({
            payment_intent: order.payment_intent_id,
            reason: "requested_by_customer",
        });
        // Cập nhật trạng thái đơn hàng
        yield prisma_1.default.order.update({
            where: { id },
            data: { status: "CANCELLED", payment_status: "REFUNDED" },
        });
        res.status(200).json({
            success: true,
            message: "Order cancelled successfully! and refunded ",
        });
    }
    catch (error) {
        next(error);
    }
});
exports.cancelOrder = cancelOrder;
const getOrdersByUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const orders = yield prisma_1.default.order.findMany({
            where: { user_id: user.id },
            include: {
                orderItems: true,
                address: {
                    select: {
                        address: true,
                        city: true,
                        pincode: true,
                        phone: true,
                        full_name: true,
                    },
                },
                user: {
                    select: {
                        email: true,
                        name: true,
                    },
                },
                voucher: {
                    include: {
                        voucherTemplate: {
                            select: {
                                discount_value: true,
                                type: true,
                                voucherProducts: {
                                    select: {
                                        product: {
                                            select: {
                                                id: true,
                                                title: true,
                                                image_url: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
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
                        id: true,
                        email: true,
                        name: true,
                    },
                },
                voucher: {
                    include: {
                        voucherTemplate: {
                            select: {
                                discount_value: true,
                                type: true,
                                voucherProducts: {
                                    select: {
                                        product: {
                                            select: {
                                                id: true,
                                                title: true,
                                                image_url: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
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
        const orders = yield prisma_1.default.order.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                address: {
                    select: {
                        address: true,
                        city: true,
                        pincode: true,
                        phone: true,
                        full_name: true,
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
