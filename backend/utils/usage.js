import { supabase } from "../db/supabase.js";

// Consolidated Limits matching frontend/assets/js/config/pricing.js
const PLANS = {
    free: { audits: 2, pages: 3 },
    starter: { audits: 10, pages: 10 },
    pro: { audits: 30, pages: 30 },
    team: { audits: 75, pages: 75 }
};

export async function checkUsage(userId) {
    // 1. Get User Plan
    let planName = 'free';

    const { data: profile } = await supabase
        .from('profiles')
        .select('plan, credits')
        .eq('id', userId)
        .single();

    if (profile && profile.plan) {
        planName = profile.plan.toLowerCase();
    }

    const limits = PLANS[planName] || PLANS.free;

    // 2. Count Audits this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { count, error } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', startOfMonth);

    if (error) {
        console.error("Usage check error:", error);
        // Fail open or closed? Closed for safety.
        throw new Error("Could not verify usage limits");
    }

    if (count >= limits.audits) {
        return {
            allowed: false,
            reason: `Monthly audit limit reached (${count}/${limits.audits}). Upgrade your plan to continue.`
        };
    }

    return {
        allowed: true,
        pageLimit: limits.pages,
        plan: planName,
        credits: profile?.credits || 0 // Usage logic can now use this
    };
}
