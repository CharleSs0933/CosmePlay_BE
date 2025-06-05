import express from "express";

import { isAuthenticated } from "../packages/middleware/isAuthenticated";
import {
  addAddress,
  deleteAddress,
  getAddressesByUser,
  updateAddress,
} from "../controller/address.controller";

const router = express.Router();

router.get("/get", isAuthenticated, getAddressesByUser);
router.post("/add", isAuthenticated, addAddress);
router.delete("/:id", isAuthenticated, deleteAddress);
router.put("/:id", isAuthenticated, updateAddress);

export default router;
