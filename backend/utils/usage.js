import { supabase } from "../db/supabase.js";

import { PLAN_ENTITLEMENTS } from "../config/pricing.js";

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

    const entitlements = PLAN_ENTITLEMENTS[planName] || PLAN_ENTITLEMENTS.free;
    const limits = {
        audits: entitlements.auditsPerMonth,
        pages: entitlements.maxPagesPerAudit
    };

    console.log(`[Usage Check] User: ${userId} | Plan: ${planName} | Credits: ${profile?.credits} | Limits: ${JSON.stringify(limits)}`);

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
