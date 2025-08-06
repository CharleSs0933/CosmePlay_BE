import { NextFunction, Request, Response } from "express";
import prisma from "../libs/prisma";
import { Prisma } from "@prisma/client";
import { ValidationError } from "../packages/error-handler";
import bcrypt from "bcryptjs";

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

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, email, password, role, phone } = req.body;

    if (
      !name ||
      !email ||
      !password ||
      !role ||
      (role !== "ADMIN" && role !== "STAFF" && role !== "USER")
    ) {
      return next(new ValidationError("Invalid request!"));
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return next(new ValidationError("User already exists with this email!"));
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        role,
      },
      omit: {
        password: true,
      },
    });

    res.status(201).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { name, email, password, role, phone } = req.body;

    if (role && role !== "ADMIN" && role !== "STAFF" && role !== "USER") {
      return next(new ValidationError("Invalid role"));
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await prisma.user.update({
        where: { id },
        data: {
          password: hashedPassword,
        },
      });
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        role,
        phone,
      },
      omit: {
        password: true,
      },
    });

    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};
