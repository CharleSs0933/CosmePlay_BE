import express from "express";

import {
  addProduct,
  getAllProducts,
  getProduct,
  getProductMeta,
} from "../controller/product.controller";
import {
  allowedRoles,
  isAuthenticated,
} from "../packages/middleware/isAuthenticated";

const router = express.Router();

router.get("/", getAllProducts);
router.get("/meta", getProductMeta);
router.post("/", isAuthenticated, allowedRoles(["admin", "staff"]), addProduct);
router.get("/:id", getProduct);

export default router;
