import { supabase } from "./supabase.js";
import { DIMENSIONS } from "../ai/scoring.config.js";
import { generateReport } from "../reports/generateReport.js";
import { PLAN_ENTITLEMENTS } from "../config/pricing.js";

/**
 * Aggregates scores from all pages and finalizes the project.
 * @param {string} projectId 
 */
export async function finalizeProject(projectId) {
    if (!projectId) return;

    try {
        console.log(`🏁 Finalizing project: ${projectId}`);

        // Update Status: Compiling (Step 3/5)
        await supabase.from('projects')
            .update({
                audit_status: 'compiling',
                audit_step: 3,
                audit_message: 'Compiling insights and scores'
            })
            .eq('id', projectId);

        // 1. Fetch analysis scores for all pages in this project
        // Joining pages -> ai_reviews using the foreign key relationship
        const { data: pages, error: pageError } = await supabase
            .from('pages')
            .select(`
                id, 
                url, 
                ai_reviews!ai_reviews_page_id_fkey (
                    scores
                )
            `)
            .eq('project_id', projectId);

        if (pageError) throw pageError;

        if (!pages || pages.length === 0) {
            console.warn("⚠️ No pages found for project.");
            return;
        }

        // 2. Aggregate Scores
        let totalOverall = 0;
        let count = 0;

        // Initialize accumulators for each dimension
        const dimTotals = {};
        DIMENSIONS.forEach(d => dimTotals[d] = 0);

        pages.forEach(page => {
            if (page.ai_reviews && page.ai_reviews.length > 0) {
                // Take the most recent review if multiple (assuming order or just first)
                // In a perfect world we query the latest, but usually 1 page = 1 review per crawl
                const review = page.ai_reviews[0];
                const scores = review.scores || {};

                // Calculate Page Overall Score from its breakdown
                let pageTotal = 0;
                let pageDimCount = 0;
                Object.values(scores).forEach(val => {
                    if (typeof val === 'number') {
                        pageTotal += val;
                        pageDimCount++;
                    }
                });
                const pageOverall = pageDimCount > 0 ? Math.round(pageTotal / pageDimCount) : 0;

                // Add to project total
                if (pageDimCount > 0) {
                    totalOverall += pageOverall;

                    // Add to dimension totals
                    DIMENSIONS.forEach(dim => {
                        if (typeof scores[dim] === 'number') {
                            dimTotals[dim] += scores[dim];
                        }
                    });
                    count++;
                }
            }
        });

        // Calculate Averages
        const finalOverall = count > 0 ? Math.round(totalOverall / count) : 0;
        const finalBreakdown = {};

        DIMENSIONS.forEach(dim => {
            finalBreakdown[dim] = count > 0 ? Math.round(dimTotals[dim] / count) : 0;
        });

        console.log(`📊 Final Score: ${finalOverall} (Pages: ${count})`);
        console.log(`📈 Breakdown:`, finalBreakdown);

        // 3. Update Project
        const { error: updateError } = await supabase
            .from('projects')
            .update({
                score: finalOverall,
                score_breakdown: finalBreakdown,
                completed_at: new Date().toISOString(),
                status: 'completed'
            })
            .eq('id', projectId);

        if (updateError) throw updateError;
        console.log("✅ Project successfully finalized.");

        // 4. Trigger Async PDF Generation (CONDITIONAL)
        // Check if user is entitled to PDF generation to save compute
        const { data: projectUser } = await supabase
            .from('projects')
            .select('user_id, metadata, progress_label') // Fetch metadata
            .eq('id', projectId)
            .single();

        if (projectUser) {
            // --- CREDIT DEDUCTION LOGIC ---
            // Check if this project was flagged to use credits
            const usageType = projectUser.metadata?.usage_type ||
                (projectUser.progress_label?.includes('[credits]') ? 'credits' : 'monthly');

            if (usageType === 'credits') {
                const pagesDeducted = pages.length; // 1 credit = 1 page
                if (pagesDeducted > 0) {
                    console.log(`💳 Deducting ${pagesDeducted} credits for Project ${projectId} (User ${projectUser.user_id})`);

                    // Atomic Deduction via RPC
                    const { error: creditError } = await supabase.rpc('increment_credits', {
                        uid: projectUser.user_id,
                        amount: -pagesDeducted
                    });

                    if (creditError) {
                        console.error("❌ Failed to deduct credits:", creditError);
                        // We record the failure but don't fail the audit? 
                        // Or maybe we insert a 'debt' record? 
                        // For now just log error.
                    } else {
                        // Log Transaction
                        await supabase.from('credit_transactions').insert({
                            user_id: projectUser.user_id,
                            amount: -pagesDeducted,
                            source: 'audit',
                            description: `Audit: ${projectId} (${pagesDeducted} pages)`
                        });
                    }
                }
            }
            // ------------------------------

            const { data: profile } = await supabase
                .from('profiles')
                .select('plan')
                .eq('id', projectUser.user_id)
                .single();

            const planName = (profile?.plan || 'free').toLowerCase();
            const entitlements = PLAN_ENTITLEMENTS[planName];

            if (entitlements && entitlements.canGenerateReports) {
                // Using setImmediate to not block the current stack
                setImmediate(() => {
                    console.log("🚀 Triggering background PDF generation...");
                    // Pass explicit checks if needed, but generateReport handles it? 
                    // No, generateReport just runs. Check is here.
                    generateReport(projectId).catch(err => console.error("Background PDF Gen Failed:", err));
                });
            } else {
                console.log(`ℹ️ Skipping PDF generation for user ${projectUser.user_id} (Plan: ${planName})`);
            }
        }

    } catch (err) {
        console.error("❌ Failed to finalize project:", err.message);
        await supabase.from('projects').update({ status: 'error' }).eq('id', projectId);
        throw err;
    }
}
