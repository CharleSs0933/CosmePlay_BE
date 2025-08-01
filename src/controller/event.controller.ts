import { NextFunction, Request, Response } from "express";
import prisma from "../libs/prisma";
import {
  calculateReward,
  checkPlayedRestrictions,
} from "../services/event.service";
import { ValidationError } from "../packages/error-handler";
import Stripe from "stripe";
import stripe from "../libs/stripe";

// ========== EVENT MANAGEMENT APIs ==========

export const getAllEvents = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { is_active, type } = req.query;

    const where: any = {};
    if (is_active !== undefined) where.is_active = is_active === "true";
    if (type) where.type = type;

    const events = await prisma.event.findMany({
      where,
    });

    res.status(200).json({ success: true, events });
  } catch (error) {
    next(error);
  }
};

export const getEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            questions: true,
            eventScore: true,
          },
        },
        leaderboardReward: {
          where: { is_active: true },
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
        },
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
    });

    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    res.status(200).json({ success: true, event });
  } catch (error) {
    next(error);
  }
};

export const addEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      title,
      description,
      image_url,
      start_time,
      end_time,
      type,
      milestone_score = 100,
      is_active = true,
    } = req.body;

    if (!title || !start_time || !end_time) {
      return next(
        new ValidationError("Title, start_time, and end_time are required!")
      );
    }

    if (new Date(start_time) >= new Date(end_time)) {
      return next(new ValidationError("End time must be after start time!"));
    }

    const event = await prisma.event.create({
      data: {
        title,
        description,
        image_url,
        start_time: new Date(start_time),
        end_time: new Date(end_time),
        type: type || "QUIZ",
        milestone_score,
        is_active,
      },
    });

    res.status(201).json({ success: true, event });
  } catch (error) {
    next(error);
  }
};

export const updateEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Convert date strings to Date objects if provided
    if (updateData.start_time) {
      updateData.start_time = new Date(updateData.start_time);
    }
    if (updateData.end_time) {
      updateData.end_time = new Date(updateData.end_time);
    }

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json({ success: true, event: updatedEvent });
  } catch (error) {
    next(error);
  }
};

export const deleteEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    await prisma.event.delete({ where: { id } });
    res.status(200).json({ success: true, message: "Event deleted!" });
  } catch (error) {
    next(error);
  }
};

// ========== QUESTION MANAGEMENT APIs ==========

export const getAllQuestionsByEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    const questions = await prisma.question.findMany({
      where: { event_id: id },
      include: {
        questionOptions: true,
      },
      orderBy: { id: "asc" },
    });

    res.status(200).json({ success: true, questions });
  } catch (error) {
    next(error);
  }
};

export const getRandomQuestions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.query;
    const questionLimit = Math.min(parseInt(limit as string), 50); // Max 50 questions

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    const questions = await prisma.question.findMany({
      where: { event_id: id },
      include: {
        questionOptions: {
          select: {
            id: true,
            content: true,
            is_correct: true,
          },
        },
      },
    });

    if (questions.length === 0) {
      return next(new ValidationError("No questions found for this event!"));
    }

    // Get random questions
    const randomQuestions = questions
      .sort(() => 0.5 - Math.random())
      .slice(0, questionLimit);

    res.status(200).json({
      success: true,
      questions: randomQuestions,
      total_available: questions.length,
    });
  } catch (error) {
    next(error);
  }
};

export const addEventQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { content, options, image_url } = req.body;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    if (!content || !options) {
      return next(new ValidationError("Content and options are required!"));
    }

    if (options.length < 2) {
      return next(new ValidationError("At least two options are required!"));
    }

    const correctOptions = options.filter((option: any) => option.is_correct);
    if (correctOptions.length !== 1) {
      return next(
        new ValidationError("Exactly one option must be marked as correct!")
      );
    }

    const question = await prisma.question.create({
      data: {
        content,
        image_url,
        event_id: id,
        questionOptions: {
          createMany: {
            data: options.map((option: any) => ({
              content: option.content,
              is_correct: option.is_correct || false,
            })),
          },
        },
      },
      include: {
        questionOptions: true,
      },
    });

    res.status(201).json({ success: true, question });
  } catch (error) {
    next(error);
  }
};

export const updateEventQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id, questionId } = req.params;
    const { content, options, image_url } = req.body;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    const existingQuestion = await prisma.question.findUnique({
      where: { id: questionId, event_id: id },
    });
    if (!existingQuestion) {
      return next(new ValidationError("Question not found!"));
    }

    if (options && options.length < 2) {
      return next(new ValidationError("At least two options are required!"));
    }

    if (options) {
      const correctOptions = options.filter((option: any) => option.is_correct);
      if (correctOptions.length !== 1) {
        return next(
          new ValidationError("Exactly one option must be marked as correct!")
        );
      }
    }

    const question = await prisma.question.update({
      where: { id: questionId },
      data: {
        content,
        image_url,
        ...(options && {
          questionOptions: {
            deleteMany: {},
            createMany: {
              data: options.map((option: any) => ({
                content: option.content,
                is_correct: option.is_correct || false,
              })),
            },
          },
        }),
      },
      include: {
        questionOptions: true,
      },
    });

    res.status(200).json({ success: true, question });
  } catch (error) {
    next(error);
  }
};

export const deleteEventQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id, questionId } = req.params;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId, event_id: id },
    });
    if (!question) {
      return next(new ValidationError("Question not found!"));
    }

    await prisma.question.delete({ where: { id: questionId } });
    res.status(200).json({ success: true, message: "Question deleted!" });
  } catch (error) {
    next(error);
  }
};

// ========== REWARD MANAGEMENT APIs ==========

export const playEvent = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;
    await checkPlayedRestrictions(user.email, next);

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const calculateEventReward = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { correct_answers, completion_time } = req.body; // Thêm completion_time

    const event = await prisma.event.findUnique({ where: { id } });

    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    const result = await calculateReward(
      user,
      event.id,
      correct_answers,
      completion_time
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const getEventLeaderboard = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { limit = 50, page = 1 } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100);
    const offset = (pageNum - 1) * limitNum;

    const event = await prisma.event.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        milestone_score: true,
        is_active: true,
      },
    });

    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    // Get leaderboard rewards
    const leaderboardRewards = await prisma.leaderboardReward.findMany({
      where: {
        event_id: id,
        is_active: true,
      },
      select: {
        id: true,
        title: true,
        description: true,
        rank_from: true,
        rank_to: true,
        voucherTemplates: {
          where: { is_active: true },
          select: {
            id: true,
            discount_value: true,
            type: true,
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

    // Get all scores for ranking
    const allScores = await prisma.eventScore.findMany({
      where: { event_id: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { score: "desc" },
        { completion_time: "asc" },
        { completed_at: "asc" },
      ],
    });

    // Calculate ranks and rewards
    const leaderboardWithRanks = allScores.map((entry, index) => {
      const rank = index + 1;
      const eligibleRewards = leaderboardRewards.filter(
        (reward) => rank >= reward.rank_from && rank <= reward.rank_to
      );

      return {
        rank,
        user: entry.user,
        score: entry.score,
        completion_time: entry.completion_time,
        completed_at: entry.completed_at,
        is_eligible_for_reward: eligibleRewards.length > 0,
        rewards: eligibleRewards,
      };
    });

    // Get paginated results
    const paginatedResults = leaderboardWithRanks.slice(
      offset,
      offset + limitNum
    );

    // Get current user's rank if requested
    let userRank;
    if (user && user.role !== "ADMIN") {
      const userEntry = leaderboardWithRanks.find(
        (entry) => entry.user.id === user.id
      );
      if (userEntry) {
        userRank = {
          rank: userEntry.rank,
          score: userEntry.score,
          completion_time: userEntry.completion_time,
        };
      }
    }

    res.status(200).json({
      success: true,
      data: {
        event,
        leaderboard: paginatedResults,
        total_participants: allScores.length,
        rewards: leaderboardRewards,
        ...(userRank && { user_rank: userRank }),
      },
    });
  } catch (error) {
    next(error);
  }
};

// API tổng kết và kết thúc event
export const finalizeEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { force_finalize = false } = req.body;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        leaderboardReward: {
          where: { is_active: true },
          include: {
            voucherTemplates: {
              where: { is_active: true },
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
          orderBy: { rank_from: "asc" },
        },
      },
    });

    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    // Check if event has ended (optional check, can be overridden with force_finalize)
    if (!force_finalize && new Date() < event.end_time) {
      return next(
        new ValidationError(
          "Event has not ended yet! Use force_finalize=true to override."
        )
      );
    }

    // Get final leaderboard
    const allScores = await prisma.eventScore.findMany({
      where: { event_id: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { score: "desc" },
        { completion_time: "asc" },
        { completed_at: "asc" },
      ],
    });

    if (allScores.length === 0) {
      return next(new ValidationError("No participants found for this event!"));
    }

    const distributionResults = [];
    let totalVouchersDistributed = 0;
    const errors: string[] = [];

    // Process each leaderboard reward
    for (const leaderboardReward of event.leaderboardReward) {
      if (leaderboardReward.voucherTemplates.length === 0) {
        continue;
      }

      // Get eligible participants for this reward tier
      const eligibleParticipants = allScores.slice(
        leaderboardReward.rank_from - 1,
        leaderboardReward.rank_to
      );

      if (eligibleParticipants.length === 0) {
        continue;
      }

      const voucherTemplate = leaderboardReward.voucherTemplates[0]; // Assuming one template per reward

      // Check which users haven't received vouchers for this reward yet
      const existingVouchers = await prisma.voucher.findMany({
        where: {
          voucher_template_id: voucherTemplate.id,
        },
        select: {
          user_id: true,
        },
      });

      const existingUserIds = new Set(existingVouchers.map((v) => v.user_id));
      const newEligibleParticipants = eligibleParticipants.filter(
        (p) => !existingUserIds.has(p.user.id)
      );

      if (newEligibleParticipants.length === 0) {
        continue;
      }

      // Get applicable product IDs for the Stripe coupon
      const stripeProductIds = voucherTemplate.voucherProducts
        .map((vp) => vp.product.stripe_product_id!)
        .filter(Boolean);

      // Create vouchers for each eligible participant
      for (const participant of newEligibleParticipants) {
        try {
          // Create Stripe coupon
          const couponData: Stripe.CouponCreateParams = {
            max_redemptions: 1,
            metadata: {
              userId: participant.user.id,
              eventId: id,
              voucherTemplateId: voucherTemplate.id,
              leaderboardRewardId: leaderboardReward.id,
              rank: (allScores.indexOf(participant) + 1).toString(),
            },
            redeem_by: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 days expiry
          };

          // Set discount type
          if (voucherTemplate.type === "PERCENT") {
            couponData.percent_off = voucherTemplate.discount_value;
          } else if (voucherTemplate.type === "AMOUNT") {
            couponData.amount_off = voucherTemplate.discount_value;
            couponData.currency = "vnd";
          }

          // Set applicable products for the coupon
          if (stripeProductIds.length > 0) {
            couponData.applies_to = { products: stripeProductIds };
          }

          const stripeCoupon = await stripe.coupons.create(couponData);

          // Create voucher record in database
          await prisma.voucher.create({
            data: {
              voucher_template_id: voucherTemplate.id,
              stripe_coupon_id: stripeCoupon.id,
              user_id: participant.user.id,
              expired_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
          });

          totalVouchersDistributed++;

          distributionResults.push({
            user: participant.user,
            rank: allScores.indexOf(participant) + 1,
            score: participant.score,
            completion_time: participant.completion_time,
            reward: {
              title: leaderboardReward.title,
              discount_type: voucherTemplate.type,
              discount_value: voucherTemplate.discount_value,
              rank_range: `${leaderboardReward.rank_from}-${leaderboardReward.rank_to}`,
            },
            voucher_id: stripeCoupon.id,
          });
        } catch (error) {
          next(
            `Failed to create voucher for user ${participant.user.id}: ${error}`
          );
        }
      }

      // Update user_count for this voucher template
      await prisma.voucherTemplate.update({
        where: { id: voucherTemplate.id },
        data: {
          user_count: {
            increment: newEligibleParticipants.length,
          },
        },
      });
    }

    // Mark event as inactive after finalization
    await prisma.event.update({
      where: { id },
      data: {
        is_active: false,
      },
    });

    res.status(200).json({
      success: true,
      message: "Event finalized and rewards distributed successfully!",
      summary: {
        event_title: event.title,
        total_participants: allScores.length,
        total_vouchers_distributed: totalVouchersDistributed,
        rewards_distributed: distributionResults.length,
        errors_count: errors.length,
        event_status: "finalized",
        finalized_at: new Date().toISOString(),
      },
      distribution_details: distributionResults,
      ...(errors.length > 0 && { errors }),
    });
  } catch (error) {
    next(error);
  }
};
