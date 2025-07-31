import { NextFunction, Request, Response } from "express";
import prisma from "../libs/prisma";
import {
  calculateReward,
  checkPlayedRestrictions,
} from "../services/event.service";
import { ValidationError } from "../packages/error-handler";

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
            is_active: true,
            voucherProducts: {
              select: {
                product: {
                  select: {
                    id: true,
                    title: true,
                    image_url: true,
                    price: true,
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
            // Don't include is_correct for security
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
    const { correct_answers } = req.body;

    const event = await prisma.event.findUnique({ where: { id } });

    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    const reward = await calculateReward(user, event.id, correct_answers, next);

    res.status(200).json({
      success: true,
      reward: reward ?? null,
      message: reward
        ? "Coupon created successfully!"
        : "Not enough correct answers!",
    });
  } catch (error) {
    next(error);
  }
};
