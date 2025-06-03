"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const product_controller_1 = require("../controller/product.controller");
const isAuthenticated_1 = require("../packages/middleware/isAuthenticated");
const router = express_1.default.Router();
router.get("/", product_controller_1.getAllProducts);
router.get("/meta", product_controller_1.getProductMeta);
router.post("/", isAuthenticated_1.isAuthenticated, (0, isAuthenticated_1.allowedRoles)(["admin", "staff"]), product_controller_1.addProduct);
router.get("/:id", product_controller_1.getProduct);
exports.default = router;
