"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateEventReward = exports.playEvent = exports.deleteEventReward = exports.updateEventReward = exports.addEventReward = exports.getEventReward = exports.get20QuestionsByEvent = exports.getAllQuestionsByEvent = exports.deleteEvent = exports.updateEvent = exports.addEvent = exports.getEvent = exports.getAllEvents = void 0;
const prisma_1 = __importDefault(require("../libs/prisma"));
const event_service_1 = require("../services/event.service");
const error_handler_1 = require("../packages/error-handler");
const getAllEvents = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const events = yield prisma_1.default.event.findMany({});
        res.status(200).json({ success: true, events });
    }
    catch (error) {
        next(error);
    }
});
exports.getAllEvents = getAllEvents;
const getEvent = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const event = yield prisma_1.default.event.findUnique({ where: { id } });
        res.status(200).json({ success: true, event });
    }
    catch (error) {
        next(error);
    }
});
exports.getEvent = getEvent;
const addEvent = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        (0, event_service_1.validateEventData)(req.body);
        const event = yield prisma_1.default.event.create({ data: req.body });
        res.status(201).json({ success: true, event });
    }
    catch (error) {
        next(error);
    }
});
exports.addEvent = addEvent;
const updateEvent = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const updatedData = Object.assign({}, req.body);
        const event = yield prisma_1.default.event.findUnique({
            where: { id },
        });
        if (!event) {
            return next(new Error("Event not found!"));
        }
        const updatedEvent = yield prisma_1.default.event.update({
            where: { id },
            data: updatedData,
        });
        res.status(200).json({ success: true, event: updatedEvent });
    }
    catch (error) {
        next(error);
    }
});
exports.updateEvent = updateEvent;
const deleteEvent = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const event = yield prisma_1.default.event.findUnique({ where: { id } });
        if (!event) {
            return next(new Error("Event not found!"));
        }
        yield prisma_1.default.event.delete({ where: { id } });
        res.status(200).json({ success: true, message: "Event deleted!" });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteEvent = deleteEvent;
const getAllQuestionsByEvent = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const event = yield prisma_1.default.event.findUnique({ where: { id } });
        if (!event) {
            return next(new Error("Event not found!"));
        }
        const questions = yield prisma_1.default.question.findMany({
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
    }
    catch (error) {
        next(error);
    }
});
exports.getAllQuestionsByEvent = getAllQuestionsByEvent;
const get20QuestionsByEvent = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const event = yield prisma_1.default.event.findUnique({ where: { id } });
        if (!event) {
            return next(new Error("Event not found!"));
        }
        const questions = yield prisma_1.default.question.findMany({
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
    }
    catch (error) {
        next(error);
    }
});
exports.get20QuestionsByEvent = get20QuestionsByEvent;
const getEventReward = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const event = yield prisma_1.default.event.findUnique({ where: { id } });
        if (!event) {
            return next(new Error("Event not found!"));
        }
        const eventRewards = yield prisma_1.default.eventReward.findMany({
            where: { event_id: id },
        });
        res.status(200).json({ success: true, eventRewards });
    }
    catch (error) {
        next(error);
    }
});
exports.getEventReward = getEventReward;
const addEventReward = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { min_correct, discount_value, type } = req.body;
        if (!min_correct ||
            !discount_value ||
            !type ||
            (type !== "AMOUNT" && type !== "PERCENT")) {
            return next(new error_handler_1.ValidationError("Missing required fields!"));
        }
        const event = yield prisma_1.default.event.findUnique({ where: { id } });
        if (!event) {
            return next(new error_handler_1.ValidationError("Event not found!"));
        }
        const existingReward = yield prisma_1.default.eventReward.findMany({
            where: { event_id: id, min_correct },
        });
        if (existingReward.length > 0) {
            return next(new error_handler_1.ValidationError("Reward with this min_correct already exists!"));
        }
        const eventReward = yield prisma_1.default.eventReward.create({
            data: {
                discount_value: parseFloat(discount_value),
                event_id: id,
                min_correct: parseInt(min_correct),
                type,
            },
        });
        res.status(201).json({ success: true, eventReward });
    }
    catch (error) {
        next(error);
    }
});
exports.addEventReward = addEventReward;
const updateEventReward = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id, rewardId } = req.params;
        const { min_correct, discount_value, type } = req.body;
        if (type && type !== "AMOUNT" && type !== "PERCENT") {
            return next(new error_handler_1.ValidationError("Invalid type!"));
        }
        const event = yield prisma_1.default.event.findUnique({ where: { id } });
        if (!event) {
            return next(new error_handler_1.ValidationError("Event not found!"));
        }
        const eventReward = yield prisma_1.default.eventReward.findUnique({
            where: { id: rewardId },
        });
        if (!eventReward) {
            return next(new error_handler_1.ValidationError("Reward not found!"));
        }
        if (eventReward.min_correct !== min_correct) {
            const existingReward = yield prisma_1.default.eventReward.findMany({
                where: { event_id: id, min_correct },
            });
            if (existingReward.length > 0) {
                return next(new error_handler_1.ValidationError("Reward with this min_correct already exists!"));
            }
        }
        const updatedEventReward = yield prisma_1.default.eventReward.update({
            where: { id: rewardId },
            data: {
                discount_value: discount_value ? parseFloat(discount_value) : undefined,
                min_correct: min_correct ? parseInt(min_correct) : undefined,
                type: type ? type : undefined,
            },
        });
        res.status(200).json({ success: true, eventReward: updatedEventReward });
    }
    catch (error) {
        next(error);
    }
});
exports.updateEventReward = updateEventReward;
const deleteEventReward = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id, rewardId } = req.params;
        const event = yield prisma_1.default.event.findUnique({ where: { id } });
        if (!event) {
            return next(new Error("Event not found!"));
        }
        const eventReward = yield prisma_1.default.eventReward.findUnique({
            where: { id: rewardId },
        });
        if (!eventReward) {
            return next(new Error("Reward not found!"));
        }
        yield prisma_1.default.eventReward.delete({ where: { id: rewardId } });
        res.status(200).json({ success: true, message: "Reward deleted!" });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteEventReward = deleteEventReward;
const playEvent = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        yield (0, event_service_1.checkPlayedRestrictions)(user.email, next);
        res.status(200).json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
exports.playEvent = playEvent;
const calculateEventReward = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const { id } = req.params;
        const { correct_answers } = req.body;
        const event = yield prisma_1.default.event.findUnique({ where: { id } });
        if (!event) {
            return next(new error_handler_1.ValidationError("Event not found!"));
        }
        const reward = yield (0, event_service_1.calculateReward)(user, event.id, correct_answers, next);
        res.status(200).json({
            success: true,
            reward: reward !== null && reward !== void 0 ? reward : null,
            message: reward
                ? "Coupon created successfully!"
                : "Not enough correct answers!",
        });
    }
    catch (error) {
        next(error);
    }
});
exports.calculateEventReward = calculateEventReward;
