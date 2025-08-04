import { NextFunction } from "express";
import { ValidationError } from "../packages/error-handler";
import redis from "../libs/redis";
import prisma from "../libs/prisma";
import stripe from "../libs/stripe";
import Stripe from "stripe";
import { EventType } from "@prisma/client";

export const validateEventData = (data: any) => {
  const { title, description, start_time, end_time, is_active, type } = data;

  if (
    !title ||
    !description ||
    !start_time ||
    !end_time ||
    !is_active ||
    !type
  ) {
    throw new ValidationError("Missing required fields!");
  }

  //Check type is valid
  const validTypes: EventType[] = [
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
    "DEFENDER",
  ];
  if (!validTypes.includes(type)) {
    throw new ValidationError("Invalid event type!");
  }
};

// Hàm kiểm tra xem user đã nhận voucher trong ngày chưa
export const checkVoucherRestrictions = async (
  email: string
): Promise<boolean> => {
  const voucherKey = `voucher_received:${email}`;
  const hasReceivedVoucher = await redis.get(voucherKey);
  return !!hasReceivedVoucher;
};

// Hàm đánh dấu user đã nhận voucher trong ngày
export const markVoucherReceived = async (email: string) => {
  const voucherKey = `voucher_received:${email}`;
  // Set expiry at end of day (midnight)
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const secondsUntilEndOfDay = Math.floor(
    (endOfDay.getTime() - now.getTime()) / 1000
  );

  await redis.set(voucherKey, "true", "EX", secondsUntilEndOfDay);
};

export const calculateReward = async (
  user: any,
  eventId: string,
  correctAnswers: number,
  completionTime?: number
) => {
  // 1. Tìm event và kiểm tra tồn tại
  const event = await prisma.event.findUnique({
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
    throw new ValidationError("Event not found!");
  }

  // 2. Kiểm tra xem user đã có điểm cho event này chưa
  const existingScore = await prisma.eventScore.findUnique({
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
    const shouldUpdate =
      correctAnswers > existingScore.score ||
      (correctAnswers === existingScore.score &&
        completionTime &&
        existingScore.completion_time &&
        completionTime < existingScore.completion_time);

    if (shouldUpdate) {
      eventScore = await prisma.eventScore.update({
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
    } else {
      eventScore = existingScore;
    }
  } else {
    // Lần đầu chơi - tạo mới
    previousBestScore = 0;
    eventScore = await prisma.eventScore.create({
      data: {
        user_id: user.id,
        event_id: eventId,
        score: correctAnswers,
        completion_time: completionTime || null,
        completed_at: new Date(),
      },
    });
    isNewHighScore = true;
  }

  // 3. Kiểm tra điểm số có đạt milestone không
  if (correctAnswers < event.milestone_score) {
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

  // 4. Kiểm tra xem user đã nhận voucher trong ngày chưa
  const hasReceivedVoucherToday = await checkVoucherRestrictions(user.email);

  if (hasReceivedVoucherToday) {
    return {
      score: correctAnswers,
      previous_best_score: previousBestScore,
      is_new_high_score: isNewHighScore,
      milestone_reached: true,
      voucher_already_received: true,
      message: isNewHighScore
        ? "New high score saved! Milestone reached but you have already received a voucher today. Come back tomorrow for more rewards!"
        : "Milestone reached but you have already received a voucher today. Come back tomorrow for more rewards!",
    };
  }

  // 5. Filter active voucher templates that haven't reached user_limit
  const eligibleVoucherTemplates = event.voucherTemplates.filter(
    (vt) => !vt.user_limit || vt.user_count < vt.user_limit
  );

  if (eligibleVoucherTemplates.length === 0) {
    return {
      score: correctAnswers,
      previous_best_score: previousBestScore,
      is_new_high_score: isNewHighScore,
      milestone_reached: true,
      message: "Milestone reached but no vouchers available.",
    };
  }

  // 6. Select a random voucher template
  const randomIndex = Math.floor(
    Math.random() * eligibleVoucherTemplates.length
  );
  const selectedVoucherTemplate = eligibleVoucherTemplates[randomIndex];

  // 7. Get applicable product IDs for the Stripe coupon
  const stripeProductIds = selectedVoucherTemplate.voucherProducts.map(
    (vp) => vp.product.stripe_product_id!
  );

  // 8. Tạo dữ liệu Coupon trên Stripe
  const couponData: Stripe.CouponCreateParams = {
    max_redemptions: 1,
    metadata: {
      userId: user.id,
      eventId,
      voucherTemplateId: selectedVoucherTemplate.id,
      eventScoreId: eventScore.id,
    },
    redeem_by: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // Hết hạn sau 7 ngày
  };

  // Set discount type
  if (selectedVoucherTemplate.type === "PERCENT") {
    couponData.percent_off = selectedVoucherTemplate.discount_value;
  } else if (selectedVoucherTemplate.type === "AMOUNT") {
    couponData.amount_off = selectedVoucherTemplate.discount_value;
    couponData.currency = "vnd";
  }

  // Set applicable products for the coupon
  if (stripeProductIds && stripeProductIds.length > 0) {
    couponData.applies_to = { products: stripeProductIds };
  }

  // 9. Tạo Coupon trên Stripe
  const stripeCoupon = await stripe.coupons.create(couponData);

  // 10. Tạo voucher record trong database
  const voucher = await prisma.voucher.create({
    data: {
      voucher_template_id: selectedVoucherTemplate.id,
      stripe_coupon_id: stripeCoupon.id,
      user_id: user.id,
      expired_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày
    },
  });

  // 11. Cập nhật user_count của voucher template
  await prisma.voucherTemplate.update({
    where: { id: selectedVoucherTemplate.id },
    data: {
      user_count: {
        increment: 1,
      },
    },
  });

  // 12. Đánh dấu user đã nhận voucher trong ngày
  await markVoucherReceived(user.email);

  return {
    score: correctAnswers,
    previous_best_score: previousBestScore,
    is_new_high_score: isNewHighScore,
    milestone_reached: true,
    voucher_received: true,
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
};
