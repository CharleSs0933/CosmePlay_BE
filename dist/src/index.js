"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const body_parser_1 = __importDefault(require("body-parser"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const error_middleware_1 = require("./packages/error-handler/error-middleware");
const order_controller_1 = require("./controller/order.controller");
/* ROUTE IMPORT */
const auth_router_1 = __importDefault(require("./routes/auth.router"));
const product_router_1 = __importDefault(require("./routes/product.router"));
const cart_router_1 = __importDefault(require("./routes/cart.router"));
const order_router_1 = __importDefault(require("./routes/order.router"));
const address_router_1 = __importDefault(require("./routes/address.router"));
const review_router_1 = __importDefault(require("./routes/review.router"));
const post_router_1 = __importDefault(require("./routes/post.router"));
const event_router_1 = __importDefault(require("./routes/event.router"));
const voucher_router_1 = __importDefault(require("./routes/voucher.router"));
const user_router_1 = __importDefault(require("./routes/user.router"));
/* CONFIGURATIONS */
dotenv_1.default.config();
const app = (0, express_1.default)();
app.post("/api/stripe/webhook", express_1.default.raw({ type: "application/json" }), order_controller_1.stripeWebhooks);
app.use(express_1.default.json({ limit: "100mb" }));
app.use(express_1.default.urlencoded({ limit: "100mb", extended: true }));
app.use((0, helmet_1.default)());
app.use(helmet_1.default.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use((0, morgan_1.default)("common"));
app.use(body_parser_1.default.json());
app.use(body_parser_1.default.urlencoded({ extended: true }));
app.use((0, cors_1.default)({
    origin: [
        `${process.env.CLIENT_BASE_URL}`,
        "http://localhost:8081",
        "https://wdp-fpt-summer2025.vercel.app",
    ],
    methods: ["GET", "POST", "DELETE", "PUT"],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Cache-Control",
        "Expires",
        "Pragma",
    ],
    credentials: true,
}));
app.use((0, cookie_parser_1.default)());
/* RATE LIMITER */
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: (req: any) => (req.user ? 1000 : 100), // limit each IP to 1000 requests per windowMs
//   message: { error: "Too many requests, please try again later!" },
//   standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
//   legacyHeaders: true,
//   keyGenerator: (req: any) => req.ip,
// });
// app.use(limiter);
/* ROUTES */
app.get("/", (req, res) => {
    res.send("This is the home route");
});
app.use("/api/auth", auth_router_1.default);
app.use("/api/products", product_router_1.default);
app.use("/api/cart", cart_router_1.default);
app.use("/api/orders", order_router_1.default);
app.use("/api/addresses", address_router_1.default);
app.use("/api/reviews", review_router_1.default);
app.use("/api/posts", post_router_1.default);
app.use("/api/events", event_router_1.default);
app.use("/api/vouchers", voucher_router_1.default);
app.use("/api/users", user_router_1.default);
app.use(error_middleware_1.errorMiddleware);
const port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
