"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_controller_1 = require("../controller/auth.controller");
const isAuthenticated_1 = __importDefault(require("../packages/middleware/isAuthenticated"));
const router = express_1.default.Router();
router.post("/register", auth_controller_1.userRegistration);
router.post("/verify-user", auth_controller_1.verifyUser);
router.post("/login", auth_controller_1.loginUser);
router.post("/refresh-token", auth_controller_1.refreshTokenUser);
router.get("/logged-in-user", isAuthenticated_1.default, auth_controller_1.getUser);
router.post("/forgot-password", auth_controller_1.userForgotPassword);
router.post("/reset-password", auth_controller_1.resetUserPassword);
router.post("/verify-forgot-password", auth_controller_1.verifyUserForgotPassword);
exports.default = router;
