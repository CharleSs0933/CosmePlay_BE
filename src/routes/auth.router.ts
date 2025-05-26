import express from "express";
import {
  loginUser,
  resetUserPassword,
  userForgotPassword,
  userRegistration,
  verifyUser,
  verifyUserForgotPassword,
} from "../controller/auth.controller";

const router = express.Router();

router.post("/register", userRegistration);
router.post("/verify-user", verifyUser);
router.post("/login", loginUser);
router.post("/forgot-password", userForgotPassword);
router.post("/reset-password", resetUserPassword);
router.post("/verify-forgot-password", verifyUserForgotPassword);

export default router;
