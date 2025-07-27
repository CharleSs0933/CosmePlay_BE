import { NextFunction, Request, Response } from "express";
import prisma from "../libs/prisma";
import { ValidationError } from "../packages/error-handler";
import stripe from "../libs/stripe";
import Stripe from "stripe";
import { checkBatchStock } from "../services/order.service";

export const createCheckoutSession = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;
    const { shippingCost = 0, addressId, couponId, isMobile } = req.body;

    // 1. Lấy giỏ hàng kèm sản phẩm
    const cart = await prisma.cart.findUnique({
      where: { user_id: user.id },
      include: {
        cartItems: {
          include: { product: true },
        },
      },
    });

    if (!cart || cart.cartItems.length === 0) {
      return next(new ValidationError("Cart is empty!"));
    }

    // 2. Kiểm tra địa chỉ giao hàng hợp lệ
    const address = await prisma.address.findUnique({
      where: {
        id: addressId,
        user_id: user.id,
      },
    });

    if (!address) {
      return next(new ValidationError("Address not found!"));
    }

    await checkBatchStock(cart);

    // 3. Kiểm tra mã giảm giá (nếu có)
    let validCoupon: string | undefined;

    if (couponId) {
      const coupon = await prisma.voucher.findUnique({
        where: { stripe_coupon_id: couponId },
        select: {
          voucherProducts: {
            select: { product_id: true },
          },
        },
      });

      if (!coupon) {
        return next(new ValidationError("Coupon not found!"));
      }

      const invalid = coupon.voucherProducts.some(
        (voucherItem) =>
          !cart.cartItems.some(
            (cartItem) => cartItem.product.id === voucherItem.product_id
          )
      );

      if (invalid) {
        return next(new ValidationError("Coupon not valid for your cart!"));
      }

      validCoupon = couponId;
    }

    // 4. Kiểm tra hoặc tạo Stripe customer
    const customerList = await stripe.customers.list({
      email: user.email || `${user.username}@email.com`,
      limit: 1,
    });

    let customer = customerList.data[0];
    if (!customer) {
      customer = await stripe.customers.create({
        name: user.username,
        email: user.email || `${user.username}@email.com`,
      });
    }

    // 5. Tạo phiên thanh toán Stripe
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: cart.cartItems.map((item) => ({
        price: item.product.stripe_price_id!,
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
        couponId: validCoupon ?? "",
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: {
              currency: "VND",
              amount: shippingCost,
            },
            display_name:
              shippingCost === 0 ? "Free Shipping" : "Standard Shipping",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 5 },
              maximum: { unit: "business_day", value: 7 },
            },
          },
        },
      ],
    });

    if (!session.url) {
      return next(new ValidationError("Failed to create checkout session!"));
    }

    res.status(200).json({ success: true, url: session.url });
  } catch (error) {
    next(error);
  }
};

export const stripeWebhooks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

    const sig = req.headers["stripe-signature"] as string;

    if (!sig) {
      return next(new ValidationError("Missing Stripe signature!"));
    }

    const event: Stripe.Event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      webhookSecret
    );

    switch (event.type) {
      case `checkout.session.completed`: {
        const session = event.data.object as Stripe.Checkout.Session;

        const { cartId, userId, addressId } = session.metadata ?? {};
        if (!cartId || !userId || !addressId) {
          return next(new ValidationError("Missing metadata!"));
        }

        // Lấy giỏ hàng và các sản phẩm liên quan
        const cart = await prisma.cart.findUnique({
          where: { id: cartId },
          include: {
            cartItems: {
              include: { product: true },
            },
          },
        });

        if (!cart) {
          return next(new ValidationError("Cart not found!"));
        }

        // Lấy thông tin sản phẩm từ Stripe session
        const lineItems = await stripe.checkout.sessions.listLineItems(
          session.id,
          {
            expand: ["data.price.product"],
          }
        );

        // Map thành dữ liệu order item để lưu vào DB
        const orderItemsData = lineItems.data.map((item) => {
          const stripeProduct = item.price!.product as Stripe.Product;
          const quantity = item.quantity ?? 1;
          const total = (item.amount_total ?? 0) / 100;
          const unitPrice = total / quantity;

          return {
            product_id: stripeProduct.metadata.local_product_id as string,
            quantity,
            title: stripeProduct.name,
            price: unitPrice * 100, // Lưu dưới dạng integer
            image_url: stripeProduct.images[0],
          };
        });

        // Tạo order + cập nhật tồn kho + xoá cart trong 1 transaction
        const { order } = await prisma.$transaction(async (tx) => {
          // 1. Tạo đơn hàng
          const order = await tx.order.create({
            data: {
              user_id: userId,
              checkout_session_id: session.id,
              payment_intent_id: session.payment_intent as string,
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

            const batches = await tx.batch.findMany({
              where: {
                product_id: productId,
                current_stock: { gt: 0 },
                expired_at: { gt: new Date() },
              },
              orderBy: { expired_at: "asc" },
            });

            for (const batch of batches) {
              if (quantityToDeduct <= 0) break;

              const deduct = Math.min(quantityToDeduct, batch.current_stock);

              await tx.batch.update({
                where: { id: batch.id },
                data: {
                  current_stock: { decrement: deduct },
                },
              });

              quantityToDeduct -= deduct;
            }

            if (quantityToDeduct > 0) {
              throw new ValidationError(
                `Not enough stock for product ${productId}`
              );
            }

            // 3. Cập nhật tổng tồn kho của sản phẩm
            await tx.product.update({
              where: { id: productId },
              data: {
                total_stock: { decrement: item.quantity },
              },
            });
          }

          // 4. Xoá giỏ hàng sau khi hoàn tất order
          await tx.cart.delete({
            where: {
              id: cartId,
              user_id: userId,
            },
          });

          return { order };
        });

        // 5. Đánh dấu voucher là đã sử dụng (nếu có)
        if (session.discounts?.length) {
          const discount = session.discounts[0];
          const couponId =
            typeof discount.coupon === "string" ? discount.coupon : null;

          if (couponId) {
            await prisma.voucher.update({
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
        const coupon = event.data.object as Stripe.Coupon;

        const userId = coupon.metadata?.userId;
        const eventId = coupon.metadata?.eventId;
        const eventRewardId = coupon.metadata?.eventRewardId;

        // Kiểm tra thông tin bắt buộc
        if (!userId || !eventId || !eventRewardId) {
          return next(new ValidationError("Missing metadata!"));
        }

        // Tính ngày hiện tại + 9 tháng
        const today = new Date();
        const nineMonthsLater = new Date();
        nineMonthsLater.setMonth(today.getMonth() + 9);

        // Truy vấn danh sách sản phẩm có lô sắp hết hạn (trong vòng 9 tháng)
        const expiringBatches = await prisma.batch.findMany({
          where: {
            expired_at: { lte: nineMonthsLater },
            current_stock: { gt: 0 },
          },
          select: { product_id: true },
          distinct: ["product_id"],
        });
        const expiringProductIds = expiringBatches.map((b) => b.product_id);

        // Lấy toàn bộ sản phẩm hợp lệ có stripe_product_id
        const validProducts = await prisma.product.findMany({
          where: {
            stripe_product_id: { not: null },
          },
          select: { id: true, stripe_product_id: true },
        });

        // Tách sản phẩm thành 2 nhóm: sắp hết hạn và còn lại
        const expiringValidProducts = validProducts.filter((p) =>
          expiringProductIds.includes(p.id)
        );
        const otherValidProducts = validProducts.filter(
          (p) => !expiringProductIds.includes(p.id)
        );

        // Hàm trộn ngẫu nhiên
        function shuffle<T>(array: T[]): T[] {
          return array.sort(() => Math.random() - 0.5);
        }

        // Lấy tối đa 5 sản phẩm ưu tiên từ nhóm sắp hết hạn
        let selectedProducts: typeof validProducts;
        if (expiringValidProducts.length >= 5) {
          selectedProducts = shuffle(expiringValidProducts).slice(0, 5);
        } else {
          const remaining = 5 - expiringValidProducts.length;
          selectedProducts = [
            ...expiringValidProducts,
            ...shuffle(otherValidProducts).slice(0, remaining),
          ];
        }

        // Lấy danh sách Stripe Product ID của các sản phẩm đã chọn
        const productIds = selectedProducts.map((p) => p.id);

        // Bắt đầu transaction để tạo voucher và cập nhật eventReward
        await prisma.$transaction(async (tx) => {
          // Tạo voucher
          await tx.voucher.create({
            data: {
              user_id: userId,
              discount_value: coupon.percent_off
                ? coupon.percent_off
                : coupon.amount_off!,
              type: coupon.percent_off ? "PERCENT" : "AMOUNT",
              stripe_coupon_id: coupon.id,
              event_reward_id: eventRewardId,
              ...(productIds.length > 0 && {
                voucherProducts: {
                  create: productIds.map((productId) => ({
                    product_id: productId,
                  })),
                },
              }),
            },
          });

          // Giảm số lượng voucher đã phát cho phần thưởng sự kiện
          await tx.eventReward.update({
            where: {
              id: eventRewardId,
            },
            data: {
              voucher_quantity: {
                decrement: 1,
              },
            },
          });
        });

        break;
      }

      default: {
        console.log(`Unhandled event type: ${event.type}`);
        break;
      }
    }

    res.status(200).json({ success: true, message: "Order created!" });
  } catch (error) {
    next(error);
  }
};

export const getOrdersByUser = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;

    const orders = await prisma.order.findMany({
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
  } catch (error) {
    next(error);
  }
};

export const getOrderDetail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
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
      return next(new ValidationError("Order not found!"));
    }

    res.status(200).json({ success: true, order });
  } catch (error) {
    next(error);
  }
};

export const getAllOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const orders = await prisma.order.findMany();

    res.status(200).json({ success: true, orders });
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (
      !status ||
      (status !== "PROCESSING" &&
        status !== "SHIPPED" &&
        status !== "DELIVERD" &&
        status !== "CANCELLED")
    ) {
      return next(new ValidationError("Status is invalid!"));
    }

    const order = await prisma.order.findUnique({ where: { id } });

    if (!order) {
      return next(new ValidationError("Order not found!"));
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status },
    });

    res.status(200).json({ success: true, order: updatedOrder });
  } catch (error) {
    next(error);
  }
};
