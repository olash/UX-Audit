// 1. Imports
import { chromium } from 'playwright';
import { supabase } from "../db/supabase.js";

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500'; // Default to Live Server port

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

        // 3. Navigate to Print Page
        const targetUrl = `${FRONTEND_URL}/pages/print_report.html?id=${projectId}`;
        console.log(`Navigating to: ${targetUrl}`);

        await page.goto(targetUrl, {
            waitUntil: 'networkidle',
            timeout: 60000
        });

        // 4. Generate PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '24px', bottom: '24px' }
        });

        console.log(`PDF generated (${pdfBuffer.length} bytes)`);

        // 5. Upload to Storage
        const path = `reports/${projectId}.pdf`;
        const { error: uploadError } = await supabase.storage
            .from('reports') // Bucket must exist (created via SQL or dashboard)
            .upload(path, pdfBuffer, {
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
