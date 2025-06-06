import { NextFunction, Request, Response } from "express";
import prisma from "../libs/prisma";

export const getPost = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { category } = req.params;

    const post = prisma.post.findFirst({
      where: {
        category: {
          title: { equals: category, mode: "insensitive" },
        },
      },
    });

    res.status(200).json({ success: true, post });
  } catch (error) {
    next(error);
  }
};
