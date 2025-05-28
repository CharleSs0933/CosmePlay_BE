import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();

declare global {
  namespace globalThis {
    var prismadb: PrismaClient;
  }
}

console.log(process.env.NODE_ENV || "none");

const prisma = new PrismaClient();

if (process.env.NODE_ENV === "production") global.prismadb = prisma;

export default prisma;
