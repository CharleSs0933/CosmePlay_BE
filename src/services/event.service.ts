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
    // 1. Tìm phần thưởng phù hợp
    const eventReward = await prisma.eventReward.findFirst({
      where: {
        event_id: eventId,
        min_correct: { lte: correctAnswers },
        max_correct: { gte: correctAnswers },
      },
    });

    if (!eventReward) return null;
    if (eventReward.voucher_quantity <= 0) return null;

    // 2. Lấy các sản phẩm sắp hết hạn trong 14 ngày tới
    const today = new Date();
    const twoWeeksLater = new Date();
    twoWeeksLater.setDate(today.getDate() + 14);

    const expiringBatches = await prisma.batch.findMany({
      where: {
        expired_at: { lte: twoWeeksLater },
        current_stock: { gt: 0 },
      },
      select: { product_id: true },
      distinct: ["product_id"],
    });

    const expiringProductIds = expiringBatches.map((b) => b.product_id);

    // Lấy toàn bộ sản phẩm hợp lệ có stripe_product_id
    const validProducts = await prisma.product.findMany({
      where: {
        stripe_product_id: { not: null },
      },
      select: { id: true, stripe_product_id: true },
    });

    // Hàm trộn ngẫu nhiên
    function shuffle<T>(array: T[]): T[] {
      return array.sort(() => Math.random() - 0.5);
    }

    // Tách danh sách sản phẩm sắp hết hạn và còn lại
    const expiringValidProducts = validProducts.filter((p) =>
      expiringProductIds.includes(p.id)
    );
    const otherValidProducts = validProducts.filter(
      (p) => !expiringProductIds.includes(p.id)
    );

    // Lấy sản phẩm ngẫu nhiên theo đúng yêu cầu
    let selectedProducts: typeof validProducts = [];

    if (expiringValidProducts.length >= 5) {
      selectedProducts = shuffle(expiringValidProducts).slice(0, 5);
    } else {
      const remaining = 5 - expiringValidProducts.length;
      selectedProducts = [
        ...expiringValidProducts,
        ...shuffle(otherValidProducts).slice(0, remaining),
      ];
    }

    const stripeProductIds = selectedProducts.map((p) => p.stripe_product_id!);

    // 3. Tạo dữ liệu Coupon trên Stripe
    const couponData: Stripe.CouponCreateParams = {
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
    } else {
      couponData.amount_off = eventReward.discount_value;
      couponData.currency = "vnd";
    }

    // 5. Tạo Coupon trên Stripe
    await stripe.coupons.create(couponData);

    return eventReward;
  } catch (error) {
    next(error);
  }
};
