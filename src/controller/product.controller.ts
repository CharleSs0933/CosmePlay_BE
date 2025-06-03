import { NextFunction, Request, Response } from "express";
import prisma from "../libs/prisma";
import { ValidationError } from "../packages/error-handler";
import {
  buildProductFilter,
  validateProductData,
} from "../services/product.service";

export const getAllProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { sort, page = 1, limit = 10 } = req.query;

    const pageNumber = parseInt(page as string, 10);
    const pageSize = parseInt(limit as string, 10) || 10;

    const filters = buildProductFilter(req);

    const products = await prisma.product.findMany({
      where: filters,
      include: {
        productCategory: {
          select: {
            title: true,
            description: true,
          },
        },
        productBrand: {
          select: {
            title: true,
            description: true,
          },
        },
        productSkinType: {
          select: {
            title: true,
            description: true,
          },
        },
      },
    });

    const sorted = products.sort((a, b) => {
      const priceA = a.sale_price ?? a.price;
      const priceB = b.sale_price ?? b.price;

      if (sort === "lowToHigh") {
        return priceA - priceB;
      }
      if (sort === "highToLow") {
        return priceB - priceA;
      }
      return 0;
    });

    const total = sorted.length;
    const paginatedProducts = sorted.slice(
      (pageNumber - 1) * pageSize,
      pageNumber * pageSize
    );

    res.status(200).json({
      success: true,
      products: paginatedProducts,
      pagination: {
        total,
        page: pageNumber,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        productCategory: { select: { title: true, description: true } },
        productBrand: { select: { title: true, description: true } },
        productSkinType: { select: { title: true, description: true } },
      },
    });

    if (!product) {
      return next(new ValidationError("Product not found!"));
    }

    res.status(200).json({ success: true, product });
  } catch (error) {
    next(error);
  }
};

export const getProductMeta = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await prisma.$transaction(async (tx) => {
      const categories = await tx.productCategory.findMany();
      const brands = await tx.productBrand.findMany();
      const skinTypes = await tx.productSkinType.findMany();

      return { categories, brands, skinTypes };
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const addProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    validateProductData(req.body);

    const {
      title,
      description,
      price,
      sale_price,
      image_url,
      product_category_id,
      product_brand_id,
      product_skinType_id,
    } = req.body;

    const product = await prisma.product.create({
      data: {
        title,
        description,
        price,
        sale_price,
        image_url,
        product_category_id,
        product_brand_id,
        product_skinType_id,
      },
    });

    res.status(201).json({ success: true, product });
  } catch (error) {
    next(error);
  }
};
