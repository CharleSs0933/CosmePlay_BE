import { Request, Response } from "express";
import prisma from "../libs/prisma";

export const getAllSuppliers = async (req: Request, res: Response) => {
  try {
    const suppliers = await prisma.supplier.findMany({});
    res.status(200).json(suppliers);
  } catch (error) {
    console.error("Error fetching suppliers:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching suppliers." });
  }
};
