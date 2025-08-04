"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const isAuthenticated_1 = require("../packages/middleware/isAuthenticated");
const voucher_controller_1 = require("../controller/voucher.controller");
const router = express_1.default.Router();
router.get("/", isAuthenticated_1.isAuthenticated, voucher_controller_1.getVouchersByUser);
router.get("/event/:eventId", isAuthenticated_1.isAuthenticated, voucher_controller_1.getVouchersEventByUser);
router.get("/all", isAuthenticated_1.isAuthenticated, (0, isAuthenticated_1.allowedRoles)(["admin", "staff"]), voucher_controller_1.getAllVouchers);
exports.default = router;
