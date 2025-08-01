import express from "express";

import {
  allowedRoles,
  isAuthenticated,
} from "../packages/middleware/isAuthenticated";
import {
  addEvent,
  addEventQuestion,
  calculateEventReward,
  deleteEvent,
  deleteEventQuestion,
  getAllEvents,
  getAllQuestionsByEvent,
  getEvent,
  getEventLeaderboard,
  getRandomQuestions,
  playEvent,
  updateEvent,
  updateEventQuestion,
} from "../controller/event.controller";
import {
  addLeaderboardReward,
  addVoucherToLeaderboardReward,
  deleteLeaderboardReward,
  getAllLeaderboardRewards,
  getLeaderboardReward,
  updateLeaderboardReward,
} from "../controller/leaderboardReward.controller";
import {
  addEventVoucherTemplate,
  deleteVoucherTemplate,
  getAllVoucherTemplates,
  getVoucherTemplate,
  updateVoucherTemplate,
} from "../controller/voucherTemplate.controller";

const router = express.Router();

const isAdminOrStaff = [isAuthenticated, allowedRoles(["admin", "staff"])];

// ========== Event Management Routes ==========
router.get("/get", getAllEvents);
router.get("/get/:id", getEvent);
router.put("/update/:id", isAdminOrStaff, updateEvent);
router.post("/add", isAdminOrStaff, addEvent);
router.delete("/:id", isAdminOrStaff, deleteEvent);

// ========== Event Question Management Routes ==========
router.get("/:id/questions", isAdminOrStaff, getAllQuestionsByEvent);
router.get("/:id/questions/random", isAuthenticated, getRandomQuestions);

router.post("/:id/questions/add", isAdminOrStaff, addEventQuestion);
router.put(
  "/:id/questions/update/:questionId",
  isAdminOrStaff,
  updateEventQuestion
);
router.delete(
  "/:id/questions/:questionId",
  isAdminOrStaff,
  deleteEventQuestion
);

// ========== Leaderboard Reward Routes ==========
router.get("/:id/rewards", isAdminOrStaff, getAllLeaderboardRewards);
router.get("/:id/rewards/:rewardId", isAdminOrStaff, getLeaderboardReward);
router.post("/:id/rewards", isAdminOrStaff, addLeaderboardReward);
router.put("/:id/rewards/:rewardId", isAdminOrStaff, updateLeaderboardReward);
router.delete(
  "/:id/rewards/:rewardId",
  isAdminOrStaff,
  deleteLeaderboardReward
);
router.post(
  "/:id/rewards/:rewardId/vouchers",
  isAdminOrStaff,
  addVoucherToLeaderboardReward
);

// ========== Voucher Template Routes ==========
router.get("/:id/voucher-templates", isAdminOrStaff, getAllVoucherTemplates);
router.get(
  "/:id/voucher-templates/:templateId",
  isAdminOrStaff,
  getVoucherTemplate
);
router.post("/:id/voucher-templates", isAdminOrStaff, addEventVoucherTemplate);
router.put(
  ":id/voucher-templates/:templateId",
  isAdminOrStaff,
  updateVoucherTemplate
);
router.delete(
  ":id/voucher-templates/:templateId",
  isAdminOrStaff,
  deleteVoucherTemplate
);

// ========== Game Play Routes ==========
router.get("/:id/leaderboard", getEventLeaderboard);
router.post("/play", isAuthenticated, playEvent);
router.post("/:id/calculate-reward", isAuthenticated, calculateEventReward);

export default router;
