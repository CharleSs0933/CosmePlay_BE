"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const isAuthenticated_1 = require("../packages/middleware/isAuthenticated");
const event_controller_1 = require("../controller/event.controller");
const leaderboardReward_controller_1 = require("../controller/leaderboardReward.controller");
const voucherTemplate_controller_1 = require("../controller/voucherTemplate.controller");
const router = express_1.default.Router();
const isAdminOrStaff = [isAuthenticated_1.isAuthenticated, (0, isAuthenticated_1.allowedRoles)(["admin", "staff"])];
// ========== Event Management Routes ==========
router.get("/get", event_controller_1.getAllEvents);
router.get("/get/:id", event_controller_1.getEvent);
router.put("/update/:id", isAdminOrStaff, event_controller_1.updateEvent);
router.post("/add", isAdminOrStaff, event_controller_1.addEvent);
router.delete("/:id", isAdminOrStaff, event_controller_1.deleteEvent);
// ========== Event Question Management Routes ==========
router.get("/:id/questions", isAdminOrStaff, event_controller_1.getAllQuestionsByEvent);
router.get("/:id/questions/random", isAuthenticated_1.isAuthenticated, event_controller_1.getRandomQuestions);
router.post("/:id/questions/add", isAdminOrStaff, event_controller_1.addEventQuestion);
router.put("/:id/questions/update/:questionId", isAdminOrStaff, event_controller_1.updateEventQuestion);
router.delete("/:id/questions/:questionId", isAdminOrStaff, event_controller_1.deleteEventQuestion);
// ========== Leaderboard Reward Routes ==========
router.get("/:id/rewards", isAdminOrStaff, leaderboardReward_controller_1.getAllLeaderboardRewards);
router.get("/:id/rewards/:rewardId", isAdminOrStaff, leaderboardReward_controller_1.getLeaderboardReward);
router.post("/:id/rewards", isAdminOrStaff, leaderboardReward_controller_1.addLeaderboardReward);
router.put("/:id/rewards/:rewardId", isAdminOrStaff, leaderboardReward_controller_1.updateLeaderboardReward);
router.delete("/:id/rewards/:rewardId", isAdminOrStaff, leaderboardReward_controller_1.deleteLeaderboardReward);
router.post("/:id/rewards/:rewardId/vouchers", isAdminOrStaff, leaderboardReward_controller_1.addVoucherToLeaderboardReward);
// ========== Voucher Template Routes ==========
router.get("/:id/voucher-templates", isAdminOrStaff, voucherTemplate_controller_1.getAllVoucherTemplates);
router.get("/:id/voucher-templates/:templateId", isAdminOrStaff, voucherTemplate_controller_1.getVoucherTemplate);
router.post("/:id/voucher-templates", isAdminOrStaff, voucherTemplate_controller_1.addEventVoucherTemplate);
router.put(":id/voucher-templates/:templateId", isAdminOrStaff, voucherTemplate_controller_1.updateVoucherTemplate);
router.delete(":id/voucher-templates/:templateId", isAdminOrStaff, voucherTemplate_controller_1.deleteVoucherTemplate);
// ========== Game Play Routes ==========
router.get("/:id/leaderboard", event_controller_1.getEventLeaderboard);
router.post("/play", isAuthenticated_1.isAuthenticated, event_controller_1.playEvent);
router.post("/:id/calculate-reward", isAuthenticated_1.isAuthenticated, event_controller_1.calculateEventReward);
exports.default = router;
