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
exports.calculateEventReward = exports.playEvent = exports.deleteEventQuestion = exports.updateEventQuestion = exports.addEventQuestion = exports.get20QuestionsByEvent = exports.getAllQuestionsByEvent = exports.deleteEvent = exports.updateEvent = exports.addEvent = exports.getEvent = exports.getAllEvents = void 0;
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
                questionOptions: true,
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
                questionOptions: true,
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
const addEventQuestion = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { content, options, image_url } = req.body;
        const event = yield prisma_1.default.event.findUnique({ where: { id } });
        if (!event) {
            return next(new error_handler_1.ValidationError("Event not found!"));
        }
        if (!content || !options) {
            return next(new error_handler_1.ValidationError("Invalid question data!"));
        }
        if (options.length < 2) {
            return next(new error_handler_1.ValidationError("At least two options are required!"));
        }
        // Check if the options contain only one correct answer
        const correctOptions = options.filter((option) => option.is_correct);
        if (correctOptions.length !== 1) {
            return next(new error_handler_1.ValidationError("Exactly one option must be marked as correct!"));
        }
        const question = yield prisma_1.default.question.create({
            data: {
                content,
                image_url,
                event_id: id,
                questionOptions: {
                    createMany: {
                        data: options.map((option) => ({
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
    }
    catch (error) {
        next(error);
    }
});
exports.addEventQuestion = addEventQuestion;
const updateEventQuestion = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id, questionId } = req.params;
        const { content, options, image_url } = req.body;
        const event = yield prisma_1.default.event.findUnique({ where: { id } });
        if (!event) {
            return next(new error_handler_1.ValidationError("Event not found!"));
        }
        if (options.length < 2) {
            return next(new error_handler_1.ValidationError("At least two options are required!"));
        }
        // Check if the options contain only one correct answer
        const correctOptions = options.filter((option) => option.is_correct);
        if (correctOptions.length !== 1) {
            return next(new error_handler_1.ValidationError("Exactly one option must be marked as correct!"));
        }
        const question = yield prisma_1.default.question.update({
            where: { id: questionId },
            data: {
                content,
                image_url,
                questionOptions: {
                    deleteMany: {},
                    createMany: {
                        data: options.map((option) => ({
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
        res.status(200).json({ success: true, question });
    }
    catch (error) {
        next(error);
    }
});
exports.updateEventQuestion = updateEventQuestion;
const deleteEventQuestion = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id, questionId } = req.params;
        const event = yield prisma_1.default.event.findUnique({ where: { id } });
        if (!event) {
            return next(new error_handler_1.ValidationError("Event not found!"));
        }
        const question = yield prisma_1.default.question.findUnique({
            where: { id: questionId, event_id: id },
        });
        if (!question) {
            return next(new error_handler_1.ValidationError("Question not found!"));
        }
        yield prisma_1.default.question.delete({ where: { id: questionId } });
        res.status(200).json({ success: true, message: "Question deleted!" });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteEventQuestion = deleteEventQuestion;
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
