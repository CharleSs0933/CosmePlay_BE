import { NextFunction, Request, Response } from "express";
import prisma from "../libs/prisma";
import { validateEventData } from "../services/event.service";

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
      return next(new Error("Missing required fields!"));
    }

    const event = await prisma.event.findUnique({ where: { id } });

    if (!event) {
      return next(new Error("Event not found!"));
    }

    const existingReward = await prisma.eventReward.findMany({
      where: { event_id: id, min_correct },
    });

    if (existingReward) {
      return next(new Error("Reward with this min_correct already exists!"));
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
