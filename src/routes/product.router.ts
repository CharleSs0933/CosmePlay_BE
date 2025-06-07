import express from "express";

import {
  addProduct,
  addProductMeta,
  deleteProduct,
  deleteProductMeta,
  getAllProducts,
  getProduct,
  getProductMeta,
  updateProduct,
  updateProductMeta,
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
  "/meta/:id",
  isAuthenticated,
  allowedRoles(["admin", "staff"]),
  updateProductMeta
);

router.delete(
  "/meta/:id",
  isAuthenticated,
  allowedRoles(["admin", "staff"]),
  deleteProductMeta
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
