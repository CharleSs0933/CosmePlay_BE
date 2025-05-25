"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
console.log(process.env.NODE_ENV || "none");
const prisma = new client_1.PrismaClient();
if (process.env.NODE_ENV === "production")
    global.prismadb = prisma;
exports.default = prisma;
