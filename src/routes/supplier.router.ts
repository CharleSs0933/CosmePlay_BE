import express from "express";

import { getAllSuppliers } from "../controller/supplier.controller";

const router = express.Router();

router.get("/", getAllSuppliers);

export default router;
