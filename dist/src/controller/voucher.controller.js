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
exports.getAllVouchers = exports.getVouchersByUser = void 0;
const prisma_1 = __importDefault(require("../libs/prisma"));
const getVouchersByUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const vouchers = yield prisma_1.default.voucher.findMany({
            where: { user_id: user.id, redeemed: false },
            include: {
                voucherProducts: {
                    select: {
                        product: true,
                    },
                },
            },
        });
        res.status(200).json({ success: true, vouchers });
    }
    catch (error) {
        next(error);
    }
});
exports.getVouchersByUser = getVouchersByUser;
const getAllVouchers = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const vouchers = yield prisma_1.default.voucher.findMany({
            include: {
                voucherProducts: {
                    select: {
                        product: true,
                    },
                },
            },
        });
        res.status(200).json({ success: true, vouchers });
    }
    catch (error) {
        next(error);
    }
});
exports.getAllVouchers = getAllVouchers;
