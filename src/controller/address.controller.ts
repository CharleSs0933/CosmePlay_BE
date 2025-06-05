import { NextFunction, Response } from "express";
import { ValidationError } from "../packages/error-handler";
import prisma from "../libs/prisma";
import { validateAddressData } from "../services/address.service";

export const addAddress = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;

    validateAddressData(req.body);

    await prisma.address.create({
      data: {
        ...req.body,
        user_id: user.id,
      },
    });

    res.status(201).json({ success: true, message: "Address added!" });
  } catch (error) {
    next(error);
  }
};

export const getAddressesByUser = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;
    const addresses = await prisma.address.findMany({
      where: { user_id: user.id },
    });

    res.status(200).json({ success: true, addresses });
  } catch (error) {
    next(error);
  }
};

export const updateAddress = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { address, city, pincode, phone, notes } = req.body;

    const addressToUpdate = await prisma.address.findUnique({
      where: { id, user_id: user.id },
    });

    if (!addressToUpdate) {
      return next(new ValidationError("Address not found!"));
    }

    await prisma.address.update({
      where: { id, user_id: user.id },
      data: {
        address,
        city,
        pincode,
        phone,
        notes,
      },
    });

    res.status(200).json({ success: true, message: "Address updated!" });
  } catch (error) {
    next(error);
  }
};

export const deleteAddress = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const addressToDelete = await prisma.address.findUnique({
      where: { id, user_id: user.id },
    });

    if (!addressToDelete) {
      return next(new ValidationError("Address not found!"));
    }

    await prisma.address.delete({ where: { id, user_id: user.id } });

    res.status(200).json({ success: true, message: "Address deleted!" });
  } catch (error) {
    next(error);
  }
};
