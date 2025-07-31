import { NextFunction, Request, Response } from "express";
import prisma from "../libs/prisma";
import { validateVoucherTemplateData } from "../services/voucher.service";

export const getVouchersByUser = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;
    const vouchers = await prisma.voucher.findMany({
      where: {
        user_id: user.id,
      },
      include: {
        order: {
          select: {
            order_number: true,
            createdAt: true,
          },
        },
        voucherTemplate: {
          select: {
            type: true,
            discount_value: true,
            voucherProducts: {
              select: {
                product: true,
              },
            },
          },
        },
      },
    });
    res.status(200).json({ success: true, vouchers });
  } catch (error) {
    next(error);
  }
};

export const addVoucherTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { discount_value, type, productIds, user_limit } = req.body;

    // Validate input
    await validateVoucherTemplateData(req.body, next);

    await prisma.voucherTemplate.create({
      data: {
        discount_value,
        type,
        user_limit,
        voucherProducts: {
          create: productIds.map((productId: string) => ({
            product_id: productId,
          })),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAllVouchers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const vouchers = await prisma.voucher.findMany({
      include: {
        voucherTemplate: {
          include: {
            voucherProducts: {
              select: {
                product: {
                  select: {
                    id: true,
                    title: true,
                    price: true,
                    image_url: true,
                  },
                },
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        order: {
          select: {
            order_number: true,
            createdAt: true,
          },
        },
      },
    });

    res.status(200).json({ success: true, vouchers });
  } catch (error) {
    next(error);
  }
};
