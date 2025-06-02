import { NextFunction, Request, Response } from "express";
import prisma from "../libs/prisma";
import { ValidationError } from "../packages/error-handler";

export const getAllProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { category, brand, sort, title, page = 1, limit = 10 } = req.query;

    const pageNumber = parseInt(page as string, 10);
    const pageSize = parseInt(limit as string, 10) || 10;

    const products = await prisma.product.findMany({
      where: {
        productCategory: {
          title: {
            contains: category ? (category as string) : undefined,
            mode: "insensitive",
          },
        },
        productBrand: {
          title: {
            contains: brand ? (brand as string) : undefined,
            mode: "insensitive",
          },
        },
        title: {
          contains: title ? (title as string) : undefined,
          mode: "insensitive",
        },
      },
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
  const { id } = req.params;
  const product = await prisma.product.findUnique({
    where: { id },
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
    },
  });

  if (!product) {
    return next(new ValidationError("Product not found!"));
  }

  res.status(200).json({ success: true, product });
};
