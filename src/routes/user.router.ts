import express from "express";

import { getAllUsers, getUser } from "../controller/user.controller";
import {
  allowedRoles,
  isAuthenticated,
} from "../packages/middleware/isAuthenticated";

const router = express.Router();

router.get("/", isAuthenticated, allowedRoles(["admin"]), getAllUsers);
router.get("/:id", isAuthenticated, allowedRoles(["admin"]), getUser);

export default router;
