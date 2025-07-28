"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const supplier_controller_1 = require("../controller/supplier.controller");
const router = express_1.default.Router();
router.get("/", supplier_controller_1.getAllSuppliers);
exports.default = router;
