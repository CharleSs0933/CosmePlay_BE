"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cart_controller_1 = require("../controller/cart.controller");
const isAuthenticated_1 = require("../packages/middleware/isAuthenticated");
const router = express_1.default.Router();
router.get("/get-cart", isAuthenticated_1.isAuthenticated, cart_controller_1.getCart);
router.post("/add-to-cart", isAuthenticated_1.isAuthenticated, cart_controller_1.addToCart);
router.put("/update-cart", isAuthenticated_1.isAuthenticated, cart_controller_1.updateCartItemQuantity);
router.delete("/remove-from-cart/:productId", isAuthenticated_1.isAuthenticated, cart_controller_1.deleteCartItem);
exports.default = router;
