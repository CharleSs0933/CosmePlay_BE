import { NextFunction, Request, Response } from "express";
import prisma from "../libs/prisma";
import { ValidationError } from "../packages/error-handler";

export const getAllLeaderboardRewards = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { is_active } = req.query;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    const where: any = { event_id: id };
    if (is_active !== undefined) where.is_active = is_active === "true";

    const rewards = await prisma.leaderboardReward.findMany({
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
  } catch (error) {
    next(error);
  }
};

export const getLeaderboardReward = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id, rewardId } = req.params;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    const reward = await prisma.leaderboardReward.findUnique({
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
      return next(new ValidationError("Leaderboard reward not found!"));
    }

    res.status(200).json({ success: true, reward });
  } catch (error) {
    next(error);
  }
};

export const addLeaderboardReward = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { rank_from, rank_to, title, description } = req.body;

    const event = await prisma.event.findUnique({ where: { id } });

    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    if (!rank_from || !rank_to || !title || !description) {
      return next(new ValidationError("Missing required fields!"));
    }

    if (rank_from > rank_to) {
      return next(
        new ValidationError("rank_from must be less than or equal to rank_to!")
      );
    }

    const overlappingRewards = await prisma.leaderboardReward.findMany({
      where: {
        event_id: id,
        OR: [
          {
            rank_from: { lte: rank_to },
            rank_to: { gte: rank_from },
          },
        ],
      },
    });

    if (overlappingRewards.length > 0) {
      return next(
        new ValidationError("Rank range overlaps with existing reward!")
      );
    }

    const reward = await prisma.leaderboardReward.create({
      data: {
        event_id: id,
        rank_from,
        rank_to,
        title,
        description,
      },
    });

    res.status(201).json({ success: true, reward });
  } catch (error) {
    next(error);
  }
};

export const updateLeaderboardReward = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id, rewardId } = req.params;
    const { rank_from, rank_to, title, description, is_active } = req.body;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    const existingReward = await prisma.leaderboardReward.findUnique({
      where: { id: rewardId, event_id: id },
    });
    if (!existingReward) {
      return next(new ValidationError("Leaderboard reward not found!"));
    }

    // Validate rank range if provided
    if (rank_from && rank_to && rank_from > rank_to) {
      return next(
        new ValidationError("rank_from must be less than or equal to rank_to!")
      );
    }

    // Check for overlapping ranks if rank is being updated
    if (rank_from || rank_to) {
      const newRankFrom = rank_from || existingReward.rank_from;
      const newRankTo = rank_to || existingReward.rank_to;

      const overlappingRewards = await prisma.leaderboardReward.findMany({
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
        return next(
          new ValidationError("Rank range overlaps with existing reward!")
        );
      }
    }

    const updatedReward = await prisma.leaderboardReward.update({
      where: { id: rewardId },
      data: {
        ...(rank_from && { rank_from }),
        ...(rank_to && { rank_to }),
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(is_active !== undefined && { is_active }),
      },
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
  } catch (error) {
    next(error);
  }
};

export const deleteLeaderboardReward = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id, rewardId } = req.params;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    const reward = await prisma.leaderboardReward.findUnique({
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
      return next(new ValidationError("Leaderboard reward not found!"));
    }

    // Check if there are active vouchers associated with this reward
    if (
      reward.voucherTemplates.some((template) => template._count.vouchers > 0)
    ) {
      return next(
        new ValidationError(
          "Cannot delete leaderboard reward with active vouchers!"
        )
      );
    }

    await prisma.leaderboardReward.delete({ where: { id: rewardId } });

    res
      .status(200)
      .json({ success: true, message: "Leaderboard reward deleted!" });
  } catch (error) {
    next(error);
  }
};

export const addVoucherToLeaderboardReward = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id, rewardId } = req.params;
    const { discount_value, type, productIds, min_order_amount } = req.body;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    const reward = await prisma.leaderboardReward.findUnique({
      where: { id: rewardId, event_id: id },
      include: {
        voucherTemplates: {
          where: { is_active: true },
        },
      },
    });
    if (!reward) {
      return next(new ValidationError("Leaderboard reward not found!"));
    }

    // Check if leaderboard reward already has an active voucher template
    if (reward.voucherTemplates.length > 0) {
      return next(
        new ValidationError(
          "Leaderboard reward already has an active voucher template!"
        )
      );
    }

    if (!discount_value || !type) {
      return next(new ValidationError("Missing required fields!"));
    }

    if (type !== "PERCENT" && type !== "AMOUNT") {
      return next(new ValidationError("Invalid voucher type!"));
    }

    if (!Array.isArray(productIds)) {
      return next(new ValidationError("Invalid product IDs!"));
    }

    // Check if products exist
    const products = await prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
      },
    });

    if (products.length !== productIds.length) {
      return next(new ValidationError("Some products do not exist!"));
    }

    await prisma.voucherTemplate.create({
      data: {
        discount_value,
        type,
        user_limit: reward.rank_to - reward.rank_from + 1,
        min_order_amount: min_order_amount || 0,
        leaderboard_reward_id: rewardId,
        voucherProducts: {
          create: productIds.map((productId: string) => ({
            product_id: productId,
          })),
        },
      },
    });

    res
      .status(201)
      .json({ success: true, message: "Voucher added to leaderboard reward!" });
  } catch (error) {
    next(error);
  }
};
