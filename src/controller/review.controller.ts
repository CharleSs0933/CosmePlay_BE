import { NextFunction, Request, Response } from "express";
import prisma from "../libs/prisma";
import { ValidationError } from "../packages/error-handler";

export const addProductReview = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;
    const { productId, reviewMessage, reviewValue } = req.body;

    if (!productId || !reviewMessage || !reviewValue) {
      return next(new ValidationError("Invalid data provided!"));
    }

    const order = await prisma.order.findFirst({
      where: {
        user_id: user.id,
        orderItems: {
          some: {
            product_id: productId,
          },
        },
      },
    });

    if (!order) {
      return next(new ValidationError("You need to purchase product first!"));
    }

    const checkExistingReview = await prisma.review.findFirst({
      where: {
        user_id: user.id,
        product_id: productId,
      },
    });

    if (checkExistingReview) {
      return next(new ValidationError("You already reviewed this product!"));
    }

    await prisma.review.create({
      data: {
        review_value: reviewMessage,
        review_message: reviewValue,
        user_id: user.id,
        product_id: productId,
        user_name: user.name,
      },
    });

    const reviews = await prisma.review.findMany({
      where: {
        product_id: productId,
      },
    });

    const totalReviewsLength = reviews.length;
    const averageReview =
      reviews.reduce((sum, reviewItem) => sum + reviewItem.review_value, 0) /
      totalReviewsLength;

    await prisma.product.update({
      where: {
        id: productId,
      },
      data: {
        rating: averageReview,
      },
    });

    res.status(200).json({ success: true, message: "Review added!" });
  } catch (error) {
    next(error);
  }
};

export const getProductReviews = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { productId } = req.params;

    const reviews = await prisma.review.findMany({
      where: {
        product_id: productId,
      },
    });

    res.status(200).json({ success: true, reviews });
  } catch (error) {
    next(error);
  }
};
