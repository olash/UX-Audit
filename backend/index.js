import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import auditRoutes from "./api/audits.js";
import userRoutes from "./api/users.js";
import checkoutRouter from "./api/checkout.js";
import webhooksRouter from "./api/webhooks.js";
import dotenv from "dotenv";

// Load environment variables from root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1); // Required for ECS/ALB to correctly identify IPs

// Webhooks must handle their own body parsing (stream/raw)
app.use("/api/webhooks", webhooksRouter);

app.use(cors());
app.use(express.json());

// Security Layer 1: Global Rate Limiting
import rateLimit from 'express-rate-limit';
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { error: "Too many requests, please try again later." }
});
app.use(globalLimiter);

app.get("/", (req, res) => {
    res.status(200).send('OK');
});

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

// Routes
app.use("/api/audits", auditRoutes);
app.use("/api", userRoutes); // Mount at /api so we get /api/me, /api/usage
app.use("/api/checkout", checkoutRouter);

app.listen(4000, "0.0.0.0", () => {
    console.log("Backend running on port 4000");
});
