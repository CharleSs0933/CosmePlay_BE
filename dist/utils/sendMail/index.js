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
exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const dotenv_1 = __importDefault(require("dotenv"));
const ejs_1 = __importDefault(require("ejs"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const transporter = nodemailer_1.default.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    service: process.env.SMTP_SERVICE,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
});
// Render an EJS email template
const renderEmailTemplate = (templateName, data) => __awaiter(void 0, void 0, void 0, function* () {
    const templePath = path_1.default.join(process.cwd(), "src", "utils", "email-templates", `${templateName}.ejs`);
    return ejs_1.default.renderFile(templePath, data);
});
// Send an email using nodemailer
const sendEmail = (to, subject, templateName, data) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const html = yield renderEmailTemplate(templateName, data);
        yield transporter.sendMail({
            from: `<${process.env.SMTP_USER}`,
            to,
            subject,
            html,
        });
        return true;
    }
    catch (error) {
        console.log("Error sending email:", error);
        return false;
    }
});
exports.sendEmail = sendEmail;
