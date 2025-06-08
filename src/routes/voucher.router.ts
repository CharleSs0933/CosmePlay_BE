import express from "express";

import {
  allowedRoles,
  isAuthenticated,
} from "../packages/middleware/isAuthenticated";

import {
  getAllVouchers,
  getVouchersByUser,
} from "../controller/voucher.controller";

const router = express.Router();

router.post("/", isAuthenticated, getVouchersByUser);
router.get(
  "/all",
  isAuthenticated,
  allowedRoles(["admin", "staff"]),
  getAllVouchers
);

export default router;
