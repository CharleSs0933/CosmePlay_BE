import express from "express";

import {
  allowedRoles,
  isAuthenticated,
} from "../packages/middleware/isAuthenticated";
import {
  createCheckoutSession,
  getAllOrders,
  getOrderDetail,
  getOrdersByUser,
  updateOrderStatus,
} from "../controller/order.controller";

const router = express.Router();

router.post("/create-checkout-session", isAuthenticated, createCheckoutSession);
router.get("/", isAuthenticated, getOrdersByUser);
router.get("/details/:id", getOrderDetail);
router.get(
  "/all",
  isAuthenticated,
  allowedRoles(["admin", "staff"]),
  getAllOrders
);
router.put(
  "/update/:id",
  isAuthenticated,
  allowedRoles(["admin", "staff"]),
  updateOrderStatus
);

export default router;
