import { NextFunction, Request, Response } from "express";
import prisma from "../libs/prisma";
import { ValidationError } from "../packages/error-handler";
import {
  buildProductFilter,
  validateProductData,
  validateProductMetaData,
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
      total_stock,
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
        total_stock,
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

export const deleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({ where: { id } });

    if (!product) {
      return next(new ValidationError("Product not found!"));
    }

    await prisma.product.delete({ where: { id } });

    res.status(200).json({ success: true, message: "Product deleted!" });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const product = await prisma.product.findUnique({ where: { id } });

    if (!product) {
      return next(new ValidationError("Product not found!"));
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        ...updateData,
        price: parseInt(updateData.price) || undefined,
        sale_price: parseInt(updateData.sale_price) || undefined,
        total_stock: parseInt(updateData.total_stock) || undefined,
      },
    });

    res.status(200).json({ success: true, product: updatedProduct });
  } catch (error) {
    next(error);
  }
};

export const addProductMeta = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { title, description, type } = req.body;
    validateProductMetaData(req.body);

    switch (type) {
      case "category":
        const productCategory = await prisma.productCategory.findUnique({
          where: { title },
        });

        if (productCategory) {
          return next(new ValidationError("Product category already exists!"));
        }

        await prisma.productCategory.create({ data: { title, description } });
        break;
      case "brand":
        await prisma.productBrand.create({ data: { title, description } });
        break;
      case "skinType":
        await prisma.productSkinType.create({ data: { title, description } });
        break;
      default:
        throw new ValidationError("Invalid type!");
    }

    res.status(201).json({ success: true, message: `Product ${type} added!` });
  } catch (error) {
    next(error);
  }
};

export const updateProductMeta = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { title, description, type } = req.body;
    validateProductMetaData(req.body);

    const productMeta = await prisma.$transaction(async (tx) => {
      switch (type) {
        case "category":
          return await tx.productCategory.findUnique({ where: { id } });
        case "brand":
          return await tx.productBrand.findUnique({ where: { id } });
        case "skinType":
          return await tx.productSkinType.findUnique({ where: { id } });
        default:
          throw new ValidationError("Invalid type!");
      }
    });

    if (!productMeta) {
      return next(new ValidationError("Product meta not found!"));
    }

    await prisma.$transaction(async (tx) => {
      switch (type) {
        case "category":
          const productCategory = await tx.productCategory.findUnique({
            where: { title },
          });

          if (productCategory) {
            return next(
              new ValidationError("Product category already exists!")
            );
          }

          await tx.productCategory.update({
            where: { id },
            data: { title, description },
          });
          break;
        case "brand":
          await tx.productBrand.update({
            where: { id },
            data: { title, description },
          });
          break;
        case "skinType":
          await tx.productSkinType.update({
            where: { id },
            data: { title, description },
          });
          break;
        default:
          throw new ValidationError("Invalid type!");
      }
    });

    res
      .status(200)
      .json({ success: true, message: `Product ${type} updated!` });
  } catch (error) {
    next(error);
  }
};
