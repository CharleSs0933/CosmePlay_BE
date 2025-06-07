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
exports.updateProductMeta = exports.addProductMeta = exports.updateProduct = exports.deleteProduct = exports.addProduct = exports.getProductMeta = exports.getProduct = exports.getAllProducts = void 0;
const prisma_1 = __importDefault(require("../libs/prisma"));
const error_handler_1 = require("../packages/error-handler");
const product_service_1 = require("../services/product.service");
const getAllProducts = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { sort, page = 1, limit = 10 } = req.query;
        const pageNumber = parseInt(page, 10);
        const pageSize = parseInt(limit, 10) || 10;
        const filters = (0, product_service_1.buildProductFilter)(req);
        const products = yield prisma_1.default.product.findMany({
            where: filters,
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
                productSkinType: {
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
const getProduct = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const product = yield prisma_1.default.product.findUnique({
            where: { id },
            include: {
                productCategory: { select: { title: true, description: true } },
                productBrand: { select: { title: true, description: true } },
                productSkinType: { select: { title: true, description: true } },
            },
        });
        if (!product) {
            return next(new error_handler_1.ValidationError("Product not found!"));
        }
        res.status(200).json({ success: true, product });
    }
    catch (error) {
        next(error);
    }
});
exports.getProduct = getProduct;
const getProductMeta = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const categories = yield tx.productCategory.findMany();
            const brands = yield tx.productBrand.findMany();
            const skinTypes = yield tx.productSkinType.findMany();
            return { categories, brands, skinTypes };
        }));
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
});
exports.getProductMeta = getProductMeta;
const addProduct = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        (0, product_service_1.validateProductData)(req.body);
        const { title, description, price, sale_price, image_url, total_stock, product_category_id, product_brand_id, product_skinType_id, } = req.body;
        const product = yield prisma_1.default.product.create({
            data: {
                title,
                description,
                price,
                sale_price,
                total_stock,
                image_url,
                product_category_id,
                product_brand_id,
                product_skinType_id,
            },
        });
        res.status(201).json({ success: true, product });
    }
    catch (error) {
        next(error);
    }
});
exports.addProduct = addProduct;
const deleteProduct = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const product = yield prisma_1.default.product.findUnique({ where: { id } });
        if (!product) {
            return next(new error_handler_1.ValidationError("Product not found!"));
        }
        yield prisma_1.default.product.delete({ where: { id } });
        res.status(200).json({ success: true, message: "Product deleted!" });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteProduct = deleteProduct;
const updateProduct = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const updateData = Object.assign({}, req.body);
        const product = yield prisma_1.default.product.findUnique({ where: { id } });
        if (!product) {
            return next(new error_handler_1.ValidationError("Product not found!"));
        }
        const updatedProduct = yield prisma_1.default.product.update({
            where: { id },
            data: Object.assign(Object.assign({}, updateData), { price: parseInt(updateData.price) || undefined, sale_price: parseInt(updateData.sale_price) || undefined, total_stock: parseInt(updateData.total_stock) || undefined }),
        });
        res.status(200).json({ success: true, product: updatedProduct });
    }
    catch (error) {
        next(error);
    }
});
exports.updateProduct = updateProduct;
const addProductMeta = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, description, type } = req.body;
        (0, product_service_1.validateProductMetaData)(req.body);
        switch (type) {
            case "category":
                const productCategory = yield prisma_1.default.productCategory.findUnique({
                    where: { title },
                });
                if (productCategory) {
                    return next(new error_handler_1.ValidationError("Product category already exists!"));
                }
                yield prisma_1.default.productCategory.create({ data: { title, description } });
                break;
            case "brand":
                yield prisma_1.default.productBrand.create({ data: { title, description } });
                break;
            case "skinType":
                yield prisma_1.default.productSkinType.create({ data: { title, description } });
                break;
            default:
                throw new error_handler_1.ValidationError("Invalid type!");
        }
        res.status(201).json({ success: true, message: `Product ${type} added!` });
    }
    catch (error) {
        next(error);
    }
});
exports.addProductMeta = addProductMeta;
const updateProductMeta = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { title, description, type } = req.body;
        (0, product_service_1.validateProductMetaData)(req.body);
        const productMeta = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            switch (type) {
                case "category":
                    return yield tx.productCategory.findUnique({ where: { id } });
                case "brand":
                    return yield tx.productBrand.findUnique({ where: { id } });
                case "skinType":
                    return yield tx.productSkinType.findUnique({ where: { id } });
                default:
                    throw new error_handler_1.ValidationError("Invalid type!");
            }
        }));
        if (!productMeta) {
            return next(new error_handler_1.ValidationError("Product meta not found!"));
        }
        yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            switch (type) {
                case "category":
                    const productCategory = yield tx.productCategory.findUnique({
                        where: { title },
                    });
                    if (productCategory) {
                        return next(new error_handler_1.ValidationError("Product category already exists!"));
                    }
                    yield tx.productCategory.update({
                        where: { id },
                        data: { title, description },
                    });
                    break;
                case "brand":
                    yield tx.productBrand.update({
                        where: { id },
                        data: { title, description },
                    });
                    break;
                case "skinType":
                    yield tx.productSkinType.update({
                        where: { id },
                        data: { title, description },
                    });
                    break;
                default:
                    throw new error_handler_1.ValidationError("Invalid type!");
            }
        }));
        res
            .status(200)
            .json({ success: true, message: `Product ${type} updated!` });
    }
    catch (error) {
        next(error);
    }
});
exports.updateProductMeta = updateProductMeta;
