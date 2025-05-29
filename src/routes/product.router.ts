import express from "express";

import isAuthenticated from "../packages/middleware/isAuthenticated";
import { getAllProducts } from "../controller/product.controller";

const router = express.Router();

router.get("/", getAllProducts);

export default router;
