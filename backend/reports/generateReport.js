// 1. Imports
import { chromium } from 'playwright';
import path from 'path'; // Step 1: Import path correctly
import { supabase } from "../db/supabase.js";
import { renderReportHTML } from './reportTemplate.js';
import { DIMENSIONS } from '../ai/scoring.config.js';
import fs from 'fs';

// Helper to get logo base64
function getLogoBase64() {
    try {
        // Resolve path relative to this file? Or use absolute/cwd?
        // Using CWD of the process (usually backend root)
        const logoPath = path.resolve('..', 'frontend', 'assets', 'images', 'logo.png');
        if (fs.existsSync(logoPath)) {
            const bitmap = fs.readFileSync(logoPath);
            return `data:image/png;base64,${bitmap.toString('base64')}`;
        }
        return null;
    } catch (e) {
        console.warn("Could not load logo for PDF:", e);
        return null;
    }
}

/**
 * Generates a PDF report using Playwright and uploads it to Supabase.
 * @param {string} projectId
 * @returns {Promise<string>} Public URL of the report
 */
export async function generateReport(projectId) {
    console.log('🧾 Starting PDF generation...');
    console.log(`Generating PDF report for project: ${projectId}`);

    // Update Status: Generating Report (Step 4/5)
    await supabase.from('projects')
        .update({
            audit_status: 'generating_report',
            audit_step: 4,
            audit_message: 'Generating PDF report...'
        })
        .eq('id', projectId);

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
        const logoBase64 = getLogoBase64();
        const html = renderReportHTML({ project, pages, issues, breakdown, logoBase64 });

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

        console.log(`PDF generated (${pdfBuffer.length} bytes)`);

        // 5b. Upload to Storage
        // Use forward slashes for Storage, not system path separators
        const storagePath = `reports/${projectId}.pdf`;

        const { error: uploadError } = await supabase.storage
            .from('reports')
            .upload(storagePath, pdfBuffer, {
                contentType: 'application/pdf',
                upsert: true,
            });

        if (uploadError) {
            console.error("Storage upload error:", uploadError);
            throw uploadError;
        }

        // 6. Get Public URL
        const { data } = supabase.storage
            .from('reports')
            .getPublicUrl(storagePath);

        const publicUrl = data.publicUrl;

        // 7. Update Project
        const { error: dbError } = await supabase
            .from('projects')
            .update({
                report_url: publicUrl,
                status: 'completed', // Legacy status
                report_ready: true,
                // Update Status: Completed (Step 5/5)
                audit_status: 'completed',
                audit_step: 5,
                audit_message: 'Audit complete'
            })
            .eq('id', projectId);

        if (dbError) throw dbError;

        // Track PDF Generation
        try {
            if (posthog) {
                posthog.capture({
                    distinctId: project.user_id,
                    event: 'pdf_generated',
                    properties: {
                        project_id: projectId
                    }
                });
            }
        } catch (phError) {
            console.error('PostHog PDF Error:', phError);
        }

        console.log(`✅ Report ready: ${publicUrl}`);
        return publicUrl;

    } catch (error) {
        console.error("Generate Report Failed:", error);
        throw error;
    } finally {
        if (browser) await browser.close();
    }
}
