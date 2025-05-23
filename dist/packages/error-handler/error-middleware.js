"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = void 0;
const index_1 = require("./index");
const errorMiddleware = (err, req, res) => {
    if (err instanceof index_1.AppError) {
        console.log(`Error ${req.method} ${req.url} - ${err.message}`);
        return void res.status(err.statusCode).json(Object.assign({ status: "error", message: err.message }, (err.details && { details: err.details })));
    }
    console.log("Unhandled error", err);
    return void res.status(500).json({
        error: "Something went wrong, please try again!",
    });
};
exports.errorMiddleware = errorMiddleware;
