import { NextFunction } from "express";
import { ValidationError } from "../packages/error-handler";
import redis from "../libs/redis";
import prisma from "../libs/prisma";
import stripe from "../libs/stripe";
import Stripe from "stripe";

export const validateEventData = (data: any) => {
  const { title, description, start_time, end_time, is_active } = data;

  if (!title || !description || !start_time || !end_time || !is_active) {
    throw new ValidationError("Missing required fields!");
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
    const eventReward = await prisma.eventReward.findUnique({
      where: { event_id: eventId, min_correct: correctAnswers },
    });

    if (!eventReward) {
      return null;
    }

    const couponData: Stripe.CouponCreateParams = {
      max_redemptions: 1,
      metadata: {
        userId: user.id,
        eventId,
        eventRewardId: eventReward.id,
      },
    };

    if (eventReward.type === "PERCENT") {
      couponData.percent_off = eventReward.discount_value;
    } else if (eventReward.type === "AMOUNT") {
      couponData.amount_off = eventReward.discount_value;
      couponData.currency = "vnd";
    }

    await stripe.coupons.create(couponData);

    return eventReward;
  } catch (error) {
    next(error);
  }
};
