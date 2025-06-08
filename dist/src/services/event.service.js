"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEventData = void 0;
const error_handler_1 = require("../packages/error-handler");
const validateEventData = (data) => {
    const { title, description, start_time, end_time, is_active } = data;
    if (!title || !description || !start_time || !end_time || !is_active) {
        throw new error_handler_1.ValidationError("Missing required fields!");
    }
};
exports.validateEventData = validateEventData;
