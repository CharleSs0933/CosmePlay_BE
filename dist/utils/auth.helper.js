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
exports.sendOtp = exports.trackOtpRequests = exports.checkOtpRestrictions = exports.validateRegistrationData = void 0;
const error_handler_1 = require("../packages/error-handler");
const crypto_1 = __importDefault(require("crypto"));
const redis_1 = __importDefault(require("../packages/libs/redis"));
const sendMail_1 = require("./sendMail");
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validateRegistrationData = (data) => {
    const { name, email, password } = data;
    if (!name || !email || !password) {
        throw new error_handler_1.ValidationError("Missing required fields!");
    }
    if (!emailRegex.test(email)) {
        throw new error_handler_1.ValidationError("Invalid email format!");
    }
};
exports.validateRegistrationData = validateRegistrationData;
const checkOtpRestrictions = (email, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (yield redis_1.default.get(`otp_lock:${email}`)) {
        return next(new error_handler_1.ValidationError("Account locked due to multiple failed attempts! Try again after 30 minutes."));
    }
    if (yield redis_1.default.get(`otp_spam_lock:${email}`)) {
        return next(new error_handler_1.ValidationError("Too many OTP requests! Please wait 1hour before requesting again."));
    }
    if (yield redis_1.default.get(`otp_cooldown:${email}`)) {
        return next(new error_handler_1.ValidationError("Please wait 1 minute before requesting a new OTP."));
    }
});
exports.checkOtpRestrictions = checkOtpRestrictions;
const trackOtpRequests = (email, next) => __awaiter(void 0, void 0, void 0, function* () {
    const otpRequestKey = `otp_request_count:${email}`;
    let otpRequests = parseInt((yield redis_1.default.get(otpRequestKey)) || "0");
    if (otpRequests >= 2) {
        yield redis_1.default.set(`otp_spam_lock:${email}`, "locked", "EX", 3600); // Lock for 1 hour
        return next(new error_handler_1.ValidationError("Too many OTP requests! Please wait 1 hour before requesting again."));
    }
    yield redis_1.default.set(otpRequestKey, otpRequests + 1, "EX", 3600); // Increment request count and set expiration to 1 minute
});
exports.trackOtpRequests = trackOtpRequests;
const sendOtp = (name, email, template) => __awaiter(void 0, void 0, void 0, function* () {
    const otp = crypto_1.default.randomInt(1000, 9999).toString();
    yield (0, sendMail_1.sendEmail)(email, "Verify Your Email", template, { name, otp });
    yield redis_1.default.set(`otp:${email}`, otp, "EX", 300); // Store OTP in Redis with 5 minutes expiration
    yield redis_1.default.set(`otp_cooldown:${email}`, "true", "EX", 60); // Set cooldown for OTP sending
});
exports.sendOtp = sendOtp;
