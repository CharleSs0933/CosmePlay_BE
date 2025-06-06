"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const isAuthenticated_1 = require("../packages/middleware/isAuthenticated");
const review_controller_1 = require("../controller/review.controller");
const router = express_1.default.Router();
router.post("/add", isAuthenticated_1.isAuthenticated, review_controller_1.addProductReview);
router.get("/:productId", review_controller_1.getProductReviews);
exports.default = router;
