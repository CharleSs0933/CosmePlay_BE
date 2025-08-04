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
exports.getVouchersEventByUser = exports.getAllVouchers = exports.getVouchersByUser = void 0;
const prisma_1 = __importDefault(require("../libs/prisma"));
const error_handler_1 = require("../packages/error-handler");
const getVouchersByUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const vouchers = yield prisma_1.default.voucher.findMany({
            where: {
                user_id: user.id,
            },
            include: {
                order: {
                    select: {
                        order_number: true,
                        createdAt: true,
                    },
                },
                voucherTemplate: {
                    select: {
                        type: true,
                        discount_value: true,
                        min_order_amount: true,
                        voucherProducts: {
                            select: {
                                product: true,
                            },
                        },
                    },
                },
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
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
                voucherTemplate: {
                    include: {
                        voucherProducts: {
                            select: {
                                product: {
                                    select: {
                                        id: true,
                                        title: true,
                                        price: true,
                                        image_url: true,
                                    },
                                },
                            },
                        },
                    },
                },
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
                order: {
                    select: {
                        order_number: true,
                        createdAt: true,
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
const getVouchersEventByUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { eventId } = req.params;
    if (!eventId) {
        return next(new error_handler_1.ValidationError("Event ID is required!"));
    }
    // Check if event exists
    const event = yield prisma_1.default.event.findUnique({
        where: { id: eventId },
    });
    if (!event) {
        return next(new error_handler_1.ValidationError("Event not found!"));
    }
    const vouchers = yield prisma_1.default.voucher.findMany({
        where: {
            user_id: user.id,
            voucherTemplate: {
                event_id: eventId,
            },
        },
        include: {
            order: {
                select: {
                    order_number: true,
                    createdAt: true,
                },
            },
            voucherTemplate: {
                select: {
                    type: true,
                    discount_value: true,
                    min_order_amount: true,
                    voucherProducts: {
                        select: {
                            product: true,
                        },
                    },
                },
            },
        },
    });
    res.status(200).json({ success: true, vouchers });
});
exports.getVouchersEventByUser = getVouchersEventByUser;
