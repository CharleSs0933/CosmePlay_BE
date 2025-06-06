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
exports.getProductReviews = exports.addProductReview = void 0;
const prisma_1 = __importDefault(require("../libs/prisma"));
const error_handler_1 = require("../packages/error-handler");
const addProductReview = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const { productId, reviewMessage, reviewValue } = req.body;
        if (!productId || !reviewMessage || !reviewValue) {
            return next(new error_handler_1.ValidationError("Invalid data provided!"));
        }
        const order = yield prisma_1.default.order.findFirst({
            where: {
                user_id: user.id,
                orderItems: {
                    some: {
                        product_id: productId,
                    },
                },
            },
        });
        if (!order) {
            return next(new error_handler_1.ValidationError("You need to purchase product first!"));
        }
        const checkExistingReview = yield prisma_1.default.review.findFirst({
            where: {
                user_id: user.id,
                product_id: productId,
            },
        });
        if (checkExistingReview) {
            return next(new error_handler_1.ValidationError("You already reviewed this product!"));
        }
        yield prisma_1.default.review.create({
            data: {
                review_value: parseInt(reviewValue),
                review_message: reviewMessage,
                user_id: user.id,
                product_id: productId,
                user_name: user.name,
            },
        });
        const reviews = yield prisma_1.default.review.findMany({
            where: {
                product_id: productId,
            },
        });
        const totalReviewsLength = reviews.length;
        const averageReview = reviews.reduce((sum, reviewItem) => sum + reviewItem.review_value, 0) /
            totalReviewsLength;
        yield prisma_1.default.product.update({
            where: {
                id: productId,
            },
            data: {
                rating: averageReview,
            },
        });
        res.status(200).json({ success: true, message: "Review added!" });
    }
    catch (error) {
        next(error);
    }
});
exports.addProductReview = addProductReview;
const getProductReviews = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { productId } = req.params;
        const reviews = yield prisma_1.default.review.findMany({
            where: {
                product_id: productId,
            },
        });
        res.status(200).json({ success: true, reviews });
    }
    catch (error) {
        next(error);
    }
});
exports.getProductReviews = getProductReviews;
