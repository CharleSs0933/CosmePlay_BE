import express from "express";

import { isAuthenticated } from "../packages/middleware/isAuthenticated";
import {
  createCheckoutSession,
  createOrder,
  getOrderDetail,
  getOrdersByUser,
} from "../controller/order.controller";

const router = express.Router();

router.post("/create-checkout-session", isAuthenticated, createCheckoutSession);
router.get("/", isAuthenticated, getOrdersByUser);
router.get("/details/:id", getOrderDetail);

export default router;
