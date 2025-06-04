"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const isAuthenticated_1 = require("../packages/middleware/isAuthenticated");
const order_controller_1 = require("../controller/order.controller");
const router = express_1.default.Router();
router.post("/create-checkout-session", isAuthenticated_1.isAuthenticated, order_controller_1.createCheckoutSession);
router.post("/stripe/webhook", order_controller_1.createOrder);
exports.default = router;
