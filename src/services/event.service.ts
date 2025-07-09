import { NextFunction } from "express";
import { ValidationError } from "../packages/error-handler";
import redis from "../libs/redis";
import prisma from "../libs/prisma";
import stripe from "../libs/stripe";
import Stripe from "stripe";

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

  if (type !== "QUIZ" && type !== "DROP") {
    throw new ValidationError("Invalid event type!");
  }
};

export const checkPlayedRestrictions = async (
  email: string,
  next: NextFunction
) => {
  if (await redis.get(`is_played:${email}`)) {
    throw new ValidationError(
      "You have already played today! Please come back tomorrow!"
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new ValidationError("User not found!");
  }

  // Set lock trong Redis để giới hạn 1 lần/ngày
  await redis.set(`is_played:${user.email}`, "true", "EX", 86400);
};

export const calculateReward = async (
  user: any,
  eventId: string,
  correctAnswers: number,
  next: NextFunction
) => {
  try {
    const eventReward = await prisma.eventReward.findFirst({
      where: {
        event_id: eventId,
        min_correct: { lte: correctAnswers },
        max_correct: { gte: correctAnswers },
      },
    });

    if (!eventReward) {
      return null; // Không có phần thưởng phù hợp
    }

    // Nếu số lượng voucher không còn
    if (eventReward.voucher_quantity <= 0) {
      return null;
    }

    const today = new Date();
    const twoWeeksLater = new Date();
    twoWeeksLater.setDate(today.getDate() + 14);

    // Truy vấn các sản phẩm có lô hàng sắp hết hạn (trong vòng 14 ngày)
    const expiringBatches = await prisma.batch.findMany({
      where: {
        expired_at: {
          lte: twoWeeksLater,
        },
        current_stock: {
          gt: 0,
        },
      },
      select: {
        product_id: true,
      },
      distinct: ["product_id"], // Đảm bảo không bị trùng
    });

    const expiringProductIds = expiringBatches.map((b) => b.product_id);

    const couponData: Stripe.CouponCreateParams = {
      max_redemptions: 1,
      metadata: {
        userId: user.id,
        eventId,
        eventRewardId: eventReward.id,
      },
      applies_to: {
        products: [
          ...expiringProductIds, // Chỉ áp dụng cho các sản phẩm sắp hết hạn
        ],
      },
    };

    if (eventReward.type === "PERCENT") {
      couponData.percent_off = eventReward.discount_value;
    } else if (eventReward.type === "AMOUNT") {
      couponData.amount_off = eventReward.discount_value;
      couponData.currency = "vnd";
    }

    // Tạo coupon trên Stripe
    await stripe.coupons.create(couponData);

    return eventReward;
  } catch (error) {
    next(error);
  }
};
