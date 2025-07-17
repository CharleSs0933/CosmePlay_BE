import { Cart, CartLineItem, Product } from "@prisma/client";
import { NextFunction } from "express";
import prisma from "../libs/prisma";
import { ValidationError } from "../packages/error-handler";

export const checkBatchStock = async (
  cart: Cart & { cartItems: (CartLineItem & { product: Product })[] }
) => {
  for (const item of cart.cartItems) {
    const { id: productId, title } = item.product;
    const quantityNeeded = item.quantity;

    const batches = await prisma.batch.findMany({
      where: {
        product_id: productId,
        current_stock: { gt: 0 },
        expired_at: { gt: new Date() },
      },
    });

    const total = batches.reduce((sum, b) => sum + b.current_stock, 0);

    if (total < quantityNeeded) {
      throw new ValidationError(
        `Not enough stock for product "${title}". Required: ${quantityNeeded}, Available: ${total}`
      );
    }
  }
};
