import cron from 'node-cron';
import { supabase } from './db/supabase.js';

// Run every day at midnight (0 0 * * *)
export async function runCleanupJob() {
    console.log('[CRON] Starting cleanup of old Free plan audits...');

    try {
        // 0. ORPHAN SWEEP: Clean up any lingering data where parent FK is null, from incomplete runs
        // Moved to the top so it ALWAYS executes before any early returns.
        console.log('[CRON] Performing orphan sweep on child tables...');
        try {
            // Step A: Fetch orphaned pages
            const { data: orphanPages, error: orphanFetchError } = await supabase
                .from('pages')
                .select('id')
                .is('project_id', null);

            if (orphanFetchError) {
                console.error('[CRON] Error fetching orphaned pages:', orphanFetchError);
            } else if (orphanPages && orphanPages.length > 0) {
                // Step B: Extract IDs
                const orphanPageIds = orphanPages.map(p => p.id);

                // Step C: Delete child records attached to these orphaned pages
                const { error: aiRevErr } = await supabase.from('ai_reviews').delete().in('page_id', orphanPageIds);
                if (aiRevErr) console.error('[CRON] Error sweeping ai_reviews:', aiRevErr);

                const { error: uxIssErr } = await supabase.from('ux_issues').delete().in('page_id', orphanPageIds);
                if (uxIssErr) console.error('[CRON] Error sweeping ux_issues (page_id null):', uxIssErr);

                // Step D: Delete the orphaned pages themselves
                const { error: pagesErr } = await supabase.from('pages').delete().is('project_id', null);
                if (pagesErr) console.error('[CRON] Error sweeping pages:', pagesErr);
            } else {
                // Just in case, try deleting orphaned pages if fetching failed somehow or no pages but we want to be sure
                const { error: fbPagesErr } = await supabase.from('pages').delete().is('project_id', null);
                if (fbPagesErr) console.error('[CRON] Error sweeping pages fallback:', fbPagesErr);
            }

            // Step E: Sweep remaining parent-linked tables where project_id null
            const { error: repErr } = await supabase.from('reports').delete().is('project_id', null);
            if (repErr && repErr.code !== '42P01') console.error('[CRON] Error sweeping reports db:', repErr);

            // Safely skip the Orphan Sweep for notifications due to JSONB cross-referencing complexity in a single query.
            // We will rely on targeted cascade deletions instead for now.
            // If we really need this in the future: await supabase.from('notifications').delete().is('meta->>project_id', null); (doesn't work exactly like this in supabase out of the box).
            // Let's sweep if we can at least ensure we don't break the whole job.
            const { error: notifErr } = await supabase.from('notifications').delete().is('meta->>project_id', null);
            if (notifErr && notifErr.code !== 'PGRST100') console.error('[CRON] Error sweeping notifications:', notifErr);

        } catch (sweepError) {
            console.error('[CRON] Critical error during orphan sweep:', sweepError);
        }
        console.log('[CRON] Orphan sweep completed.');

        // 1. Calculate the cutoff date (7 days ago)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        const cutoffIso = cutoffDate.toISOString();

        // 2. Fetch Free users
        const { data: freeProfiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id')
            .eq('plan', 'free');

        if (profilesError) {
            console.error('[CRON] Error fetching free profiles:', profilesError);
            return;
        }

        const freeUserIds = freeProfiles.map(p => p.id);
        if (freeUserIds.length === 0) {
            console.log('[CRON] No Free users found, skipping.');
            return;
        }

        // 3. Find projects belonging to Free users that are older than 7 days
        // We use 'in' to match user IDs and 'lt' for created_at
        const { data: oldProjects, error: projectsError } = await supabase
            .from('projects')
            .select('id')
            .in('user_id', freeUserIds)
            .lt('created_at', cutoffIso);

        if (projectsError) {
            console.error('[CRON] Error fetching old projects:', projectsError);
            return;
        }

        if (!oldProjects || oldProjects.length === 0) {
            console.log(`[CRON] No projects older than 7 days found for Free users.`);
            return;
        }

        const projectIds = oldProjects.map(p => p.id);
        console.log(`[CRON] Found ${projectIds.length} old project(s) to delete:`, projectIds);

        // 4. Storage Cleanup
        let deletedScreenshotsCount = 0;
        let deletedReportsCount = 0;

        for (const projectId of projectIds) {
            // -- Screenshots cleanup --
            // Screenshots are stored under the folder `projectId/`
            const { data: screenshotFiles, error: listError } = await supabase.storage
                .from('screenshots')
                .list(`${projectId}`, { limit: 100 });

            if (!listError && screenshotFiles && screenshotFiles.length > 0) {
                const filesToRemove = screenshotFiles.map(f => `${projectId}/${f.name}`);
                const { error: delScreenshotError } = await supabase.storage
                    .from('screenshots')
                    .remove(filesToRemove);

                if (!delScreenshotError) {
                    deletedScreenshotsCount += filesToRemove.length;
                } else {
                    console.error(`[CRON] Failed to delete screenshots for ${projectId}:`, delScreenshotError);
                }
            }

            // -- Reports cleanup --
            // Reports are stored as `reports/projectId.pdf`
            const reportPath = `reports/${projectId}.pdf`;
            const { error: delReportError } = await supabase.storage
                .from('reports')
                .remove([reportPath]);

            if (!delReportError) {
                deletedReportsCount++;
            } else {
                console.error(`[CRON] Failed to delete report for ${projectId}:`, delReportError);
            }
        }

        // 5. Database Cleanup - Delete child tables first to avoid foreign key violations

        // Find all pages for these projects
        const { data: pages, error: pagesFetchError } = await supabase
            .from('pages')
            .select('id')
            .in('project_id', projectIds);

        if (pagesFetchError) {
            console.error('[CRON] Error fetching pages for projects:', pagesFetchError);
        } else if (pages && pages.length > 0) {
            const pageIds = pages.map(p => p.id);

            // Delete from ai_reviews
            const { error: aiReviewsDelError } = await supabase
                .from('ai_reviews')
                .delete()
                .in('page_id', pageIds);
            if (aiReviewsDelError) console.error('[CRON] Error deleting ai_reviews:', aiReviewsDelError);

            // Delete from ux_issues (by page_id first)
            const { error: uxIssuesDelError } = await supabase
                .from('ux_issues')
                .delete()
                .in('page_id', pageIds);
            if (uxIssuesDelError) console.error('[CRON] Error deleting ux_issues:', uxIssuesDelError);

            // Delete from ux_issues (by project_id, if schema supports it)
            const { error: uxProjErr } = await supabase.from('ux_issues').delete().in('project_id', projectIds);
            if (uxProjErr) console.error('[CRON] Error fallback deleting ux_issues by project_id:', uxProjErr);

            // Delete from project_issues (REMOVED - It is a view, not a table)
            // await supabase.from('project_issues').delete().in('project_id', projectIds);

            // Delete from reports (database table)
            const { error: repProjErr } = await supabase.from('reports').delete().in('project_id', projectIds);
            if (repProjErr) console.error('[CRON] Error fallback deleting reports by project_id:', repProjErr);

            // Delete from notifications using new JSONB meta column
            const { error: notifProjErr } = await supabase.from('notifications').delete().in('meta->>project_id', projectIds);
            if (notifProjErr) console.error('[CRON] Error deleting notifications by jsonb project_id:', notifProjErr);

            // Delete from pages
            const { error: pagesDelError } = await supabase
                .from('pages')
                .delete()
                .in('project_id', projectIds);
            if (pagesDelError) console.error('[CRON] Error deleting pages:', pagesDelError);
        } else {
            // No pages found, but we should still attempt to delete from parent-linked tables just in case
            const { error: fallbackUxErr } = await supabase.from('ux_issues').delete().in('project_id', projectIds);
            if (fallbackUxErr) console.error('[CRON] Error fallback deleting ux_issues:', fallbackUxErr);

            // await supabase.from('project_issues').delete().in('project_id', projectIds); (REMOVED - View)

            const { error: fallbackRepErr } = await supabase.from('reports').delete().in('project_id', projectIds);
            if (fallbackRepErr) console.error('[CRON] Error fallback deleting reports:', fallbackRepErr);

            const { error: fallbackNotifErr } = await supabase.from('notifications').delete().in('meta->>project_id', projectIds);
            if (fallbackNotifErr) console.error('[CRON] Error fallback deleting notifications using jsonb:', fallbackNotifErr);

            const { error: pagesDelError } = await supabase
                .from('pages')
                .delete()
                .in('project_id', projectIds);
            if (pagesDelError) console.error('[CRON] Error deleting pages:', pagesDelError);
        }

        // 6. PARENT DELETE: Now safe to delete the projects
        const { error: deletionError } = await supabase
            .from('projects')
            .delete()
            .in('id', projectIds);

        if (deletionError) {
            console.error('[CRON] Error deleting projects from DB:', deletionError);
        } else {
            console.log(`[CRON] ✅ Successfully deleted ${projectIds.length} projects from database.`);
            console.log(`[CRON] ✅ Cleaned up ${deletedScreenshotsCount} screenshots and ${deletedReportsCount} reports from Storage.`);
        }

    } catch (error) {
        console.error('[CRON] Unknown error during cleanup:', error);
    }
}

// Run every day at midnight (0 0 * * *)
cron.schedule('0 0 * * *', runCleanupJob);
