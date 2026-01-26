import path from "path";
import fs from "fs";
import { supabase } from "../db/supabase.js";
import { OUTPUT_DIR, getSafeFilename } from "./utils.js";

/**
 * Captures a screenshot of the current page.
 * @param {import('playwright').Page} page 
 * @param {string} url 
 * @returns {Promise<string>} Local file path
 */
export async function captureScreenshot(page, url) {
    const safeName = getSafeFilename(url);
    const screenshotPath = path.join(OUTPUT_DIR, `${safeName}.png`);

    await page.screenshot({
        path: screenshotPath,
        fullPage: true
    });

    console.log("📸 Screenshot saved locally:", screenshotPath);
    return screenshotPath;
}

/**
 * Uploads screenshot to storage and returns public URL.
 * @param {string} localPath 
 * @param {string} projectId 
 * @returns {Promise<string>} Public URL
 */
export async function processScreenshot(localPath, projectId) {
    const fileBuffer = fs.readFileSync(localPath);

    // Sanitize filename
    const safeBasename = path.basename(localPath)
        .normalize('NFKD')
        .replace(/[^\w.-]/g, '_');

    const fileName = `${projectId}/${safeBasename}`;

    const { data, error } = await supabase.storage
        .from("screenshots")
        .upload(fileName, fileBuffer, {
            contentType: "image/png",
            upsert: true
        });

    if (error) throw error;

    // Construct public URL if needed, or return path
    // Supabase upload returns data.path usually.
    // If we need public URL:
    // const { data: publicData } = supabase.storage.from('screenshots').getPublicUrl(fileName);
    // return publicData.publicUrl;

    // Return public URL directly so pages.screenshot_url is correct
    const { data: publicData } = supabase.storage.from('screenshots').getPublicUrl(fileName);
    return publicData.publicUrl;
}
