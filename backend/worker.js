import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { crawlSite } from "./scraper/crawl.js";
import { finalizeProject } from "./db/finalizeProject.js";
import { checkUsage } from "./utils/usage.js";
import { supabase } from "./db/supabase.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env
dotenv.config({ path: path.resolve(__dirname, ".env") });

async function runBackgroundWorker() {
    const projectId = process.env.PROJECT_ID;
    const url = process.env.URL;
    const userId = process.env.USER_ID;
    const pageLimit = parseInt(process.env.PAGE_LIMIT || "10", 10);

    if (!projectId || !url) {
        console.error("❌ [ECS Worker] Missing required environment variables: PROJECT_ID, URL");
        process.exit(1);
    }

    console.log(`🚀 [ECS Worker] Starting audit for project ${projectId} | URL: ${url} | Limit: ${pageLimit} pages`);

    try {
        // Step 1: Update project status to crawling
        await supabase.from("projects").update({
            status: "running",
            progress_step: 2,
            progress_label: "Crawling site map..."
        }).eq("id", projectId);

        // Step 2: Run the crawler
        const pageCount = await crawlSite(url, projectId, pageLimit);
        console.log(`✅ [ECS Worker] Crawl complete. Pages scanned: ${pageCount}`);

        if (pageCount > 0) {
            // Step 3: Finalize (score calculation + PDF generation)
            console.log("📊 [ECS Worker] Finalizing project (scores + PDF)...");
            await finalizeProject(projectId);
            console.log("✅ [ECS Worker] Audit complete. Shutting down container.");
        } else {
            console.warn("⚠️ [ECS Worker] No pages scanned. Marking as failed.");
            await supabase.from("projects").update({
                status: "failed",
                progress_label: "No pages could be crawled."
            }).eq("id", projectId);
        }

        process.exit(0); // CRITICAL: Kills the container and stops billing immediately

    } catch (error) {
        console.error("❌ [ECS Worker] Fatal error during audit:", error);

        // Mark project as failed in DB
        try {
            await supabase.from("projects").update({
                status: "failed",
                progress_label: `Error: ${error.message}`
            }).eq("id", projectId);
        } catch (dbErr) {
            console.error("❌ [ECS Worker] Could not update project status:", dbErr.message);
        }

        process.exit(1); // Kills container on failure
    }
}

runBackgroundWorker();
