"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
console.log(process.env.NODE_ENV || "none");
const prisma = new client_1.PrismaClient();
if (process.env.NODE_ENV === "production")
    global.prismadb = prisma;
exports.default = prisma;
