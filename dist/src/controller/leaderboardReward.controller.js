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
exports.addVoucherToLeaderboardReward = exports.deleteLeaderboardReward = exports.updateLeaderboardReward = exports.addLeaderboardReward = exports.getLeaderboardReward = exports.getAllLeaderboardRewards = void 0;
const prisma_1 = __importDefault(require("../libs/prisma"));
const error_handler_1 = require("../packages/error-handler");
const getAllLeaderboardRewards = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { is_active } = req.query;
        const event = yield prisma_1.default.event.findUnique({ where: { id } });
        if (!event) {
            return next(new error_handler_1.ValidationError("Event not found!"));
        }
        const where = { event_id: id };
        if (is_active !== undefined)
            where.is_active = is_active === "true";
        const rewards = yield prisma_1.default.leaderboardReward.findMany({
            where,
            include: {
                voucherTemplates: {
                    where: { is_active: true },
                    select: {
                        id: true,
                        discount_value: true,
                        type: true,
                        user_limit: true,
                        user_count: true,
                        voucherProducts: {
                            select: {
                                product: {
                                    select: {
                                        id: true,
                                        title: true,
                                        image_url: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { rank_from: "asc" },
        });
        res.status(200).json({ success: true, rewards });
    }
    catch (error) {
        next(error);
    }
});
exports.getAllLeaderboardRewards = getAllLeaderboardRewards;
const getLeaderboardReward = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id, rewardId } = req.params;
        const event = yield prisma_1.default.event.findUnique({ where: { id } });
        if (!event) {
            return next(new error_handler_1.ValidationError("Event not found!"));
        }
        const reward = yield prisma_1.default.leaderboardReward.findUnique({
            where: { id: rewardId, event_id: id },
            include: {
                voucherTemplates: {
                    where: { is_active: true },
                    select: {
                        id: true,
                        discount_value: true,
                        type: true,
                        user_limit: true,
                        user_count: true,
                        min_order_amount: true,
                        voucherProducts: {
                            select: {
                                product: {
                                    select: {
                                        id: true,
                                        title: true,
                                        image_url: true,
                                        price: true,
                                        sale_price: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!reward) {
            return next(new error_handler_1.ValidationError("Leaderboard reward not found!"));
        }
        res.status(200).json({ success: true, reward });
    }
    catch (error) {
        next(error);
    }
});
exports.getLeaderboardReward = getLeaderboardReward;
const addLeaderboardReward = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { rank_from, rank_to, title, description } = req.body;
        const event = yield prisma_1.default.event.findUnique({ where: { id } });
        if (!event) {
            return next(new error_handler_1.ValidationError("Event not found!"));
        }
        if (!rank_from || !rank_to || !title || !description) {
            return next(new error_handler_1.ValidationError("Missing required fields!"));
        }
        if (rank_from > rank_to) {
            return next(new error_handler_1.ValidationError("rank_from must be less than or equal to rank_to!"));
        }
        const reward = yield prisma_1.default.leaderboardReward.create({
            data: {
                event_id: id,
                rank_from,
                rank_to,
                title,
                description,
            },
        });
        res.status(201).json({ success: true, reward });
    }
    catch (error) {
        next(error);
    }
});
exports.addLeaderboardReward = addLeaderboardReward;
const updateLeaderboardReward = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id, rewardId } = req.params;
        const { rank_from, rank_to, title, description, is_active } = req.body;
        const event = yield prisma_1.default.event.findUnique({ where: { id } });
        if (!event) {
            return next(new error_handler_1.ValidationError("Event not found!"));
        }
        const existingReward = yield prisma_1.default.leaderboardReward.findUnique({
            where: { id: rewardId, event_id: id },
        });
        if (!existingReward) {
            return next(new error_handler_1.ValidationError("Leaderboard reward not found!"));
        }
        // Validate rank range if provided
        if (rank_from && rank_to && rank_from > rank_to) {
            return next(new error_handler_1.ValidationError("rank_from must be less than or equal to rank_to!"));
        }
        // Check for overlapping ranks if rank is being updated
        if (rank_from || rank_to) {
            const newRankFrom = rank_from || existingReward.rank_from;
            const newRankTo = rank_to || existingReward.rank_to;
            const overlappingRewards = yield prisma_1.default.leaderboardReward.findMany({
                where: {
                    event_id: id,
                    id: { not: rewardId },
                    OR: [
                        {
                            rank_from: { lte: newRankTo },
                            rank_to: { gte: newRankFrom },
                        },
                    ],
                },
            });
            if (overlappingRewards.length > 0) {
                return next(new error_handler_1.ValidationError("Rank range overlaps with existing reward!"));
            }
        }
        const updatedReward = yield prisma_1.default.leaderboardReward.update({
            where: { id: rewardId },
            data: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (rank_from && { rank_from })), (rank_to && { rank_to })), (title && { title })), (description !== undefined && { description })), (is_active !== undefined && { is_active })),
            include: {
                voucherTemplates: {
                    where: { is_active: true },
                    select: {
                        id: true,
                        discount_value: true,
                        type: true,
                        user_limit: true,
                        user_count: true,
                    },
                },
            },
        });
        res.status(200).json({ success: true, reward: updatedReward });
    }
    catch (error) {
        next(error);
    }
});
exports.updateLeaderboardReward = updateLeaderboardReward;
const deleteLeaderboardReward = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id, rewardId } = req.params;
        const event = yield prisma_1.default.event.findUnique({ where: { id } });
        if (!event) {
            return next(new error_handler_1.ValidationError("Event not found!"));
        }
        const reward = yield prisma_1.default.leaderboardReward.findUnique({
            where: { id: rewardId, event_id: id },
            include: {
                voucherTemplates: {
                    select: {
                        _count: {
                            select: {
                                vouchers: true,
                            },
                        },
                    },
                },
            },
        });
        if (!reward) {
            return next(new error_handler_1.ValidationError("Leaderboard reward not found!"));
        }
        // Check if there are active vouchers associated with this reward
        if (reward.voucherTemplates.some((template) => template._count.vouchers > 0)) {
            return next(new error_handler_1.ValidationError("Cannot delete leaderboard reward with active vouchers!"));
        }
        yield prisma_1.default.leaderboardReward.delete({ where: { id: rewardId } });
        res
            .status(200)
            .json({ success: true, message: "Leaderboard reward deleted!" });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteLeaderboardReward = deleteLeaderboardReward;
const addVoucherToLeaderboardReward = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id, rewardId } = req.params;
        const { discount_value, type, user_limit, productIds, min_order_amount } = req.body;
        const event = yield prisma_1.default.event.findUnique({ where: { id } });
        if (!event) {
            return next(new error_handler_1.ValidationError("Event not found!"));
        }
        const reward = yield prisma_1.default.leaderboardReward.findUnique({
            where: { id: rewardId, event_id: id },
            include: {
                voucherTemplates: {
                    where: { is_active: true },
                },
            },
        });
        if (!reward) {
            return next(new error_handler_1.ValidationError("Leaderboard reward not found!"));
        }
        // Check if leaderboard reward already has an active voucher template
        if (reward.voucherTemplates.length > 0) {
            return next(new error_handler_1.ValidationError("Leaderboard reward already has an active voucher template!"));
        }
        if (!discount_value || !type || !user_limit) {
            return next(new error_handler_1.ValidationError("Missing required fields!"));
        }
        if (type !== "PERCENT" && type !== "AMOUNT") {
            return next(new error_handler_1.ValidationError("Invalid voucher type!"));
        }
        if (!Array.isArray(productIds) || productIds.length === 0) {
            return next(new error_handler_1.ValidationError("Invalid product IDs!"));
        }
        // Check if products exist
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
        yield prisma_1.default.voucherTemplate.create({
            data: {
                discount_value,
                type,
                user_limit,
                min_order_amount: min_order_amount || 0,
                leaderboard_reward_id: rewardId,
                voucherProducts: {
                    create: productIds.map((productId) => ({
                        product_id: productId,
                    })),
                },
            },
        });
        res
            .status(201)
            .json({ success: true, message: "Voucher added to leaderboard reward!" });
    }
    catch (error) {
        next(error);
    }
});
exports.addVoucherToLeaderboardReward = addVoucherToLeaderboardReward;
