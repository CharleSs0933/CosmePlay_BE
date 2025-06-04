import express from "express";

import { isAuthenticated } from "../packages/middleware/isAuthenticated";
import {
  createCheckoutSession,
  createOrder,
} from "../controller/order.controller";

const router = express.Router();

router.post("/create-checkout-session", isAuthenticated, createCheckoutSession);
router.post("/stripe/webhook", createOrder);

export default router;
