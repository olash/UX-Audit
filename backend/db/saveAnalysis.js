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
    return data;
}
