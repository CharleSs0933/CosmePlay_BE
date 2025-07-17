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
exports.checkBatchStock = void 0;
const prisma_1 = __importDefault(require("../libs/prisma"));
const error_handler_1 = require("../packages/error-handler");
const checkBatchStock = (cart) => __awaiter(void 0, void 0, void 0, function* () {
    for (const item of cart.cartItems) {
        const { id: productId, title } = item.product;
        const quantityNeeded = item.quantity;
        const batches = yield prisma_1.default.batch.findMany({
            where: {
                product_id: productId,
                current_stock: { gt: 0 },
                expired_at: { gt: new Date() },
            },
        });
        const total = batches.reduce((sum, b) => sum + b.current_stock, 0);
        if (total < quantityNeeded) {
            throw new error_handler_1.ValidationError(`Not enough stock for product "${title}". Required: ${quantityNeeded}, Available: ${total}`);
        }
    }
});
exports.checkBatchStock = checkBatchStock;
