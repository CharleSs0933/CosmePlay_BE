"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const isAuthenticated_1 = require("../packages/middleware/isAuthenticated");
const address_controller_1 = require("../controller/address.controller");
const router = express_1.default.Router();
router.get("/get", isAuthenticated_1.isAuthenticated, address_controller_1.getAddressesByUser);
router.post("/add", isAuthenticated_1.isAuthenticated, address_controller_1.addAddress);
router.delete("/:id", isAuthenticated_1.isAuthenticated, address_controller_1.deleteAddress);
router.put("/:id", isAuthenticated_1.isAuthenticated, address_controller_1.updateAddress);
exports.default = router;
