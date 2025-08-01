import { NextFunction, Request, Response } from "express";
import { ValidationError } from "../packages/error-handler";
import prisma from "../libs/prisma";

export const getAllVoucherTemplates = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { is_active, type, include_leaderboard } = req.query;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    const where: any = {};

    // Include both event vouchers and leaderboard reward vouchers
    if (include_leaderboard === "true") {
      where.OR = [
        { event_id: id },
        {
          leaderboardReward: {
            event_id: id,
          },
        },
      ];
    } else {
      // Only event vouchers (excluding leaderboard reward vouchers)
      where.event_id = id;
      where.leaderboard_reward_id = undefined;
    }

    if (is_active !== undefined)
      where.is_active = is_active === "true" ? true : undefined;
    if (type) where.type = type;

    const voucherTemplates = await prisma.voucherTemplate.findMany({
      where,
      include: {
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
        leaderboardReward: {
          select: {
            id: true,
            title: true,
            rank_from: true,
            rank_to: true,
          },
        },
        _count: {
          select: {
            vouchers: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    res
      .status(200)
      .json({ success: true, voucher_templates: voucherTemplates });
  } catch (error) {
    next(error);
  }
};

export const getVoucherTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id, templateId } = req.params;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    // Find template that belongs to this event (either directly or through leaderboard reward)
    const voucherTemplate = await prisma.voucherTemplate.findFirst({
      where: {
        id: templateId,
        OR: [
          { event_id: id },
          {
            leaderboardReward: {
              event_id: id,
            },
          },
        ],
      },
      include: {
        voucherProducts: {
          select: {
            product: {
              select: {
                id: true,
                title: true,
                image_url: true,
                price: true,
                sale_price: true,
                product_code: true,
              },
            },
          },
        },
        leaderboardReward: {
          select: {
            id: true,
            title: true,
            rank_from: true,
            rank_to: true,
            event_id: true,
          },
        },
        vouchers: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            redeemed: true,
            redeemed_at: true,
            created_at: true,
          },
          orderBy: { created_at: "desc" },
        },
        _count: {
          select: {
            vouchers: true,
          },
        },
      },
    });

    if (!voucherTemplate) {
      return next(new ValidationError("Voucher template not found!"));
    }

    res.status(200).json({ success: true, voucher_template: voucherTemplate });
  } catch (error) {
    next(error);
  }
};

export const addEventVoucherTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { discount_value, type, user_limit, min_order_amount, productIds } =
      req.body;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    if (!discount_value || !type || !user_limit) {
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

    const voucherTemplate = await prisma.voucherTemplate.create({
      data: {
        discount_value,
        type,
        user_limit,
        min_order_amount,
        event_id: id,
        voucherProducts: {
          create: productIds.map((productId: string) => ({
            product_id: productId,
          })),
        },
      },
    });

    res.status(201).json({ success: true, voucher_template: voucherTemplate });
  } catch (error) {
    next(error);
  }
};

export const updateVoucherTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id, templateId } = req.params;
    const {
      discount_value,
      type,
      user_limit,
      productIds,
      min_order_amount,
      is_active,
    } = req.body;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    const existingTemplate = await prisma.voucherTemplate.findFirst({
      where: {
        id: templateId,
        OR: [
          { event_id: id },
          {
            leaderboardReward: {
              event_id: id,
            },
          },
        ],
      },
      include: {
        _count: {
          select: {
            vouchers: true,
          },
        },
        voucherProducts: {
          select: {
            product: {
              select: {
                id: true,
              },
            },
          },
        },
        leaderboardReward: {
          select: {
            id: true,
            title: true,
            rank_from: true,
            rank_to: true,
          },
        },
      },
    });

    if (!existingTemplate) {
      return next(new ValidationError("Voucher template not found!"));
    }

    // Check if template has been used (has vouchers) - prevent critical field updates
    const hasVouchers = existingTemplate._count.vouchers > 0;

    if (hasVouchers) {
      // Check if trying to update fields that cannot be changed
      if (
        (discount_value &&
          existingTemplate.discount_value !== discount_value) ||
        (type && existingTemplate.type !== type) ||
        (user_limit && existingTemplate.user_limit !== user_limit) ||
        (min_order_amount !== undefined &&
          existingTemplate.min_order_amount !== min_order_amount) ||
        (productIds && existingTemplate.voucherProducts.length > 0)
      ) {
        return next(
          new ValidationError(
            "Cannot update template properties that has been used by users! Only 'is_active' field can be updated."
          )
        );
      }
    }

    // Validate type if provided and no vouchers exist
    if (type && type !== "PERCENT" && type !== "AMOUNT") {
      return next(new ValidationError("Invalid voucher type!"));
    }

    // Validate and check products if productIds provided and no vouchers exist
    if (productIds && !hasVouchers) {
      if (!Array.isArray(productIds)) {
        return next(new ValidationError("Invalid product IDs!"));
      }

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
    }

    // If trying to activate a template that belongs to a leaderboard reward,
    // check if there's already an active template for that reward
    if (is_active === true && existingTemplate.leaderboard_reward_id) {
      const activeTemplatesInReward = await prisma.voucherTemplate.count({
        where: {
          leaderboard_reward_id: existingTemplate.leaderboard_reward_id,
          is_active: true,
          id: { not: templateId },
        },
      });

      if (activeTemplatesInReward > 0) {
        return next(
          new ValidationError(
            "Only one voucher template can be active per leaderboard reward!"
          )
        );
      }
    }

    const updateData: any = {};

    // Only update these fields if no vouchers exist
    if (!hasVouchers) {
      if (discount_value) updateData.discount_value = discount_value;
      if (type) updateData.type = type;
      if (user_limit) updateData.user_limit = user_limit;
      if (min_order_amount !== undefined)
        updateData.min_order_amount = min_order_amount;

      if (productIds) {
        updateData.voucherProducts = {
          deleteMany: {},
          create: productIds.map((productId: string) => ({
            product_id: productId,
          })),
        };
      }
    }

    // is_active can always be updated
    if (is_active !== undefined) updateData.is_active = is_active;

    const updatedTemplate = await prisma.voucherTemplate.update({
      where: { id: templateId },
      data: updateData,
      include: {
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
        _count: {
          select: {
            vouchers: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      voucher_template: updatedTemplate,
      message: hasVouchers
        ? "Template has been used - only status can be updated"
        : "Template updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const deleteVoucherTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id, templateId } = req.params;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    // Find template that belongs to this event (either directly or through leaderboard reward)
    const voucherTemplate = await prisma.voucherTemplate.findFirst({
      where: {
        id: templateId,
        OR: [
          { event_id: id },
          {
            leaderboardReward: {
              event_id: id,
            },
          },
        ],
      },
      include: {
        _count: {
          select: {
            vouchers: true,
          },
        },
        leaderboardReward: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!voucherTemplate) {
      return next(new ValidationError("Voucher template not found!"));
    }

    // Check if there are existing vouchers using this template
    if (voucherTemplate._count.vouchers > 0) {
      return next(
        new ValidationError(
          "Cannot delete voucher template that has been used by users!"
        )
      );
    }

    await prisma.voucherTemplate.delete({ where: { id: templateId } });

    const templateType = voucherTemplate.leaderboardReward
      ? `leaderboard reward "${voucherTemplate.leaderboardReward.title}"`
      : "event";

    res.status(200).json({
      success: true,
      message: `Voucher template from ${templateType} deleted!`,
    });
  } catch (error) {
    next(error);
  }
};
