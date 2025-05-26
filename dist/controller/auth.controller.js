"use strict";
// Register a new user
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
exports.resetUserPassword = exports.verifyUserForgotPassword = exports.userForgotPassword = exports.loginUser = exports.verifyUser = exports.userRegistration = void 0;
const auth_helper_1 = require("../utils/auth.helper");
const prisma_1 = __importDefault(require("../packages/libs/prisma"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const error_handler_1 = require("../packages/error-handler");
const setCookie_1 = require("../utils/cookies/setCookie");
// Register a new user
const userRegistration = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        (0, auth_helper_1.validateRegistrationData)(req.body);
        const { name, email } = req.body;
        const existingUser = yield prisma_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            return next(new error_handler_1.ValidationError("User already exists with this email!"));
        }
        yield (0, auth_helper_1.checkOtpRestrictions)(email, next);
        yield (0, auth_helper_1.trackOtpRequests)(email, next);
        yield (0, auth_helper_1.sendOtp)(name, email, "user-activation-mail");
        res.status(200).json({
            message: "OTP sent to email. Please verify your account.",
        });
    }
    catch (error) {
        return next(error);
    }
});
exports.userRegistration = userRegistration;
// Verify OTP
const verifyUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, otp, password, name } = req.body;
        if (!email || !otp || !password || !name) {
            return next(new error_handler_1.ValidationError("All fields are required!"));
        }
        const existingUser = yield prisma_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            return next(new error_handler_1.ValidationError("User already exists with this email!"));
        }
        yield (0, auth_helper_1.verifyOtp)(email, otp, next);
        const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
        yield prisma_1.default.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
            },
        });
        res.status(201).json({
            success: true,
            message: "User registered successfully!",
        });
    }
    catch (error) {
        return next(error);
    }
});
exports.verifyUser = verifyUser;
// Login User
const loginUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return next(new error_handler_1.ValidationError("Email and password are required!"));
        }
        const user = yield prisma_1.default.user.findUnique({ where: { email } });
        if (!user) {
            return next(new error_handler_1.AuthError("User doesn't exist!"));
        }
        // Verify password
        const isMatch = yield bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            return next(new error_handler_1.ValidationError("Invalid email or password"));
        }
        // Generate access and refresh tokens
        const accessToken = jsonwebtoken_1.default.sign({ id: user.id, role: user.role }, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: "15m",
        });
        const refreshToken = jsonwebtoken_1.default.sign({ id: user.id, role: user.role }, process.env.REFRESH_TOKEN_SECRET, {
            expiresIn: "7d",
        });
        // Store the refresh and access tokens in an httpOnly secure cookie
        (0, setCookie_1.setCookie)(res, "refresh_token", refreshToken);
        (0, setCookie_1.setCookie)(res, "access_token", accessToken);
        res.status(200).json({
            success: true,
            message: "Login successfully!",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.loginUser = loginUser;
// User forgot password
const userForgotPassword = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, auth_helper_1.handleForgotPassword)(req, res, next);
});
exports.userForgotPassword = userForgotPassword;
// Verify OTP for forgot password
const verifyUserForgotPassword = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, auth_helper_1.verifyForgotPasswordOtp)(req, res, next);
});
exports.verifyUserForgotPassword = verifyUserForgotPassword;
// Reset user password
const resetUserPassword = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, newPassword } = req.body;
        if (!email || !newPassword) {
            return next(new error_handler_1.ValidationError("Email and new password are required!"));
        }
        const user = yield prisma_1.default.user.findUnique({ where: { email } });
        if (!user) {
            return next(new error_handler_1.ValidationError("User not found!"));
        }
        // Compare the new password with the existing one
        const isSamePassword = yield bcryptjs_1.default.compare(newPassword, user.password);
        if (isSamePassword) {
            return next(new error_handler_1.ValidationError("New password cannot be the same as the old one!"));
        }
        // Hash the new password
        const hashedPassword = yield bcryptjs_1.default.hash(newPassword, 10);
        yield prisma_1.default.user.update({
            where: { email },
            data: {
                password: hashedPassword,
            },
        });
        res.status(200).json({
            message: "Password reset successfully!",
        });
    }
    catch (error) {
        next(error);
    }
});
exports.resetUserPassword = resetUserPassword;
