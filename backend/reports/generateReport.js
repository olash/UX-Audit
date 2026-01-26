import { supabase } from "../db/supabase.js";

/**
 * Generates (mocks) a PDF report and uploads it to Supabase.
 * @param {string} projectId
 * @returns {Promise<string>} Public URL of the report
 */
export async function generateReport(projectId) {
    console.log(`Generating report for project: ${projectId}`);

    // MOCK: Generate a simple PDF buffer (using text for now as we lack pdf-lib)
    // In a real app, use pdf-lib or puppeteer
    const pdfContent = `Audit Report for Project ${projectId}\nGenerated on ${new Date().toISOString()}`;
    const pdfBuffer = Buffer.from(pdfContent);

    const path = `${projectId}/audit-report.pdf`;

    // 1. Upload to Storage
    const { error: uploadError } = await supabase.storage
        .from('reports')
        .upload(path, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true,
        });

    if (uploadError) {
        console.error("Report upload failed:", uploadError);
        throw uploadError;
    }

    // 2. Get Public URL
    const { data } = supabase.storage
        .from('reports')
        .getPublicUrl(path);

    const publicUrl = data.publicUrl;

    // 3. Update Project
    const { error: dbError } = await supabase
        .from('projects')
        .update({ report_url: publicUrl })
        .eq('id', projectId);

    if (dbError) throw dbError;

    console.log(`✅ Report generated and saved: ${publicUrl}`);
    return publicUrl;
}
