import express from "express";
import {
  addToCart,
  deleteCartItem,
  getCart,
  updateCartItemQuantity,
} from "../controller/cart.controller";
import { isAuthenticated } from "../packages/middleware/isAuthenticated";

const router = express.Router();

router.get("/get-cart", isAuthenticated, getCart);
router.post("/add-to-cart", isAuthenticated, addToCart);
router.put("/update-cart", isAuthenticated, updateCartItemQuantity);
router.delete("/remove-from-cart/:productId", isAuthenticated, deleteCartItem);

export default router;
