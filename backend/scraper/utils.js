import path from "path";
import { URL } from "url";
import fs from "fs";

export const OUTPUT_DIR = path.resolve(process.cwd(), "screenshots");

export function ensureScreenshotDir() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR);
    }
}

export function normalizeUrl(url) {
    try {
        const u = new URL(url);
        u.hash = ''; // Remove hash
        let normalized = u.href;
        if (normalized.endsWith('/') && normalized.length > 1) {
            normalized = normalized.slice(0, -1);
        }
        return normalized;
    } catch {
        return null;
    }
}

export function isInternalLink(baseUrl, link) {
    try {
        const base = new URL(baseUrl);
        const target = new URL(link, base);
        return base.hostname === target.hostname;
    } catch {
        return false;
    }
}

export function getSafeFilename(url) {
    return url.replace(/https?:\/\//, "").replace(/[\/:?<>|"]/g, "_");
}
