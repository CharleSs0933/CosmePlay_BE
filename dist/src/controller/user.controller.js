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
exports.updateUser = exports.createUser = exports.getUser = exports.getAllUsers = void 0;
const prisma_1 = __importDefault(require("../libs/prisma"));
const error_handler_1 = require("../packages/error-handler");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const getAllUsers = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { keyword, page = 1, limit = 10, role } = req.query;
        const pageNumber = parseInt(page, 10);
        const pageSize = parseInt(limit, 10) || 10;
        const filter = {};
        if (keyword)
            filter.OR = [
                { name: { contains: keyword } },
                { email: { contains: keyword } },
            ];
        if (role) {
            if (role !== "ADMIN" && role !== "STAFF" && role !== "USER") {
                throw new error_handler_1.ValidationError("Invalid role");
            }
            filter.role = role;
        }
        const { users, totalUsers } = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            //   Get all users based on keyword and role
            const users = yield tx.user.findMany({
                where: filter,
                skip: (pageNumber - 1) * pageSize,
                take: pageSize,
                omit: {
                    password: true,
                },
            });
            const totalUsers = yield prisma_1.default.user.count({
                where: filter,
            });
            return { users, totalUsers };
        }));
        res.status(200).json({
            success: true,
            users,
            pagination: {
                total: totalUsers,
                page: pageNumber,
                pageSize,
                totalPages: Math.ceil(totalUsers / pageSize),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getAllUsers = getAllUsers;
const getUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const user = yield prisma_1.default.user.findUnique({
            where: { id },
            omit: {
                password: true,
            },
        });
        if (!user) {
            return next(new error_handler_1.ValidationError("User not found!"));
        }
        res.status(200).json({ success: true, user });
    }
    catch (error) {
        next(error);
    }
});
exports.getUser = getUser;
const createUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, email, password, role, phone } = req.body;
        if (!name ||
            !email ||
            !password ||
            !role ||
            (role !== "ADMIN" && role !== "STAFF" && role !== "USER")) {
            return next(new error_handler_1.ValidationError("Invalid request!"));
        }
        const existingUser = yield prisma_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            return next(new error_handler_1.ValidationError("User already exists with this email!"));
        }
        const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
        const user = yield prisma_1.default.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                phone,
                role,
            },
            omit: {
                password: true,
            },
        });
        res.status(201).json({ success: true, user });
    }
    catch (error) {
        next(error);
    }
});
exports.createUser = createUser;
const updateUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { name, email, password, role, phone } = req.body;
        if (role && role !== "ADMIN" && role !== "STAFF" && role !== "USER") {
            return next(new error_handler_1.ValidationError("Invalid role"));
        }
        if (password) {
            const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
            yield prisma_1.default.user.update({
                where: { id },
                data: {
                    password: hashedPassword,
                },
            });
        }
        const user = yield prisma_1.default.user.update({
            where: { id },
            data: {
                name,
                email,
                role,
                phone,
            },
            omit: {
                password: true,
            },
        });
        res.status(200).json({ success: true, user });
    }
    catch (error) {
        next(error);
    }
});
exports.updateUser = updateUser;
