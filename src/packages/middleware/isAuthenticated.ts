import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "../../libs/prisma";

const isAuthenticated = async (req: any, res: Response, next: NextFunction) => {
  try {
    const token =
      req.cookies.access_token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      res.status(401).json({
        message: "Unauthorized! Token is missing.",
      });
      return;
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!) as {
      id: string;
      role: string;
    };

    if (!decoded) {
      res.status(401).json({
        message: "Unauthorized! Invalid token.",
      });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    req.user = user; // Attach user to request object

    if (!user) {
      res.status(401).json({
        message: "Unauthorized! User not found.",
      });
      return;
    }

    return next();
  } catch (error) {
    res.status(401).json({
      message: "Unauthorized! Token expired or invalid.",
    });
    return;
  }
};

export default isAuthenticated;
