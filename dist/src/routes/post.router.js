"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const post_controller_1 = require("../controller/post.controller");
const router = express_1.default.Router();
router.get("/", post_controller_1.getAllPosts);
router.get("/:category", post_controller_1.getPost);
exports.default = router;
