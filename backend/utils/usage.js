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
    const limits = {
        audits: entitlements.auditsPerMonth,
        pages: entitlements.maxPagesPerAudit
    };

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

    return {
        plan: planName,
        credits: credits,
        audits: {
            used: count,
            limit: limits.audits
        },
        pages: {
            limit: limits.pages
        }
    };
}

export async function checkUsage(userId) {
    try {
        const stats = await getUsageStats(userId);

        console.log(`[Usage Check] User: ${userId} | Plan: ${stats.plan} | Credits: ${stats.credits} | Used: ${stats.audits.used}/${stats.audits.limit}`);

        if (stats.audits.used >= stats.audits.limit) {
            return {
                allowed: false,
                reason: `Monthly audit limit reached (${stats.audits.used}/${stats.audits.limit}). Upgrade your plan or use credits.`
            };
        }

        return {
            allowed: true,
            pageLimit: stats.pages.limit,
            plan: stats.plan,
            credits: stats.credits
        };
    } catch (e) {
        return { allowed: false, reason: "Error checking usage: " + e.message };
    }
}
