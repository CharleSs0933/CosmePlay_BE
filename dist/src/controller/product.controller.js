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
exports.getAllBatches = exports.getProductBatches = exports.addProductBatch = exports.deleteProductMeta = exports.updateProductMeta = exports.addProductMeta = exports.updateProduct = exports.deleteProduct = exports.addProduct = exports.getProductMeta = exports.getProduct = exports.getAllProducts = void 0;
const prisma_1 = __importDefault(require("../libs/prisma"));
const error_handler_1 = require("../packages/error-handler");
const product_service_1 = require("../services/product.service");
const stripe_1 = __importDefault(require("../libs/stripe"));
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
        // Validate input
        (0, product_service_1.validateProductData)(req.body);
        const { title, description, price, sale_price, volume, ingredients, volume_type, image_url, images, product_category_id, product_brand_id, product_skinType_id, } = req.body;
        // Tạo product code
        const productCode = `PROD-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 9)}`;
        // Step 1: Tạo product trong DB
        const product = yield prisma_1.default.product.create({
            data: {
                title,
                description,
                product_code: productCode,
                price,
                sale_price,
                image_url,
                images,
                volume,
                ingredients,
                volume_type,
                product_category_id,
                product_brand_id,
                product_skinType_id,
            },
        });
        // Step 2: Tạo product trong Stripe
        const stripeProduct = yield stripe_1.default.products.create({
            name: product.title,
            images: product.image_url ? [product.image_url] : [],
            metadata: {
                local_product_id: product.id,
            },
        });
        // Step 3: Tạo price trong Stripe
        const stripePrice = yield stripe_1.default.prices.create({
            unit_amount: product.sale_price || product.price, // dùng sale_price nếu có
            currency: "VND",
            product: stripeProduct.id,
        });
        // Step 4: Cập nhật product với stripe ids
        const updatedProduct = yield prisma_1.default.product.update({
            where: { id: product.id },
            data: {
                stripe_product_id: stripeProduct.id,
                stripe_price_id: stripePrice.id,
            },
        });
        // Step 5: Trả về sản phẩm đã cập nhật
        res.status(201).json({ success: true, product: updatedProduct });
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
        // Xóa sản phẩm trên Stripe nếu có liên kết
        if (product.stripe_product_id) {
            try {
                yield stripe_1.default.products.update(product.stripe_product_id, {
                    active: false, // Stripe không hỗ trợ xóa vĩnh viễn, chỉ ngừng sử dụng
                });
            }
            catch (stripeErr) {
                console.warn(`⚠️ Stripe product not found or already inactive: ${product.stripe_product_id}`);
            }
        }
        // Xóa khỏi database
        yield prisma_1.default.product.delete({ where: { id } });
        res
            .status(200)
            .json({ success: true, message: "Product deleted successfully!" });
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
        // Parse và gán giá mới nếu có
        const parsedPrice = updateData.price
            ? parseInt(updateData.price)
            : undefined;
        const parsedSalePrice = updateData.sale_price
            ? parseInt(updateData.sale_price)
            : undefined;
        const parsedVolume = updateData.volume
            ? parseInt(updateData.volume)
            : undefined;
        // Cập nhật thông tin sản phẩm trong Stripe nếu title hoặc image thay đổi
        if (product.stripe_product_id) {
            const titleChanged = updateData.title && updateData.title !== product.title;
            const imageChanged = updateData.image_url && updateData.image_url !== product.image_url;
            if (titleChanged || imageChanged) {
                yield stripe_1.default.products.update(product.stripe_product_id, {
                    name: updateData.title || product.title,
                    images: updateData.image_url
                        ? [updateData.image_url]
                        : product.image_url
                            ? [product.image_url]
                            : [],
                });
            }
        }
        // Nếu giá thay đổi thì tạo price mới
        const priceChanged = (parsedPrice && parsedPrice !== product.price) ||
            (parsedSalePrice && parsedSalePrice !== product.sale_price);
        let newStripePriceId = product.stripe_price_id;
        if (priceChanged && product.stripe_product_id) {
            const newStripePrice = yield stripe_1.default.prices.create({
                unit_amount: parsedSalePrice || parsedPrice || product.price,
                currency: "VND",
                product: product.stripe_product_id,
            });
            newStripePriceId = newStripePrice.id;
        }
        // Cập nhật DB
        const updatedProduct = yield prisma_1.default.product.update({
            where: { id },
            data: Object.assign(Object.assign({}, updateData), { price: parsedPrice, sale_price: parsedSalePrice, volume: parsedVolume, stripe_price_id: newStripePriceId }),
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
const deleteProductMeta = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const productMeta = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const category = yield tx.productCategory.findUnique({ where: { id } });
            const brand = yield tx.productBrand.findUnique({ where: { id } });
            const skinType = yield tx.productSkinType.findUnique({ where: { id } });
            return { category, brand, skinType };
        }));
        if (!productMeta) {
            return next(new error_handler_1.ValidationError("Product meta not found!"));
        }
        const products = yield prisma_1.default.product.findMany({
            where: {
                OR: [
                    { productCategory: { id } },
                    { productBrand: { id } },
                    { productSkinType: { id } },
                ],
            },
        });
        if (products.length > 0) {
            return next(new error_handler_1.ValidationError("Product meta is used in one or more products!"));
        }
        yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            if (productMeta.category) {
                yield tx.productCategory.delete({ where: { id } });
            }
            else if (productMeta.brand) {
                yield tx.productBrand.delete({ where: { id } });
            }
            else if (productMeta.skinType) {
                yield tx.productSkinType.delete({ where: { id } });
            }
        }));
        res.status(200).json({ success: true, message: "Product meta deleted!" });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteProductMeta = deleteProductMeta;
const addProductBatch = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const user = req.user;
        const { quantity, supplier_id } = req.body;
        if (!id || !quantity) {
            return next(new error_handler_1.ValidationError("Missing required fields!"));
        }
        const product = yield prisma_1.default.product.findUnique({
            where: { id },
        });
        if (!product) {
            return next(new error_handler_1.ValidationError("Product not found!"));
        }
        if (supplier_id) {
            const supplier = yield prisma_1.default.supplier.findUnique({
                where: { id: supplier_id },
            });
            if (!supplier) {
                return next(new error_handler_1.ValidationError("Supplier not found!"));
            }
        }
        yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            yield tx.batch.create({
                data: {
                    product_id: id,
                    quantity: parseInt(quantity),
                    current_stock: parseInt(quantity),
                    user_id: user.id,
                    supplier_id,
                    expired_at: new Date(new Date().setFullYear(new Date().getFullYear() + 2)),
                },
            });
            yield tx.product.update({
                where: { id },
                data: {
                    total_stock: {
                        increment: parseInt(quantity),
                    },
                },
            });
        }));
        res
            .status(201)
            .json({ success: true, message: "Batch added successfully!" });
    }
    catch (error) {
        next(error);
    }
});
exports.addProductBatch = addProductBatch;
const getProductBatches = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const batches = yield prisma_1.default.batch.findMany({
            where: { product_id: id },
            orderBy: { expired_at: "asc" },
            include: {
                supplier: true,
                product: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });
        if (batches.length === 0) {
            return next(new error_handler_1.ValidationError("No batches found for this product!"));
        }
        res.status(200).json({ success: true, batches });
    }
    catch (error) {
        next(error);
    }
});
exports.getProductBatches = getProductBatches;
const getAllBatches = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { page = 1, limit = 10 } = req.query;
        const pageNumber = parseInt(page, 10);
        const pageSize = parseInt(limit, 10) || 10;
        const filters = (0, product_service_1.buildBatchFilter)(req);
        const batches = yield prisma_1.default.batch.findMany({
            where: filters,
            include: {
                product: true,
                supplier: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            skip: (pageNumber - 1) * pageSize,
            take: pageSize,
            orderBy: { expired_at: "asc" },
        });
        const total = yield prisma_1.default.batch.count({ where: filters });
        res.status(200).json({
            success: true,
            batches,
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
exports.getAllBatches = getAllBatches;
