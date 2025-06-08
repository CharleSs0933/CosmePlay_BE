"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEventData = void 0;
const validateEventData = (data) => {
    const { title, description, start_date, end_date, is_active } = data;
    if (!title || !description || !start_date || !end_date || !is_active) {
        throw new Error("Missing required fields!");
    }
};
exports.validateEventData = validateEventData;
