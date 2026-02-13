import express from "express";
import { supabase } from "../db/supabase.js";
import { checkUsage, getUsageStats } from "../utils/usage.js";

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

        // Fetch usage stats which covers plan, credits, and limits
        const stats = await getUsageStats(user.id);

        res.json({
            id: user.id,
            email: user.email,
            plan: stats.plan,
            credits: stats.credits_remaining,
            usage: {
                used: stats.audits_used,
                limit: stats.audits_per_month,
                remaining: stats.audits_remaining
            },
            pages: { limit: stats.pages_per_audit },
            user_metadata: user.user_metadata,
            created_at: user.created_at
        });
    } catch (error) {
        console.error("Error fetching me:", error);
        res.status(500).json({ error: "Failed to fetch profile" });
    }
});

// GET /api/usage - Get usage stats
router.get("/usage", async (req, res) => {
    try {
        const user = await getUserFromRequest(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const stats = await getUsageStats(user.id);
        res.json(stats);
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
