import express from "express";
import {
  getUser,
  loginUser,
  refreshTokenUser,
  resetUserPassword,
  userForgotPassword,
  userRegistration,
  verifyUser,
  verifyUserForgotPassword,
} from "../controller/auth.controller";
import isAuthenticated from "../packages/middleware/isAuthenticated";

const router = express.Router();

router.post("/register", userRegistration);
router.post("/verify-user", verifyUser);
router.post("/login", loginUser);
router.post("/refresh-token", refreshTokenUser);
router.get("/logged-in-user", isAuthenticated, getUser);
router.post("/forgot-password", userForgotPassword);
router.post("/reset-password", resetUserPassword);
router.post("/verify-forgot-password", verifyUserForgotPassword);

export default router;
