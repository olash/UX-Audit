import { supabase } from "./supabase.js";
import { DIMENSIONS } from "../ai/scoring.config.js";

/**
 * Aggregates scores from all pages and finalizes the project.
 * @param {string} projectId 
 */
export async function finalizeProject(projectId) {
    if (!projectId) return;

    try {
        console.log(`🏁 Finalizing project: ${projectId}`);

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
                status: 'completed',
                score: finalOverall,
                score_breakdown: finalBreakdown,
                completed_at: new Date().toISOString()
            })
            .eq('id', projectId);

        if (updateError) throw updateError;
        console.log("✅ Project successfully finalized.");

    } catch (err) {
        console.error("❌ Failed to finalize project:", err.message);
        await supabase.from('projects').update({ status: 'error' }).eq('id', projectId);
        throw err;
    }
}
