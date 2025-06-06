import express from "express";

import { isAuthenticated } from "../packages/middleware/isAuthenticated";
import {
  addProductReview,
  getProductReviews,
} from "../controller/review.controller";

const router = express.Router();

router.post("/add", isAuthenticated, addProductReview);
router.get("/:productId", getProductReviews);

export default router;
