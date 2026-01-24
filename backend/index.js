import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import auditRoutes from "./api/audits.js";
import userRoutes from "./api/users.js";
import dotenv from "dotenv";

// Load environment variables from root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.status(200).send('OK');
});

// Routes
app.use("/api/audits", auditRoutes);
app.use("/api", userRoutes); // Mount at /api so we get /api/me, /api/usage

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});
