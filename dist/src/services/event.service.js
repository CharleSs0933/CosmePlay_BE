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
exports.calculateReward = exports.checkPlayedRestrictions = exports.validateEventData = void 0;
const error_handler_1 = require("../packages/error-handler");
const redis_1 = __importDefault(require("../libs/redis"));
const prisma_1 = __importDefault(require("../libs/prisma"));
const stripe_1 = __importDefault(require("../libs/stripe"));
const validateEventData = (data) => {
    const { title, description, start_time, end_time, is_active, type } = data;
    if (!title ||
        !description ||
        !start_time ||
        !end_time ||
        !is_active ||
        !type) {
        throw new error_handler_1.ValidationError("Missing required fields!");
    }
    if (type !== "QUIZ" && type !== "DROP") {
        throw new error_handler_1.ValidationError("Invalid event type!");
    }
};
exports.validateEventData = validateEventData;
const checkPlayedRestrictions = (email, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (yield redis_1.default.get(`is_played:${email}`)) {
        throw new error_handler_1.ValidationError("You have already played today! Please come back tomorrow!");
    }
    const user = yield prisma_1.default.user.findUnique({ where: { email } });
    if (!user) {
        throw new error_handler_1.ValidationError("User not found!");
    }
    // Set lock trong Redis để giới hạn 1 lần/ngày
    yield redis_1.default.set(`is_played:${user.email}`, "true", "EX", 86400);
});
exports.checkPlayedRestrictions = checkPlayedRestrictions;
const calculateReward = (user, eventId, correctAnswers, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 1. Tìm phần thưởng phù hợp
        const eventReward = yield prisma_1.default.eventReward.findFirst({
            where: {
                event_id: eventId,
                min_correct: { lte: correctAnswers },
                max_correct: { gte: correctAnswers },
            },
        });
        if (!eventReward)
            return null;
        if (eventReward.voucher_quantity <= 0)
            return null;
        // 2. Lấy các sản phẩm sắp hết hạn trong 14 ngày tới
        const today = new Date();
        const twoWeeksLater = new Date();
        twoWeeksLater.setDate(today.getDate() + 14);
        const expiringBatches = yield prisma_1.default.batch.findMany({
            where: {
                expired_at: { lte: twoWeeksLater },
                current_stock: { gt: 0 },
            },
            select: { product_id: true },
            distinct: ["product_id"],
        });
        const expiringProductIds = expiringBatches.map((b) => b.product_id);
        const expiringProducts = yield prisma_1.default.product.findMany({
            where: {
                id: { in: expiringProductIds },
                stripe_product_id: { not: null },
            },
            select: { stripe_product_id: true },
        });
        const stripeProductIds = expiringProducts.map((p) => p.stripe_product_id);
        // 3. Tạo dữ liệu Coupon trên Stripe
        const couponData = {
            max_redemptions: 1,
            metadata: {
                userId: user.id,
                eventId,
                eventRewardId: eventReward.id,
            },
        };
        // ✅ Nếu có sản phẩm hợp lệ, chỉ áp dụng cho các sản phẩm đó
        if (stripeProductIds.length > 0) {
            couponData.applies_to = {
                products: stripeProductIds,
            };
        }
        // 4. Thêm loại giảm giá vào coupon
        if (eventReward.type === "PERCENT") {
            couponData.percent_off = eventReward.discount_value;
        }
        else {
            couponData.amount_off = eventReward.discount_value;
            couponData.currency = "vnd";
        }
        // 5. Tạo Coupon trên Stripe
        yield stripe_1.default.coupons.create(couponData);
        return eventReward;
    }
    catch (error) {
        next(error);
    }
});
exports.calculateReward = calculateReward;
