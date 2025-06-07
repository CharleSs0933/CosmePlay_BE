import express from "express";

import {
  addProduct,
  addProductMeta,
  deleteProduct,
  getAllProducts,
  getProduct,
  getProductMeta,
  updateProduct,
} from "../controller/product.controller";
import {
  allowedRoles,
  isAuthenticated,
} from "../packages/middleware/isAuthenticated";

const router = express.Router();

router.get("/", getAllProducts);
router.post("/", isAuthenticated, allowedRoles(["admin", "staff"]), addProduct);
router.get("/meta", getProductMeta);
router.post(
  "/meta",
  isAuthenticated,
  allowedRoles(["admin", "staff"]),
  addProductMeta
);

router.put(
  "/:id",
  isAuthenticated,
  allowedRoles(["admin", "staff"]),
  updateProduct
);
router.delete(
  "/:id",
  isAuthenticated,
  allowedRoles(["admin", "staff"]),
  deleteProduct
);
router.get("/:id", getProduct);

export default router;
