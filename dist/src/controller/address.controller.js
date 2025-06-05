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
exports.deleteAddress = exports.updateAddress = exports.getAddressesByUser = exports.addAddress = void 0;
const error_handler_1 = require("../packages/error-handler");
const prisma_1 = __importDefault(require("../libs/prisma"));
const address_service_1 = require("../services/address.service");
const addAddress = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        (0, address_service_1.validateAddressData)(req.body);
        yield prisma_1.default.address.create({
            data: Object.assign(Object.assign({}, req.body), { user_id: user.id }),
        });
        res.status(201).json({ success: true, message: "Address added!" });
    }
    catch (error) {
        next(error);
    }
});
exports.addAddress = addAddress;
const getAddressesByUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const addresses = yield prisma_1.default.address.findMany({
            where: { user_id: user.id },
        });
        res.status(200).json({ success: true, addresses });
    }
    catch (error) {
        next(error);
    }
});
exports.getAddressesByUser = getAddressesByUser;
const updateAddress = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const { id } = req.params;
        const { address, city, pincode, phone, notes } = req.body;
        const addressToUpdate = yield prisma_1.default.address.findUnique({
            where: { id, user_id: user.id },
        });
        if (!addressToUpdate) {
            return next(new error_handler_1.ValidationError("Address not found!"));
        }
        yield prisma_1.default.address.update({
            where: { id, user_id: user.id },
            data: {
                address,
                city,
                pincode,
                phone,
                notes,
            },
        });
        res.status(200).json({ success: true, message: "Address updated!" });
    }
    catch (error) {
        next(error);
    }
});
exports.updateAddress = updateAddress;
const deleteAddress = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const { id } = req.params;
        const addressToDelete = yield prisma_1.default.address.findUnique({
            where: { id, user_id: user.id },
        });
        if (!addressToDelete) {
            return next(new error_handler_1.ValidationError("Address not found!"));
        }
        yield prisma_1.default.address.delete({ where: { id, user_id: user.id } });
        res.status(200).json({ success: true, message: "Address deleted!" });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteAddress = deleteAddress;
