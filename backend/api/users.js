import express from "express";
import { supabase } from "../db/supabase.js";
import { checkUsage } from "../utils/usage.js";
import { PLAN_ENTITLEMENTS } from "../config/pricing.js";

const router = express.Router();

// Helper: Extract user from request
async function getUserFromRequest(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;

    const token = authHeader.replace('Bearer ', '');
    const { data, error } = await supabase.auth.getUser(token);

    if (error) return null;
    return data.user;
}

// GET /api/me - Get current user profile
router.get("/me", async (req, res) => {
    try {
        const user = await getUserFromRequest(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        // Fetch Profile for additional fields
        const { data: profile } = await supabase
            .from('profiles')
            .select('plan, credits')
            .eq('id', user.id)
            .single();

        res.json({
            id: user.id,
            email: user.email,
            plan: profile?.plan || 'free',
            credits: profile?.credits || 0,
            user_metadata: user.user_metadata,
            created_at: user.created_at
        });
    } catch (error) {
        console.error("Error fetching me:", error);
        res.status(500).json({ error: "Failed to fetch profile" });
    }
});

// GET /api/usage - Get usage stats (Detailed for UI)
// Maps to /api/user/usage as per plan, but keeping /api/usage for consistency or route alias
router.get(["/usage", "/user/usage"], async (req, res) => {
    try {
        const user = await getUserFromRequest(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        // 1. Get Plan & Credits
        const { data: profile } = await supabase
            .from('profiles')
            .select('plan, credits')
            .eq('id', user.id)
            .single();

        const planName = (profile?.plan || 'free').toLowerCase();
        const credits = profile?.credits || 0;

        // 2. Get Limits
        const entitlements = PLAN_ENTITLEMENTS[planName] || PLAN_ENTITLEMENTS.free;
        const auditLimit = entitlements.auditsPerMonth;

        // 3. Count Audits This Month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        // Calculate Reset Date (1st of next month)
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const { count: auditsUsed } = await supabase
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('created_at', startOfMonth);

        const used = auditsUsed || 0;
        const remaining = Math.max(0, auditLimit - used);
        const limitReached = used >= auditLimit;

        res.json({
            plan: planName,
            audits_per_month: auditLimit,
            audits_used: used,
            audits_remaining: remaining,
            credits: credits,
            limit_reached: limitReached,
            reset_date: nextMonth.toISOString()
        });

    } catch (error) {
        console.error("Error fetching usage:", error);
        res.status(500).json({ error: "Failed to fetch usage" });
    }
});

// GET /api/subscription - Get subscription details
router.get("/subscription", async (req, res) => {
    try {
        const user = await getUserFromRequest(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        // TODO: Fetch from actual subscriptions table when ready.
        // For now, derive from usage or return mock
        const usage = await checkUsage(user.id);

        res.json({
            plan: usage.plan, // 'free' or 'pro'
            status: 'active',
            renewal_date: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString() // Mock next month
        });
    } catch (error) {
        console.error("Error fetching subscription:", error);
        res.status(500).json({ error: "Failed to fetch subscription" });
    }
});

export default router;
