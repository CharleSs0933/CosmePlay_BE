"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAddressData = void 0;
const error_handler_1 = require("../packages/error-handler");
const validateAddressData = (data) => {
    const { address, city, pincode, phone } = data;
    if (!address || !city || !pincode || !phone) {
        throw new error_handler_1.ValidationError("Missing required fields!");
    }
};
exports.validateAddressData = validateAddressData;
