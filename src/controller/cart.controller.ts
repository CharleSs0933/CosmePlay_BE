import { NextFunction, Request, Response } from "express";
import { ValidationError } from "../packages/error-handler";
import prisma from "../libs/prisma";

export const addToCart = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;
    const { productId, quantity } = req.body;

    if (!productId || !quantity || quantity <= 0 || !user) {
      return next(new ValidationError("Invalid data provided!"));
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return next(new ValidationError("Product not found!"));
    }

    let cart = await prisma.cart.findUnique({
      where: { user_id: user.id },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { user_id: user.id },
      });
    }

    const cartItem = await prisma.cartLineItem.findFirst({
      where: { product_id: productId, cart_id: cart.id },
    });

    if (cartItem) {
      await prisma.cartLineItem.update({
        where: { id: cartItem.id },
        data: { quantity: cartItem.quantity + quantity },
      });
    } else {
      await prisma.cartLineItem.create({
        data: { cart_id: cart.id, product_id: productId, quantity },
      });
    }

    res.status(200).json({ success: true, message: "Product added to cart!" });
  } catch (error) {
    next(error);
  }
};

export const getCart = async (req: any, res: Response, next: NextFunction) => {
  try {
    const user = req.user;

    let cart = await prisma.cart.findUnique({
      where: { user_id: user.id },
      include: {
        cartItems: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { user_id: user.id },
        include: {
          cartItems: {
            include: {
              product: true,
            },
          },
        },
      });
    }

    res.status(200).json({ success: true, cart });
  } catch (error) {
    next(error);
  }
};

export const updateCartItemQuantity = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;
    const { productId, quantity } = req.body;

    if (!productId || !quantity || quantity <= 0 || !user) {
      return next(new ValidationError("Invalid data provided!"));
    }

    const cart = await prisma.cart.findUnique({
      where: { user_id: user.id },
    });

    if (!cart) {
      return next(new ValidationError("Cart not found!"));
    }

    const cartItem = await prisma.cartLineItem.findFirst({
      where: { product_id: productId, cart_id: cart.id },
    });

    if (!cartItem) {
      return next(new ValidationError("Cart item not found!"));
    }

    await prisma.cartLineItem.update({
      where: { id: cartItem.id },
      data: { quantity },
    });

    res
      .status(200)
      .json({ success: true, message: "Cart item quantity updated!" });
  } catch (error) {
    next(error);
  }
};

export const deleteCartItem = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;
    const { productId } = req.params;

    if (!productId || !user) {
      return next(new ValidationError("Invalid data provided!"));
    }

    const cart = await prisma.cart.findUnique({
      where: { user_id: user.id },
    });

    if (!cart) {
      return next(new ValidationError("Cart not found!"));
    }

    const cartItem = await prisma.cartLineItem.findFirst({
      where: { product_id: productId, cart_id: cart.id },
    });

    if (!cartItem) {
      return next(new ValidationError("Cart item not found!"));
    }

    await prisma.cartLineItem.delete({
      where: { id: cartItem.id },
    });

    res.status(200).json({ success: true, message: "Cart item deleted!" });
  } catch (error) {
    next(error);
  }
};
