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
exports.userRegistration = void 0;
const auth_helper_1 = require("../utils/auth.helper");
const prisma_1 = __importDefault(require("../packages/libs/prisma"));
const error_handler_1 = require("../packages/error-handler");
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
