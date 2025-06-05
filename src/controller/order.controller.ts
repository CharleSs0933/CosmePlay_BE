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
    const { shippingCost = 0, addressId } = req.body;

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

    const session = await stripe.checkout.sessions.create({
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
      success_url: `${process.env.CLIENT_BASE_URL}/checkout/successs`,
      cancel_url: `${process.env.CLIENT_BASE_URL}/checkout/failure`,
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

export const createOrder = async (
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

        const cardId = session.metadata?.cartId;
        const userId = session.metadata?.userId;
        const addressId = session.metadata?.addressId;

        if (!cardId || !userId || !addressId) {
          return next(new ValidationError("Missing metadata!"));
        }

        const cart = await prisma.cart.findUnique({
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
          return next(new ValidationError("Cart not found!"));
        }

        const order = await prisma.order.create({
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

        await prisma.cart.delete({
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
