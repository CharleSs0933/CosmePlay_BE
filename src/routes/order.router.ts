import express from "express";

import { isAuthenticated } from "../packages/middleware/isAuthenticated";
import {
  createCheckoutSession,
  createOrder,
} from "../controller/order.controller";

const router = express.Router();

router.post("/create-checkout-session", isAuthenticated, createCheckoutSession);
router.post(
  "/stripe/webhook",
  express.raw({ type: "application/json" }),
  createOrder
);

export default router;
