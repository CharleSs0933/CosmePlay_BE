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
const calculateReward = (user, eventId, correctAnswers, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 1. Tìm phần thưởng phù hợp
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
        // Check correct answers and milestone points
        if (correctAnswers < event.milestone_score) {
            throw new error_handler_1.ValidationError("Not enough correct answers!");
        }
        // 2. Filter active voucher templates that haven't reached user_limit
        const eligibleVoucherTemplates = event.voucherTemplates.filter((vt) => !vt.user_limit || vt.user_count < vt.user_limit);
        if (eligibleVoucherTemplates.length === 0) {
            throw new error_handler_1.ValidationError("No eligible vouchers available");
        }
        // 3. Select a random voucher template
        const randomIndex = Math.floor(Math.random() * eligibleVoucherTemplates.length);
        const selectedVoucherTemplate = eligibleVoucherTemplates[randomIndex];
        // 4. Get applicable product IDs for the Stripe coupon
        const stripeProductIds = selectedVoucherTemplate.voucherProducts.map((vp) => vp.product.stripe_product_id);
        // 5. Tạo dữ liệu Coupon trên Stripe
        const couponData = {
            max_redemptions: 5,
            metadata: {
                userId: user.id,
                eventId,
                voucherTemplateId: selectedVoucherTemplate.id,
            },
            applies_to: {
                products: stripeProductIds,
            },
            redeem_by: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // Hết hạn sau 7 ngày
        };
        // Set discount type
        if (selectedVoucherTemplate.type === "PERCENT") {
            couponData.percent_off = selectedVoucherTemplate.discount_value;
        }
        else if (selectedVoucherTemplate.type === "AMOUNT") {
            couponData.amount_off = selectedVoucherTemplate.discount_value * 100; // Convert to cents
            couponData.currency = "vnd";
        }
        // 5. Tạo Coupon trên Stripe
        yield stripe_1.default.coupons.create(couponData);
        return {
            discountType: selectedVoucherTemplate.type,
            discountValue: selectedVoucherTemplate.discount_value,
        };
    }
    catch (error) {
        next(error);
    }
});
exports.calculateReward = calculateReward;
