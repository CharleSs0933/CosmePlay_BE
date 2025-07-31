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
exports.calculateEventReward = exports.playEvent = exports.deleteEventQuestion = exports.updateEventQuestion = exports.addEventQuestion = exports.getRandomQuestions = exports.getAllQuestionsByEvent = exports.deleteEvent = exports.updateEvent = exports.addEvent = exports.getEvent = exports.getAllEvents = void 0;
const prisma_1 = __importDefault(require("../libs/prisma"));
const event_service_1 = require("../services/event.service");
const error_handler_1 = require("../packages/error-handler");
// ========== EVENT MANAGEMENT APIs ==========
const getAllEvents = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { is_active, type } = req.query;
        const where = {};
        if (is_active !== undefined)
            where.is_active = is_active === "true";
        if (type)
            where.type = type;
        const events = yield prisma_1.default.event.findMany({
            where,
        });
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
        const event = yield prisma_1.default.event.findUnique({
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
                    },
                },
            },
        });
        if (!event) {
            return next(new error_handler_1.ValidationError("Event not found!"));
        }
        res.status(200).json({ success: true, event });
    }
    catch (error) {
        next(error);
    }
});
exports.getEvent = getEvent;
const addEvent = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, description, image_url, start_time, end_time, type, milestone_score = 100, is_active = true, } = req.body;
        if (!title || !start_time || !end_time) {
            return next(new error_handler_1.ValidationError("Title, start_time, and end_time are required!"));
        }
        if (new Date(start_time) >= new Date(end_time)) {
            return next(new error_handler_1.ValidationError("End time must be after start time!"));
        }
        const event = yield prisma_1.default.event.create({
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
    }
    catch (error) {
        next(error);
    }
});
exports.addEvent = addEvent;
const updateEvent = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const updateData = Object.assign({}, req.body);
        // Convert date strings to Date objects if provided
        if (updateData.start_time) {
            updateData.start_time = new Date(updateData.start_time);
        }
        if (updateData.end_time) {
            updateData.end_time = new Date(updateData.end_time);
        }
        const event = yield prisma_1.default.event.findUnique({ where: { id } });
        if (!event) {
            return next(new error_handler_1.ValidationError("Event not found!"));
        }
        const updatedEvent = yield prisma_1.default.event.update({
            where: { id },
            data: updateData,
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
            return next(new error_handler_1.ValidationError("Event not found!"));
        }
        yield prisma_1.default.event.delete({ where: { id } });
        res.status(200).json({ success: true, message: "Event deleted!" });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteEvent = deleteEvent;
// ========== QUESTION MANAGEMENT APIs ==========
const getAllQuestionsByEvent = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const event = yield prisma_1.default.event.findUnique({ where: { id } });
        if (!event) {
            return next(new error_handler_1.ValidationError("Event not found!"));
        }
        const questions = yield prisma_1.default.question.findMany({
            where: { event_id: id },
            include: {
                questionOptions: true,
            },
            orderBy: { id: "asc" },
        });
        res.status(200).json({ success: true, questions });
    }
    catch (error) {
        next(error);
    }
});
exports.getAllQuestionsByEvent = getAllQuestionsByEvent;
const getRandomQuestions = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { limit = 20 } = req.query;
        const questionLimit = Math.min(parseInt(limit), 50); // Max 50 questions
        const event = yield prisma_1.default.event.findUnique({ where: { id } });
        if (!event) {
            return next(new error_handler_1.ValidationError("Event not found!"));
        }
        const questions = yield prisma_1.default.question.findMany({
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
            return next(new error_handler_1.ValidationError("No questions found for this event!"));
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
    }
    catch (error) {
        next(error);
    }
});
exports.getRandomQuestions = getRandomQuestions;
const addEventQuestion = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { content, options, image_url } = req.body;
        const event = yield prisma_1.default.event.findUnique({ where: { id } });
        if (!event) {
            return next(new error_handler_1.ValidationError("Event not found!"));
        }
        if (!content || !options) {
            return next(new error_handler_1.ValidationError("Content and options are required!"));
        }
        if (options.length < 2) {
            return next(new error_handler_1.ValidationError("At least two options are required!"));
        }
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
                questionOptions: true,
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
        const existingQuestion = yield prisma_1.default.question.findUnique({
            where: { id: questionId, event_id: id },
        });
        if (!existingQuestion) {
            return next(new error_handler_1.ValidationError("Question not found!"));
        }
        if (options && options.length < 2) {
            return next(new error_handler_1.ValidationError("At least two options are required!"));
        }
        if (options) {
            const correctOptions = options.filter((option) => option.is_correct);
            if (correctOptions.length !== 1) {
                return next(new error_handler_1.ValidationError("Exactly one option must be marked as correct!"));
            }
        }
        const question = yield prisma_1.default.question.update({
            where: { id: questionId },
            data: Object.assign({ content,
                image_url }, (options && {
                questionOptions: {
                    deleteMany: {},
                    createMany: {
                        data: options.map((option) => ({
                            content: option.content,
                            is_correct: option.is_correct || false,
                        })),
                    },
                },
            })),
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
