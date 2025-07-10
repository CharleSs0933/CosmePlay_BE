"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildBatchFilter = exports.validateProductMetaData = exports.validateProductData = exports.buildProductFilter = void 0;
const error_handler_1 = require("../packages/error-handler");
const date_fns_1 = require("date-fns");
const buildProductFilter = (req) => {
    const { category, brand, skinType, title, sale } = req.query;
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
        sale_price: sale
            ? sale === "true"
                ? { not: null }
                : sale === "false"
                    ? { equals: null }
                    : undefined
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
const buildBatchFilter = (req) => {
    const { search, isExpired, month } = req.query;
    if (month && typeof month === "string") {
        const [year, monthStr] = month.split("-");
        const monthInt = parseInt(monthStr) - 1;
        const startDate = (0, date_fns_1.startOfMonth)(new Date(parseInt(year), monthInt));
        const endDate = (0, date_fns_1.endOfMonth)(new Date(parseInt(year), monthInt));
        return {
            product: {
                title: search
                    ? { contains: search, mode: "insensitive" }
                    : undefined,
            },
            expired_at: isExpired
                ? isExpired === "true"
                    ? { lte: new Date() }
                    : undefined
                : undefined,
            created_at: {
                gte: startDate,
                lte: endDate,
            },
        };
    }
    return {
        product: {
            title: search
                ? { contains: search, mode: "insensitive" }
                : undefined,
        },
        expired_at: isExpired
            ? isExpired === "true"
                ? { lte: new Date() }
                : undefined
            : undefined,
    };
};
exports.buildBatchFilter = buildBatchFilter;
