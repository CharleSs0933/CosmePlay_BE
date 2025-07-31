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
  ];
  if (!validTypes.includes(type)) {
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
  // 1. Tìm phần thưởng phù hợp
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

  // Check correct answers and milestone points
  if (correctAnswers < event.milestone_score) {
    throw new ValidationError("Not enough correct answers!");
  }

  // 2. Filter active voucher templates that haven't reached user_limit
  const eligibleVoucherTemplates = event.voucherTemplates.filter(
    (vt) => !vt.user_limit || vt.user_count < vt.user_limit
  );

  if (eligibleVoucherTemplates.length === 0) {
    throw new ValidationError("No eligible vouchers available");
  }

  // 3. Select a random voucher template
  const randomIndex = Math.floor(
    Math.random() * eligibleVoucherTemplates.length
  );
  const selectedVoucherTemplate = eligibleVoucherTemplates[randomIndex];

  // 4. Get applicable product IDs for the Stripe coupon
  const stripeProductIds = selectedVoucherTemplate.voucherProducts.map(
    (vp) => vp.product.stripe_product_id!
  );

  // 5. Tạo dữ liệu Coupon trên Stripe
  const couponData: Stripe.CouponCreateParams = {
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
  } else if (selectedVoucherTemplate.type === "AMOUNT") {
    couponData.amount_off = selectedVoucherTemplate.discount_value * 100; // Convert to cents
    couponData.currency = "vnd";
  }

  // 5. Tạo Coupon trên Stripe
  await stripe.coupons.create(couponData);

  return {
    discountType: selectedVoucherTemplate.type,
    discountValue: selectedVoucherTemplate.discount_value,
  };
};
