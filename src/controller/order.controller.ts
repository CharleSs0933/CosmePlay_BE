import { NextFunction, Request, Response } from "express";
import prisma from "../libs/prisma";
import { ValidationError } from "../packages/error-handler";
import stripe from "../libs/stripe";

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
