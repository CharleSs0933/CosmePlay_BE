"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllSuppliers = void 0;
const prisma_1 = __importDefault(require("../libs/prisma"));
const getAllSuppliers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const suppliers = yield prisma_1.default.supplier.findMany({});
        res.status(200).json(suppliers);
    }
    catch (error) {
        console.error("Error fetching suppliers:", error);
        res
            .status(500)
            .json({ error: "An error occurred while fetching suppliers." });
    }
});
exports.getAllSuppliers = getAllSuppliers;
