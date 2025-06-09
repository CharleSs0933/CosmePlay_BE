import express from "express";

import {
  createUser,
  getAllUsers,
  getUser,
  updateUser,
} from "../controller/user.controller";
import {
  allowedRoles,
  isAuthenticated,
} from "../packages/middleware/isAuthenticated";

const router = express.Router();

router.get("/", isAuthenticated, allowedRoles(["admin"]), getAllUsers);
router.get("/:id", isAuthenticated, allowedRoles(["admin"]), getUser);
router.post("/add", isAuthenticated, allowedRoles(["admin"]), createUser);
router.put("/update/:id", isAuthenticated, allowedRoles(["admin"]), updateUser);

export default router;
