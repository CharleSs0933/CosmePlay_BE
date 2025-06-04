import express from "express";

import { isAuthenticated } from "../packages/middleware/isAuthenticated";
import { createCheckoutSession } from "../controller/order.controller";

const router = express.Router();

router.post("/create-checkout-session", isAuthenticated, createCheckoutSession);

export default router;
