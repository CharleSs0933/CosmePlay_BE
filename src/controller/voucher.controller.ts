import { NextFunction, Request, Response } from "express";
import prisma from "../libs/prisma";

export const getVouchersByUser = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;
    const vouchers = await prisma.voucher.findMany({
      where: { user_id: user.id, redeemed: false },
    });
    res.status(200).json({ success: true, vouchers });
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
    const vouchers = await prisma.voucher.findMany({});

    res.status(200).json({ success: true, vouchers });
  } catch (error) {
    next(error);
  }
};
