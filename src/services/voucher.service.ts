import { NextFunction } from "express";
import { ValidationError } from "../packages/error-handler";
import prisma from "../libs/prisma";

export const validateVoucherTemplateData = async (
  data: any,
  next: NextFunction
) => {
  const { discount_value, type, productIds, user_limit } = data;

  // Validate input
  if (!discount_value || !type || !productIds || !user_limit) {
    return next(new ValidationError("Missing required fields!"));
  }

  // Check if type is valid
  const validTypes = ["PERCENT", "AMOUNT"];
  if (!validTypes.includes(type)) {
    return next(new ValidationError("Invalid voucher type!"));
  }

  // Check if productIds is an array and not empty
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return next(new ValidationError("Invalid product IDs!"));
  }

  // Check products exist
  const products = await prisma.product.findMany({
    where: {
      id: {
        in: productIds,
      },
    },
  });
  if (products.length !== productIds.length) {
    return next(new ValidationError("Some products do not exist!"));
  }
};
