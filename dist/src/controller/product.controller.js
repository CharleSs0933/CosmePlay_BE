"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllProducts = void 0;
const prisma_1 = __importDefault(require("../libs/prisma"));
const getAllProducts = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { category, brand, sort, page = 1, limit = 10 } = req.query;
        const pageNumber = parseInt(page, 10);
        const pageSize = parseInt(limit, 10) || 10;
        const products = yield prisma_1.default.product.findMany({
            where: {
                productCategory: {
                    title: {
                        contains: category ? category : undefined,
                        mode: "insensitive",
                    },
                },
                productBrand: {
                    title: {
                        contains: brand ? brand : undefined,
                        mode: "insensitive",
                    },
                },
            },
            include: {
                productCategory: {
                    select: {
                        title: true,
                        description: true,
                    },
                },
                productBrand: {
                    select: {
                        title: true,
                        description: true,
                    },
                },
            },
        });
        const sorted = products.sort((a, b) => {
            var _a, _b;
            const priceA = (_a = a.sale_price) !== null && _a !== void 0 ? _a : a.price;
            const priceB = (_b = b.sale_price) !== null && _b !== void 0 ? _b : b.price;
            if (sort === "lowToHigh") {
                return priceA - priceB;
            }
            if (sort === "highToLow") {
                return priceB - priceA;
            }
            return 0;
        });
        const total = sorted.length;
        const paginatedProducts = sorted.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
        res.status(200).json({
            success: true,
            products: paginatedProducts,
            pagination: {
                total,
                page: pageNumber,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getAllProducts = getAllProducts;
