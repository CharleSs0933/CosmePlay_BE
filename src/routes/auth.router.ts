import express from "express";
import { userRegistration, verifyUser } from "../controller/auth.controller";

const router = express.Router();

router.post("/register", userRegistration);
router.post("/verify-user", verifyUser);

export default router;
