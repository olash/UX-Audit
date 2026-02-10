import { createProject } from "../db/createProject.js";
import { crawlSite } from "./crawl.js";
import { finalizeProject } from "../db/finalizeProject.js";
import { supabase } from "../db/supabase.js";

/**
 * Orchestrates the scraping process.
 * @param {string} startUrl 
 * @param {string|null} existingProjectId 
 * @param {number} pageLimit - Max pages to crawl (Must be dynamic based on User Plan)
 */
export async function runScraper(startUrl, existingProjectId = null, pageLimit = 3) {
    console.log(`🚀 Starting scraper for: ${startUrl} (Limit: ${pageLimit} pages)`);

    let projectId = existingProjectId;
    try {
        // 1. Create/Get Project
        if (!projectId) {
            console.log("Creating project record...");
            const project = await createProject(startUrl);
            projectId = project.id;
            console.log(`✅ Project created with ID: ${projectId}`);
        } else {
            console.log(`ℹ️ Using existing Project ID: ${projectId}`);
        }

        // 1b. Update Status: Crawling (Step 1/5)
        await supabase.from('projects')
            .update({
                audit_status: 'crawling',
                audit_step: 1,
                audit_message: 'Starting crawler...'
            })
            .eq('id', projectId);

        // 2. Run Crawl
        const pagesScanned = await crawlSite(startUrl, projectId, pageLimit);

        // 3. Finalize (Calc Score + Mark Complete)
        await finalizeProject(projectId);

        console.log("✅ Audit workflow completed.");
        return { projectId, pagesScanned };

    } catch (err) {
        console.error("❌ Scraper workflow failed:", err.message);
        // Error handling updates DB
        if (projectId) {
            await supabase
                .from('projects')
                .update({ status: 'error' })
                .eq('id', projectId);
        }
        throw err;
    }
}

// Allow standalone execution
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    console.log("🚀 Scraper script started");
    const cliUrl = process.argv[2];
    console.log("🔎 URL received:", cliUrl);

    if (!cliUrl) {
        console.error("❌ Please provide a URL: node backend/scraper/scraper.js <url>");
        process.exit(1);
    }

    runScraper(cliUrl).catch(err => {
        console.error("❌ Scraper failed:", err);
        process.exit(1);
    });
}
