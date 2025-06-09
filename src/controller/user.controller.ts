import { NextFunction, Request, Response } from "express";
import prisma from "../libs/prisma";
import { Prisma } from "@prisma/client";
import { ValidationError } from "../packages/error-handler";

export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { keyword, page = 1, limit = 10, role } = req.query;

    const pageNumber = parseInt(page as string, 10);
    const pageSize = parseInt(limit as string, 10) || 10;

    const filter: Prisma.UserWhereInput = {};
    if (keyword)
      filter.OR = [
        { name: { contains: keyword as string } },
        { email: { contains: keyword as string } },
      ];
    if (role) {
      if (role !== "ADMIN" && role !== "STAFF" && role !== "USER") {
        throw new ValidationError("Invalid role");
      }
      filter.role = role;
    }

    const { users, totalUsers } = await prisma.$transaction(async (tx) => {
      //   Get all users based on keyword and role
      const users = await tx.user.findMany({
        where: filter,
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        omit: {
          password: true,
        },
      });

      const totalUsers = await prisma.user.count({
        where: filter,
      });

      return { users, totalUsers };
    });

    res.status(200).json({
      success: true,
      users,
      pagination: {
        total: totalUsers,
        page: pageNumber,
        pageSize,
        totalPages: Math.ceil(totalUsers / pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      omit: {
        password: true,
      },
    });

    if (!user) {
      return next(new ValidationError("User not found!"));
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};
