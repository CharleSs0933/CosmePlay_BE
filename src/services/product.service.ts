import { Prisma } from "@prisma/client";
import { Request } from "express";
import { ValidationError } from "../packages/error-handler";

export const buildProductFilter = (req: Request): Prisma.ProductWhereInput => {
  const { category, brand, skinType, title, sale } = req.query;

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
    sale_price: sale
      ? sale === "true"
        ? { not: null }
        : sale === "false"
        ? { equals: null }
        : undefined
      : undefined,
  };
};

export const validateProductData = (data: any) => {
  const {
    title,
    price,
    total_stock,
    product_category_id,
    product_brand_id,
    product_skinType_id,
  } = data;

  if (
    !title ||
    !price ||
    !total_stock ||
    !product_category_id ||
    !product_brand_id ||
    !product_skinType_id
  ) {
    throw new ValidationError("Missing required fields!");
  }
};

export const validateProductMetaData = (data: any) => {
  const { title, description, type } = data;

  if (!title || !description || !type) {
    throw new ValidationError("Missing required fields!");
  }

  if (type !== "category" && type !== "brand" && type !== "skinType") {
    throw new ValidationError("Invalid type!");
  }
};
