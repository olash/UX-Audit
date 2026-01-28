// 1. Imports
import { chromium } from 'playwright';
import { supabase } from "../db/supabase.js";
import { renderReportHTML } from './reportTemplate.js';
import { DIMENSIONS } from '../ai/scoring.config.js';

// FRONTEND_URL removed as we generate HTML locally

/**
 * Generates a PDF report using Playwright and uploads it to Supabase.
 * @param {string} projectId
 * @returns {Promise<string>} Public URL of the report
 */
export async function generateReport(projectId) {
    console.log('🧾 Starting PDF generation...');
    console.log(`Generating PDF report for project: ${projectId}`);
    let browser = null;

    try {
        // 2. Launch Browser
        browser = await chromium.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Critical for ECS/Docker
        });
        const page = await browser.newPage();

        // 2a. Fetch Data for Report
        // Project
        const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!project) throw new Error(`Project ${projectId} not found`);

        // Pages & Reviews
        const { data: pages } = await supabase.from('pages')
            .select(`id, url, screenshot_url, ai_reviews!ai_reviews_page_id_fkey(scores)`)
            .eq('project_id', projectId);

        // Issues
        const pageIds = pages.map(p => p.id);
        const { data: issues } = await supabase.from('ux_issues')
            .select(`*, pages(url)`)
            .in('page_id', pageIds);

        // Calculate Breakdown (Re-calculate to ensure fresh data)
        const dimTotals = {};
        const dimCounts = {};
        DIMENSIONS.forEach(d => { dimTotals[d] = 0; dimCounts[d] = 0; });

        pages.forEach(page => {
            const review = page.ai_reviews?.[0];
            if (review && review.scores) {
                Object.entries(review.scores).forEach(([key, val]) => {
                    const k = key.toLowerCase();
                    if (typeof val === 'number' && DIMENSIONS.includes(k)) {
                        dimTotals[k] += val;
                        dimCounts[k]++;
                    }
                });
            }
        });

        const breakdown = {};
        DIMENSIONS.forEach(d => {
            if (dimCounts[d] > 0) breakdown[d] = Math.round(dimTotals[d] / dimCounts[d]);
        });

        // 3. Render HTML
        const html = renderReportHTML({ project, pages, issues, breakdown });

        // 4. Set Content
        await page.setContent(html, {
            waitUntil: 'networkidle'
        });

        // 5. Generate PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '24px', bottom: '24px' }
        });

        // 6. Get Public URL
        const { data } = supabase.storage
            .from('reports')
            .getPublicUrl(path);

        const publicUrl = data.publicUrl;

        // 7. Update Project
        const { error: dbError } = await supabase
            .from('projects')
            .update({
                report_url: publicUrl,
                status: 'completed', // Or keep as is, but ensuring ready state
                report_ready: true   // If column exists, or just rely on URL
            })
            .eq('id', projectId);

        if (dbError) throw dbError;

        console.log(`✅ Report ready: ${publicUrl}`);
        return publicUrl;

    } catch (error) {
        console.error("Generate Report Failed:", error);
        throw error;
    } finally {
        if (browser) await browser.close();
    }
}
