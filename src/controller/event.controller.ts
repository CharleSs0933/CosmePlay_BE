import { NextFunction, Request, Response } from "express";
import prisma from "../libs/prisma";
import {
  calculateReward,
  checkPlayedRestrictions,
  validateEventData,
} from "../services/event.service";
import { ValidationError } from "../packages/error-handler";
import { QuestionOption } from "@prisma/client";

export const getAllEvents = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const events = await prisma.event.findMany({});
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
    const event = await prisma.event.findUnique({ where: { id } });
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
    validateEventData(req.body);

    const event = await prisma.event.create({ data: req.body });

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
    const updatedData = { ...req.body };

    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      return next(new Error("Event not found!"));
    }

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: updatedData,
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
      return next(new Error("Event not found!"));
    }

    await prisma.event.delete({ where: { id } });

    res.status(200).json({ success: true, message: "Event deleted!" });
  } catch (error) {
    next(error);
  }
};

export const getAllQuestionsByEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findUnique({ where: { id } });

    if (!event) {
      return next(new Error("Event not found!"));
    }

    const questions = await prisma.question.findMany({
      where: { event_id: id },
      include: {
        questionOptions: {
          select: {
            content: true,
            is_correct: true,
          },
        },
      },
    });

    res.status(200).json({ success: true, questions });
  } catch (error) {
    next(error);
  }
};

export const get20QuestionsByEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findUnique({ where: { id } });

    if (!event) {
      return next(new Error("Event not found!"));
    }

    const questions = await prisma.question.findMany({
      where: { event_id: id },
      include: {
        questionOptions: {
          select: {
            content: true,
            is_correct: true,
          },
        },
      },
    });

    // Get random 20 questions
    const randomQuestions = questions
      .sort(() => 0.5 - Math.random())
      .slice(0, 20);

    res.status(200).json({ success: true, questions: randomQuestions });
  } catch (error) {
    next(error);
  }
};

export const getEventReward = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findUnique({ where: { id } });

    if (!event) {
      return next(new Error("Event not found!"));
    }

    const eventRewards = await prisma.eventReward.findMany({
      where: { event_id: id },
    });

    res.status(200).json({ success: true, eventRewards });
  } catch (error) {
    next(error);
  }
};

export const addEventReward = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { min_correct, discount_value, type } = req.body;

    if (
      !min_correct ||
      !discount_value ||
      !type ||
      (type !== "AMOUNT" && type !== "PERCENT")
    ) {
      return next(new ValidationError("Missing required fields!"));
    }

    const event = await prisma.event.findUnique({ where: { id } });

    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    const existingReward = await prisma.eventReward.findMany({
      where: { event_id: id, min_correct },
    });

    if (existingReward.length > 0) {
      return next(
        new ValidationError("Reward with this min_correct already exists!")
      );
    }

    const eventReward = await prisma.eventReward.create({
      data: {
        discount_value: parseFloat(discount_value),
        event_id: id,
        min_correct: parseInt(min_correct),
        type,
      },
    });

    res.status(201).json({ success: true, eventReward });
  } catch (error) {
    next(error);
  }
};

export const updateEventReward = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id, rewardId } = req.params;
    const { min_correct, discount_value, type } = req.body;

    if (type && type !== "AMOUNT" && type !== "PERCENT") {
      return next(new ValidationError("Invalid type!"));
    }

    const event = await prisma.event.findUnique({ where: { id } });

    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    const eventReward = await prisma.eventReward.findUnique({
      where: { id: rewardId },
    });

    if (!eventReward) {
      return next(new ValidationError("Reward not found!"));
    }

    if (eventReward.min_correct !== min_correct) {
      const existingReward = await prisma.eventReward.findMany({
        where: { event_id: id, min_correct },
      });

      if (existingReward.length > 0) {
        return next(
          new ValidationError("Reward with this min_correct already exists!")
        );
      }
    }

    const updatedEventReward = await prisma.eventReward.update({
      where: { id: rewardId },
      data: {
        discount_value: discount_value ? parseFloat(discount_value) : undefined,
        min_correct: min_correct ? parseInt(min_correct) : undefined,
        type: type ? type : undefined,
      },
    });

    res.status(200).json({ success: true, eventReward: updatedEventReward });
  } catch (error) {
    next(error);
  }
};

export const deleteEventReward = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id, rewardId } = req.params;

    const event = await prisma.event.findUnique({ where: { id } });

    if (!event) {
      return next(new Error("Event not found!"));
    }

    const eventReward = await prisma.eventReward.findUnique({
      where: { id: rewardId },
    });

    if (!eventReward) {
      return next(new Error("Reward not found!"));
    }

    await prisma.eventReward.delete({ where: { id: rewardId } });

    res.status(200).json({ success: true, message: "Reward deleted!" });
  } catch (error) {
    next(error);
  }
};

export const addEventQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  const { content, options, image_url } = req.body;

  try {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return next(new ValidationError("Event not found!"));
    }

    if (!content || !options) {
      return next(new ValidationError("Invalid question data!"));
    }

    if (options.length < 2) {
      return next(new ValidationError("At least two options are required!"));
    }

    // Check if the options contain only one correct answer
    const correctOptions = options.filter(
      (option: QuestionOption) => option.is_correct
    );

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
            data: options.map((option: QuestionOption) => ({
              content: option.content,
              is_correct: option.is_correct || false,
            })),
          },
        },
      },
      include: {
        questionOptions: {
          select: {
            content: true,
            is_correct: true,
          },
        },
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

    if (options.length < 2) {
      return next(new ValidationError("At least two options are required!"));
    }

    // Check if the options contain only one correct answer
    const correctOptions = options.filter(
      (option: QuestionOption) => option.is_correct
    );

    if (correctOptions.length !== 1) {
      return next(
        new ValidationError("Exactly one option must be marked as correct!")
      );
    }

    const question = await prisma.question.update({
      where: { id: questionId },
      data: {
        content,
        image_url,
        questionOptions: {
          deleteMany: {},
          createMany: {
            data: options.map((option: QuestionOption) => ({
              content: option.content,
              is_correct: option.is_correct || false,
            })),
          },
        },
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
