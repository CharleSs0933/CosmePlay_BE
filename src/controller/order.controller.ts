import { NextFunction, Request, Response } from "express";
import prisma from "../libs/prisma";
import { ValidationError } from "../packages/error-handler";
import stripe from "../libs/stripe";
import Stripe from "stripe";

export const createCheckoutSession = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;
    const { shippingCost = 0, addressId, couponId, isMobile } = req.body;

    const cart = await prisma.cart.findUnique({
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
      return next(new ValidationError("Cart is empty!"));
    }

    const address = await prisma.address.findUnique({
      where: {
        id: addressId,
        user_id: user.id,
      },
    });

    if (!address) {
      return next(new ValidationError("Address not found!"));
    }

    if (couponId) {
      const coupon = await prisma.voucher.findUnique({
        where: {
          stripe_coupon_id: couponId,
        },
      });

      if (!coupon) {
        return next(new ValidationError("Coupon not found!"));
      }
    }

    let customer;
    const doesCustomerExist = await stripe.customers.list({
      email: user.email || `${user.name}@email.com`,
    });

    if (doesCustomerExist.data.length > 0) {
      customer = doesCustomerExist.data[0];
    } else {
      const newCustomer = await stripe.customers.create({
        name: user.username,
        email: user.email || `${user.username}@email.com`,
      });

      customer = newCustomer;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: cart.cartItems.map((item) => ({
        price_data: {
          currency: "VND",
          product_data: {
            name: item.product.title,
            images: item.product.image_url ? [item.product.image_url] : [],
          },
          unit_amount: item.product.sale_price
            ? item.product.sale_price
            : item.product.price,
        },
        quantity: item.quantity,
      })),
      discounts: [
        {
          coupon: couponId ? couponId : undefined,
        },
      ],
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
            display_name:
              shippingCost === 0 ? "Free Shipping" : "Standard Shipping",
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

        const cartId = session.metadata?.cartId;
        const userId = session.metadata?.userId;
        const addressId = session.metadata?.addressId;

        if (!cartId || !userId || !addressId) {
          return next(new ValidationError("Missing metadata!"));
        }

        const cart = await prisma.cart.findUnique({
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
          return next(new ValidationError("Cart not found!"));
        }

        await prisma.$transaction(async (tx) => {
          // 1. Create Order
          await tx.order.create({
            data: {
              user_id: userId,
              checkout_session_id: session.id,
              payment_intent_id: session.payment_intent as string,
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

          // 2. Decrement batch stock (FIFO)
          for (const item of cart.cartItems) {
            const productId = item.product.id;
            let quantityToDeduct = item.quantity;
            const twoWeeksFromNow = new Date();
            twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

            const batches = await tx.batch.findMany({
              where: {
                product_id: productId,
                current_stock: { gt: 0 },
                expired_at: {
                  gt: twoWeeksFromNow,
                },
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
              throw new Error(
                `Not enough stock in batches for product ${productId}`
              );
            }

            // 3. Update total stock (optional)
            await tx.product.update({
              where: { id: productId },
              data: {
                total_stock: { decrement: item.quantity },
              },
            });
          }

          // 4. Delete cart
          await tx.cart.delete({
            where: {
              id: cartId,
              user_id: userId,
            },
          });
        });
        if (session.discounts && session.discounts.length > 0) {
          const discount = session.discounts[0];

          // Kiểm tra chắc chắn coupon là string
          const couponId =
            typeof discount.coupon === "string" ? discount.coupon : null;

          if (couponId) {
            await prisma.voucher.update({
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
        const coupon = event.data.object as Stripe.Coupon;

        const userId = coupon.metadata?.userId;
        const eventId = coupon.metadata?.eventId;
        const eventRewardId = coupon.metadata?.eventRewardId;

        if (!userId || !eventId || !eventRewardId) {
          return next(new ValidationError("Missing metadata!"));
        }

        // Tính ngày hiện tại + 14 ngày
        const today = new Date();
        const twoWeeksLater = new Date();
        twoWeeksLater.setDate(today.getDate() + 14);

        // Truy vấn các sản phẩm có lô hàng sắp hết hạn (trong vòng 14 ngày)
        const expiringBatches = await prisma.batch.findMany({
          where: {
            expired_at: {
              lte: twoWeeksLater,
            },
            current_stock: {
              gt: 0,
            },
          },
          select: {
            product_id: true,
          },
          distinct: ["product_id"], // Đảm bảo không bị trùng
        });

        const expiringProductIds = expiringBatches.map((b) => b.product_id);

        // Bắt đầu transaction
        await prisma.$transaction(async (tx) => {
          // Tạo voucher kèm danh sách product_id áp dụng
          await tx.voucher.create({
            data: {
              user_id: userId,
              discount_value: coupon.percent_off
                ? coupon.percent_off!
                : coupon.amount_off!,
              type: coupon.percent_off ? "PERCENT" : "AMOUNT",
              stripe_coupon_id: coupon.id,
              event_reward_id: eventRewardId,
              products_id: expiringProductIds, // 💥 Gán danh sách sản phẩm áp dụng
            },
          });

          // Giảm số lượng voucher đã phân phát
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
