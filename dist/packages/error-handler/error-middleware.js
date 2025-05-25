"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = void 0;
const index_1 = require("./index");
const errorMiddleware = (err, req, res, next) => {
    if (err instanceof index_1.AppError) {
        console.log(`Error ${req.method} ${req.url} - ${err.message}`);
        res.status(err.statusCode).json(Object.assign({ status: "error", message: err.message }, (err.details && { details: err.details })));
        return;
    }
    console.log("Unhandled error", err);
    res.status(500).json({
        error: "Something went wrong, please try again!",
    });
    return;
};
exports.errorMiddleware = errorMiddleware;
