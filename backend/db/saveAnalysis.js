import { supabase } from "./supabase.js";

export async function saveAnalysis(pageId, analysis) {
    // analysis object now contains: { issues, summary, ..., scores: {...}, score: 85 }

    const { data, error } = await supabase.from("ai_reviews").insert({
        page_id: pageId,
        analysis: analysis,         // Full JSON dump (includes issues, etc)
        scores: analysis.scores     // Breakdown JSON { usability: 90, ... }
    });

    if (error) {
        console.error("Error saving analysis:", error);
        throw error;
    }

    // Phase 4: Save extracted issues to ux_issues table
    if (analysis.issues && Array.isArray(analysis.issues)) {
        const issuesToInsert = analysis.issues.map(issue => ({
            page_id: pageId,
            title: issue.title || `${issue.category} issue detected`, // Enforce mandatory title
            description: issue.description,
            severity: issue.severity,
            category: issue.category,
            // Fallback suggestion (Phase 1)
            ai_suggestion: issue.ai_suggestion || `Consider improving ${issue.category ? issue.category.toLowerCase() : 'usability'} by addressing this issue. Focus on clarity, consistency, and accessibility best practices.`
        }));

        if (issuesToInsert.length > 0) {
            const { error: issuesError } = await supabase.from('ux_issues').insert(issuesToInsert);
            if (issuesError) {
                console.error("⚠️ Failed to extract issues to ux_issues:", issuesError.message);
                // Don't throw, as main analysis is saved
            }
        }
    }

    return data;
}
