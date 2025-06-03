import { Prisma } from "@prisma/client";
import { Request } from "express";

export const buildProductFilter = (req: Request): Prisma.ProductWhereInput => {
  const { category, brand, skinType, title } = req.query;

  return {
    productCategory: category
      ? { title: { contains: category as string, mode: "insensitive" } }
      : undefined,
    productBrand: brand
      ? { title: { contains: brand as string, mode: "insensitive" } }
      : undefined,
    productSkinType: skinType
      ? { title: { contains: skinType as string, mode: "insensitive" } }
      : undefined,
    title: title
      ? { contains: title as string, mode: "insensitive" }
      : undefined,
  };
};
