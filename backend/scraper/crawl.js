import { chromium } from "playwright";
import { normalizeUrl, isInternalLink, ensureScreenshotDir } from "./utils.js";
import { captureScreenshot, processScreenshot } from "./screenshot.js";
import { savePage } from "../db/savePage.js";
import { saveAnalysis } from "../db/saveAnalysis.js";
import { analyzeScreenshot } from "../ai/gemini.js";

export async function crawlSite(startUrl, projectId, maxPages = 10) {
    ensureScreenshotDir();
    const visited = new Set();
    const queue = [startUrl];

    const browser = await chromium.launch({
        headless: true,
        channel: 'chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    let pageCount = 0;

    try {
        while (queue.length > 0 && pageCount < maxPages) {
            const currentUrl = queue.shift();
            const normalized = normalizeUrl(currentUrl);

            if (!normalized || visited.has(normalized)) continue;
            visited.add(normalized);

            console.log(`🔎 Visiting (${pageCount + 1}/${maxPages}):`, normalized);

            try {
                // Short timeout for demo purposes, adjust for production
                await page.goto(normalized, { waitUntil: "domcontentloaded", timeout: 30000 });
                await page.waitForTimeout(2000);

                // 1. Capture Screenshot
                const localPath = await captureScreenshot(page, normalized);

                // 2. Upload Screenshot & Save Page Record
                let remotePath = null;
                try {
                    remotePath = await processScreenshot(localPath, projectId);

                    const pageData = await savePage({
                        projectId: projectId,
                        url: normalized,
                        screenshotPath: remotePath
                    });

                    // Increment valid page count
                    pageCount++;

                    // 3. AI Analysis
                    try {
                        console.log("🤖 Analyzing screenshot...");
                        const analysis = await analyzeScreenshot(localPath);
                        if (analysis) {
                            await saveAnalysis(pageData.id, analysis);
                        }
                    } catch (aiError) {
                        console.error("❌ Analysis Failed:", aiError.message);
                    }

                } catch (dbError) {
                    console.error("⚠️ Save/Upload Error:", dbError.message);
                }

                // 4. Extract Links (Only if we haven't hit limit to save resources)
                if (pageCount < maxPages) {
                    const links = await page.$$eval("a", anchors => anchors.map(a => a.href).filter(Boolean));
                    for (const link of links) {
                        if (isInternalLink(startUrl, link)) {
                            const normalizedLink = normalizeUrl(link);
                            if (normalizedLink && !visited.has(normalizedLink)) {
                                queue.push(normalizedLink);
                            }
                        }
                    }
                }

            } catch (pageError) {
                console.error("⚠️ Failed to process page:", normalized, pageError.message);
            }
        }
    } finally {
        await browser.close();
    }
}
