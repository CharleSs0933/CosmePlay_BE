import express from "express";

import {
  getAllProducts,
  getProduct,
  getProductMeta,
} from "../controller/product.controller";

const router = express.Router();

router.get("/", getAllProducts);
router.get("/meta", getProductMeta);
router.get("/:id", getProduct);

export default router;
