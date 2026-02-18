import dotenv from "dotenv";
import path from "path";
import { runScraper } from "./scraper/scraper.js";

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function startWorker() {
    const projectId = process.env.PROJECT_ID;
    const url = process.env.URL;
    const pageLimit = parseInt(process.env.PAGE_LIMIT, 10);

    if (!projectId || !url) {
        console.error("❌ Missing required environment variables!");
        process.exit(1);
    }

    try {
        console.log(`🚀 [ECS Worker] Starting heavy background audit for ${url} (Limit: ${pageLimit})`);

        // Run the actual Playwright scraper (crawl + AI analysis + PDF generation)
        await runScraper(url, projectId, pageLimit);

        console.log("✅ [ECS Worker] Audit and PDF generation complete. Shutting down container.");
        process.exit(0); // CRITICAL: This line stops the AWS billing!

    } catch (error) {
        console.error("❌ [ECS Worker] Fatal error during audit:", error);
        process.exit(1);
    }
}

startWorker();
