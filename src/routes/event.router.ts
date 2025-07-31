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
  getRandomQuestions,
  playEvent,
  updateEvent,
  updateEventQuestion,
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
router.get("/:id/questions/random", isAuthenticated, getRandomQuestions);

router.post(
  "/:id/questions/add",
  isAuthenticated,
  allowedRoles(["admin", "staff"]),
  addEventQuestion
);
router.put(
  "/:id/questions/update/:questionId",
  isAuthenticated,
  allowedRoles(["admin", "staff"]),
  updateEventQuestion
);
router.delete(
  "/:id/questions/:questionId",
  isAuthenticated,
  allowedRoles(["admin", "staff"]),
  deleteEventQuestion
);

router.post("/play", isAuthenticated, playEvent);
router.post("/:id/calculate-reward", isAuthenticated, calculateEventReward);

export default router;
