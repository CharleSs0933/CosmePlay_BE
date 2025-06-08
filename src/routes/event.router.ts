import express from "express";

import {
  allowedRoles,
  isAuthenticated,
} from "../packages/middleware/isAuthenticated";
import {
  addEvent,
  get20QuestionsByEvent,
  getAllEvents,
  getAllQuestionsByEvent,
  getEvent,
  updateEvent,
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
router.get(
  "/:id/questions",
  isAuthenticated,
  allowedRoles(["admin", "staff"]),
  getAllQuestionsByEvent
);
router.get("/:id/questions/random", isAuthenticated, get20QuestionsByEvent);

export default router;
