import { PrismaClient } from "@prisma/client";

declare global {
  namespace globalThis {
    var prismadb: PrismaClient;
  }
}

console.log(process.env.NODE_ENV || "none");

const prisma = new PrismaClient();

if (process.env.NODE_ENV === "production") global.prismadb = prisma;

export default prisma;
