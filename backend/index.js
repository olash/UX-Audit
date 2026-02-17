import { crawlSite } from "./scraper/crawl.js";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const handler = async (event, context) => {
    // --- WARMUP LOGIC START ---
    // If this is a "keep-alive" ping, quit immediately.
    // This keeps the container warm but costs almost $0 because it runs in 2ms.
    if (event.type === 'warmup' || (event.body && (typeof event.body === 'string' ? JSON.parse(event.body).type === 'warmup' : event.body.type === 'warmup'))) {
        console.log("🔥 Warmup ping received! Staying alive...");
        return { statusCode: 200, body: "Warmed!" };
    }
    // --- WARMUP LOGIC END ---

    console.log("INVOCATION EVENT:", JSON.stringify(event, null, 2));

    let body = event;

    // Handle API Gateway event structure where body is a string
    if (event.body) {
        try {
            body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        } catch (e) {
            console.warn("Failed to parse event.body", e);
            body = event.body; // Fallback
        }
    }

    const { url, projectId } = body;

    // Basic Validation
    if (!url) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Missing 'url' in request body" })
        };
    }

    try {
        console.log(`🚀 Starting Audit for Project: ${projectId} | URL: ${url}`);

        // Execute the crawl logic
        // Ensure projectId is passed if available, otherwise crawlSite might fail DB updates
        // We pass a dummy ID or null if missing, but crawlSite logic depends on it.
        if (!projectId) {
            console.warn("⚠️ No projectId provided. Database updates may fail.");
        }

        const pageCount = await crawlSite(url, projectId);

        return {
            statusCode: 200,
            body: JSON.stringify({
                status: "Success",
                pages_scanned: pageCount,
                project_id: projectId
            })
        };

    } catch (error) {
        console.error("❌ Lambda Handler Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: "Internal Server Error",
                message: error.message
            })
        };
    }
};
