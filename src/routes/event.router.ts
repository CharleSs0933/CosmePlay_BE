import express from "express";

import {
  allowedRoles,
  isAuthenticated,
} from "../packages/middleware/isAuthenticated";
import {
  addEvent,
  addEventReward,
  calculateEventReward,
  deleteEvent,
  deleteEventReward,
  get20QuestionsByEvent,
  getAllEvents,
  getAllQuestionsByEvent,
  getEvent,
  getEventReward,
  playEvent,
  updateEvent,
  updateEventReward,
} from "../controller/event.controller";

const router = express.Router();

router.get("/get", getAllEvents);
router.get("/get/:id", getEvent);
router.put(
  "/update/:id",
  isAuthenticated,
  allowedRoles(["admin", "staff"]),
  updateEvent
);
router.post(
  "/add",
  isAuthenticated,
  allowedRoles(["admin", "staff"]),
  addEvent
);
router.delete(
  "/:id",
  isAuthenticated,
  allowedRoles(["admin", "staff"]),
  deleteEvent
);
router.get(
  "/:id/questions",
  isAuthenticated,
  allowedRoles(["admin", "staff"]),
  getAllQuestionsByEvent
);
router.get("/:id/questions/random", isAuthenticated, get20QuestionsByEvent);
router.get("/:id/rewards", getEventReward);
router.post(
  "/:id/rewards/add",
  isAuthenticated,
  allowedRoles(["admin", "staff"]),
  addEventReward
);
router.put(
  "/:id/rewards/update/:rewardId",
  isAuthenticated,
  allowedRoles(["admin", "staff"]),
  updateEventReward
);
router.delete(
  "/:id/rewards/:rewardId",
  isAuthenticated,
  allowedRoles(["admin", "staff"]),
  deleteEventReward
);
router.post("/play", isAuthenticated, playEvent);
router.post("/:id/calculate-reward", isAuthenticated, calculateEventReward);

export default router;
