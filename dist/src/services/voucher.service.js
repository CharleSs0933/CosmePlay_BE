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
exports.validateVoucherTemplateData = void 0;
const error_handler_1 = require("../packages/error-handler");
const prisma_1 = __importDefault(require("../libs/prisma"));
const validateVoucherTemplateData = (data, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { discount_value, type, productIds, user_limit } = data;
    // Validate input
    if (!discount_value || !type || !productIds || !user_limit) {
        return next(new error_handler_1.ValidationError("Missing required fields!"));
    }
    // Check if type is valid
    const validTypes = ["PERCENT", "AMOUNT"];
    if (!validTypes.includes(type)) {
        return next(new error_handler_1.ValidationError("Invalid voucher type!"));
    }
    // Check if productIds is an array and not empty
    if (!Array.isArray(productIds) || productIds.length === 0) {
        return next(new error_handler_1.ValidationError("Invalid product IDs!"));
    }
    // Check products exist
    const products = yield prisma_1.default.product.findMany({
        where: {
            id: {
                in: productIds,
            },
        },
    });
    if (products.length !== productIds.length) {
        return next(new error_handler_1.ValidationError("Some products do not exist!"));
    }
});
exports.validateVoucherTemplateData = validateVoucherTemplateData;
