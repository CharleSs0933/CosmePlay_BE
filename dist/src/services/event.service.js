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
    //Check type is valid
    const validTypes = [
        "QUIZ",
        "DROP",
        "HUNT",
        "PUZZLE",
        "REFLEX",
        "ARCADE",
        "BINGO",
        "DESIGN",
        "MEMORY",
        "SPIN",
        "RACE",
    ];
    if (!validTypes.includes(type)) {
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
const calculateReward = (user, eventId, correctAnswers, completionTime // Thời gian hoàn thành (giây)
) => __awaiter(void 0, void 0, void 0, function* () {
    // 1. Tìm event và kiểm tra tồn tại
    const event = yield prisma_1.default.event.findUnique({
        where: { id: eventId },
        include: {
            voucherTemplates: {
                where: { is_active: true },
                orderBy: { created_at: "desc" },
                include: {
                    voucherProducts: {
                        select: {
                            product: {
                                select: {
                                    stripe_product_id: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    if (!event) {
        throw new error_handler_1.ValidationError("Event not found!");
    }
    // 2. Kiểm tra xem user đã có điểm cho event này chưa
    const existingScore = yield prisma_1.default.eventScore.findUnique({
        where: {
            user_id_event_id: {
                user_id: user.id,
                event_id: eventId,
            },
        },
    });
    let eventScore;
    let isNewHighScore = false;
    let previousBestScore = 0;
    if (existingScore) {
        previousBestScore = existingScore.score;
        // Chỉ cập nhật nếu điểm mới cao hơn hoặc (điểm bằng nhau nhưng thời gian hoàn thành nhanh hơn)
        const shouldUpdate = correctAnswers > existingScore.score ||
            (correctAnswers === existingScore.score &&
                completionTime &&
                existingScore.completion_time &&
                completionTime < existingScore.completion_time);
        if (shouldUpdate) {
            eventScore = yield prisma_1.default.eventScore.update({
                where: {
                    user_id_event_id: {
                        user_id: user.id,
                        event_id: eventId,
                    },
                },
                data: {
                    score: correctAnswers,
                    completion_time: completionTime || existingScore.completion_time,
                    completed_at: new Date(),
                },
            });
            isNewHighScore = true;
        }
        else {
            eventScore = existingScore;
            // Không phải high score mới, isNewHighScore vẫn là false
        }
    }
    else {
        // Lần đầu chơi - tạo mới
        previousBestScore = 0; // Chưa có điểm trước đó
        eventScore = yield prisma_1.default.eventScore.create({
            data: {
                user_id: user.id,
                event_id: eventId,
                score: correctAnswers,
                completion_time: completionTime || null,
                completed_at: new Date(),
            },
        });
        isNewHighScore = true; // Lần đầu chơi luôn là high score
    }
    // 3. Kiểm tra điểm số có đạt milestone không
    if (correctAnswers < event.milestone_score) {
        // Không đủ điểm để nhận thưởng nhưng vẫn lưu điểm
        return {
            score: correctAnswers,
            previous_best_score: previousBestScore,
            is_new_high_score: isNewHighScore,
            milestone_reached: false,
            required_score: event.milestone_score,
            message: isNewHighScore
                ? "New high score saved but milestone not reached. No reward given."
                : "Score saved but milestone not reached. No reward given.",
        };
    }
    // 5. Filter active voucher templates that haven't reached user_limit
    const eligibleVoucherTemplates = event.voucherTemplates.filter((vt) => !vt.user_limit || vt.user_count < vt.user_limit);
    if (eligibleVoucherTemplates.length === 0) {
        // Đạt milestone nhưng không còn voucher
        return {
            score: correctAnswers,
            previous_best_score: previousBestScore,
            is_new_high_score: isNewHighScore,
            milestone_reached: true,
            message: "Milestone reached but no vouchers available.",
        };
    }
    // 6. Select a random voucher template
    const randomIndex = Math.floor(Math.random() * eligibleVoucherTemplates.length);
    const selectedVoucherTemplate = eligibleVoucherTemplates[randomIndex];
    // 7. Get applicable product IDs for the Stripe coupon
    const stripeProductIds = selectedVoucherTemplate.voucherProducts.map((vp) => vp.product.stripe_product_id);
    // 8. Tạo dữ liệu Coupon trên Stripe
    const couponData = {
        max_redemptions: 1, // Mỗi coupon chỉ dùng được 1 lần
        metadata: {
            userId: user.id,
            eventId,
            voucherTemplateId: selectedVoucherTemplate.id,
            eventScoreId: eventScore.id, // Thêm reference đến event score
        },
        redeem_by: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // Hết hạn sau 7 ngày
    };
    // Set discount type
    if (selectedVoucherTemplate.type === "PERCENT") {
        couponData.percent_off = selectedVoucherTemplate.discount_value;
    }
    else if (selectedVoucherTemplate.type === "AMOUNT") {
        couponData.amount_off = selectedVoucherTemplate.discount_value;
        couponData.currency = "vnd";
    }
    // Set applicable products for the coupon
    if (stripeProductIds && stripeProductIds.length > 0) {
        couponData.applies_to = { products: stripeProductIds };
    }
    // 9. Tạo Coupon trên Stripe
    const stripeCoupon = yield stripe_1.default.coupons.create(couponData);
    // 10. Tạo voucher record trong database
    const voucher = yield prisma_1.default.voucher.create({
        data: {
            voucher_template_id: selectedVoucherTemplate.id,
            stripe_coupon_id: stripeCoupon.id,
            user_id: user.id,
            expired_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày
        },
    });
    // 11. Cập nhật user_count của voucher template
    yield prisma_1.default.voucherTemplate.update({
        where: { id: selectedVoucherTemplate.id },
        data: {
            user_count: {
                increment: 1,
            },
        },
    });
    return {
        score: correctAnswers,
        previous_best_score: previousBestScore,
        is_new_high_score: isNewHighScore,
        milestone_reached: true,
        eventScore: {
            id: eventScore.id,
            score: eventScore.score,
            completion_time: eventScore.completion_time,
            completed_at: eventScore.completed_at,
        },
        voucher: {
            id: voucher.id,
            stripe_coupon_id: voucher.stripe_coupon_id,
            expired_at: voucher.expired_at,
        },
        reward: {
            discountType: selectedVoucherTemplate.type,
            discountValue: selectedVoucherTemplate.discount_value,
            applicableProducts: selectedVoucherTemplate.voucherProducts.map((vp) => ({
                id: vp.product.stripe_product_id,
            })),
        },
        message: isNewHighScore
            ? "Congratulations! New high score and you've earned a voucher reward!"
            : "Congratulations! You've earned a voucher reward!",
    };
});
exports.calculateReward = calculateReward;
