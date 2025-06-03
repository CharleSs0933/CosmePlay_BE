"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProductFilter = void 0;
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
