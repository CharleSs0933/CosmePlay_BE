import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { errorMiddleware } from "./packages/error-handler/error-middleware";
/* ROUTE IMPORT */
import AuthRouter from "./routes/auth.router";
import ProductRouter from "./routes/product.router";

/* CONFIGURATIONS */
dotenv.config();
const app = express();
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(morgan("common"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  cors({
    origin: process.env.CLIENT_BASE_URL,
    methods: ["GET", "POST", "DELETE", "PUT"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "Expires",
      "Pragma",
    ],
    credentials: true,
  })
);
app.use(cookieParser());

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

app.use("/api/auth", AuthRouter);
app.use("/api/products", ProductRouter);

app.use(errorMiddleware);

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
