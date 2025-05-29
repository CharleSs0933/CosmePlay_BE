"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitError = exports.DatabaseError = exports.ForbiddenError = exports.AuthError = exports.ValidationError = exports.NotFoundError = exports.AppError = void 0;
class AppError extends Error {
    constructor(message, statusCode, isOperational = true, details) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.details = details;
        Error.captureStackTrace(this);
    }
}
exports.AppError = AppError;
// Not found error
class NotFoundError extends AppError {
    constructor(message = "Resources not found") {
        super(message, 404);
    }
}
exports.NotFoundError = NotFoundError;
// Validation error (use for Joi/zod/react-hook-form validation errors)
class ValidationError extends AppError {
    constructor(message = "Invalid request data", details) {
        super(message, 400, true, details);
    }
}
exports.ValidationError = ValidationError;
// Authentication error
class AuthError extends AppError {
    constructor(message = "Unauthorized") {
        super(message, 401);
    }
}
exports.AuthError = AuthError;
// Forbidden error (For Insufficient permissions)
class ForbiddenError extends AppError {
    constructor(message = "Forbidden access") {
        super(message, 403);
    }
}
exports.ForbiddenError = ForbiddenError;
// Database error (For MongoDB/PostgreSQL errors)
class DatabaseError extends AppError {
    constructor(message = "Database error", details) {
        super(message, 500, true, details);
    }
}
exports.DatabaseError = DatabaseError;
// Rate limit error (if user exceeds API limit)
class RateLimitError extends AppError {
    constructor(message = "Too many requests, please try again later!") {
        super(message, 429);
    }
}
exports.RateLimitError = RateLimitError;
