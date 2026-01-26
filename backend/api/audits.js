import express from "express";
import { createProject } from "../db/createProject.js";
import { runScraper } from "../scraper/scraper.js";
import { supabase } from "../db/supabase.js";
import { generateReport } from "../reports/generateReport.js";
// import { checkUsage } from "../utils/usage.js";

const router = express.Router();

import jwt from 'jsonwebtoken';

// Helper: Extract user from request
async function getUserFromRequest(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        console.error('❌ No Authorization header');
        throw new Error('No Authorization header');
    }

    const token = authHeader.replace('Bearer ', '').trim();

    // Verify token manually (NO Supabase session needed)
    const decoded = jwt.decode(token);

    if (!decoded || !decoded.sub) {
        console.error('❌ Invalid token');
        throw new Error('Invalid token');
    }

    return {
        id: decoded.sub,
        email: decoded.email
    };
}

// POST /api/audits - Start an audit
router.post("/", async (req, res) => {
    try {
        let user;
        try {
            user = await getUserFromRequest(req);
        } catch (e) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: "URL is required" });
        }

        // --- USAGE CHECK REMOVED ---
        // const usage = await checkUsage(user.id);

        console.log(`User ${user.id} starting audit.`);

        // 1. Create project immediately associated with user
        const project = await createProject(url, user.id);

        // 2. Start (async) scrape with Default Page Limit
        runScraper(url, project.id).catch(err => console.error("Background audit error:", err));

        return res.status(201).json({
            message: "Audit started",
            auditId: project.id
        });

    } catch (error) {
        console.error("Error starting audit:", error);
        return res.status(500).json({ error: "Failed to start audit", details: error.message });
    }
});

// GET /api/audits - Get all audits for user
router.get("/", async (req, res) => {
    try {
        let user;
        try {
            user = await getUserFromRequest(req);
        } catch (e) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        let query = supabase
            .from('projects')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        // Filter by status if provided
        if (req.query.status) {
            query = query.eq('status', req.query.status);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error("Error fetching audits:", error);
        res.status(500).json({ error: "Failed to fetch audits" });
    }
});

// GET /api/audits/:id - Get status
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { data: project, error } = await supabase
            .from('projects')
            .select('*, pages(count)')
            .eq('id', id)
            .single();

        if (error) throw error;

        res.json({
            ...project,
            pages_scanned: project.pages?.[0]?.count || 0
        });
    } catch (error) {
        console.error("Error fetching audit:", error);
        res.status(404).json({ error: "Audit not found" });
    }
});

// GET /api/audits/:id/results - Get detailed results
router.get("/:id/results", async (req, res) => {
    try {
        const { id } = req.params;
        // Fetch pages with their analysis
        // Fetch pages with their analysis
        // Fix: Use explicit foreign key and select only confirmed columns
        const { data: pages, error } = await supabase
            .from('pages')
            .select(`
                id,
                url,
                screenshot_url,
                ai_reviews!ai_reviews_page_id_fkey (
                    scores,
                    analysis
                )
            `)
            .eq('project_id', id);

        // Fallback if 'analysis' relation helper doesn't exist, we might need manual join
        // But assuming supabase generic works if foreign keys exist.

        if (error) {
            console.error("❌ Results fetch error:", error);
            throw error;
        }

        res.json({ pages });
    } catch (error) {
        console.error("Error fetching results detailed:", error);
        res.status(500).json({ error: "Failed to fetch results", details: error.message });
    }
});

// GET /api/audits/:id/report - Get PDF URL
router.get("/:id/report", async (req, res) => {
    try {
        const { id } = req.params;

        // Generate (or fetch existing) PDF URL
        const pdfUrl = await generateReport(id);

        res.json({ url: pdfUrl });

    } catch (error) {
        console.error("Report generation failed:", error);
        res.status(500).json({ error: "Report generation failed" });
    }
});

export default router;
