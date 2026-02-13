import { supabase } from "../db/supabase.js";
import { PLAN_ENTITLEMENTS } from "../config/pricing.js";

export async function getUsageStats(userId) {
    // 1. Get User Plan & Credits
    const { data: profile } = await supabase
        .from('profiles')
        .select('plan, credits')
        .eq('id', userId)
        .single();

    const planName = (profile?.plan || 'free').toLowerCase();
    const credits = profile?.credits || 0;

    const entitlements = PLAN_ENTITLEMENTS[planName] || PLAN_ENTITLEMENTS.free;

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
        throw new Error("Could not verify usage limits");
    }

    const auditsUsed = count || 0;
    const auditsRemaining = Math.max(entitlements.auditsPerMonth - auditsUsed, 0);

    // Strict JSON structure as requested
    return {
        plan: planName,
        audits_per_month: entitlements.auditsPerMonth,
        audits_used: auditsUsed,
        audits_remaining: auditsRemaining,
        credits_remaining: credits,
        pages_per_audit: entitlements.maxPagesPerAudit
    };
}

export async function checkUsage(userId) {
    try {
        const stats = await getUsageStats(userId);

        console.log(`[Usage Check] User: ${userId} | Plan: ${stats.plan} | Credits: ${stats.credits_remaining} | Used: ${stats.audits_used}/${stats.audits_per_month}`);

        if (stats.audits_used >= stats.audits_per_month) {
            return {
                allowed: false,
                reason: `Monthly audit limit reached (${stats.audits_used}/${stats.audits_per_month}). Upgrade your plan or use credits.`
            };
        }

        return {
            allowed: true,
            pageLimit: stats.pages_per_audit,
            plan: stats.plan,
            credits: stats.credits_remaining,
            // Pass full stats for advanced logic if needed
            stats: stats
        };
    } catch (e) {
        return { allowed: false, reason: "Error checking usage: " + e.message };
    }
}
