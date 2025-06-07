"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateProductMetaData = exports.validateProductData = exports.buildProductFilter = void 0;
const error_handler_1 = require("../packages/error-handler");
const buildProductFilter = (req) => {
    const { category, brand, skinType, title } = req.query;
    return {
        productCategory: category
            ? { title: { contains: category, mode: "insensitive" } }
            : undefined,
        productBrand: brand
            ? { title: { contains: brand, mode: "insensitive" } }
            : undefined,
        productSkinType: skinType
            ? { title: { contains: skinType, mode: "insensitive" } }
            : undefined,
        title: title
            ? { contains: title, mode: "insensitive" }
            : undefined,
    };
};
exports.buildProductFilter = buildProductFilter;
const validateProductData = (data) => {
    const { title, price, total_stock, product_category_id, product_brand_id, product_skinType_id, } = data;
    if (!title ||
        !price ||
        !total_stock ||
        !product_category_id ||
        !product_brand_id ||
        !product_skinType_id) {
        throw new error_handler_1.ValidationError("Missing required fields!");
    }
};
exports.validateProductData = validateProductData;
const validateProductMetaData = (data) => {
    const { title, description, type } = data;
    if (!title || !description || !type) {
        throw new error_handler_1.ValidationError("Missing required fields!");
    }
    if (type !== "category" && type !== "brand" && type !== "skinType") {
        throw new error_handler_1.ValidationError("Invalid type!");
    }
};
exports.validateProductMetaData = validateProductMetaData;
