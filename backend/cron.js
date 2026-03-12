import cron from 'node-cron';
import { supabase } from './db/supabase.js';

// Run every day at midnight (0 0 * * *)
export async function runCleanupJob() {
    console.log('[CRON] Starting cleanup of old Free plan audits...');

    try {
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
            await supabase.from('ux_issues').delete().in('project_id', projectIds).catch(() => {});
            
            // Delete from project_issues
            await supabase.from('project_issues').delete().in('project_id', projectIds).catch(() => {});
            
            // Delete from reports (database table)
            await supabase.from('reports').delete().in('project_id', projectIds).catch(() => {});
            
            // Delete from notifications
            await supabase.from('notifications').delete().in('project_id', projectIds).catch(() => {});
            
            // Delete from pages
            const { error: pagesDelError } = await supabase
                .from('pages')
                .delete()
                .in('project_id', projectIds);
            if (pagesDelError) console.error('[CRON] Error deleting pages:', pagesDelError);
        } else {
            // No pages found, but we should still attempt to delete from parent-linked tables just in case
            await supabase.from('ux_issues').delete().in('project_id', projectIds).catch(() => {});
            await supabase.from('project_issues').delete().in('project_id', projectIds).catch(() => {});
            await supabase.from('reports').delete().in('project_id', projectIds).catch(() => {});
            await supabase.from('notifications').delete().in('project_id', projectIds).catch(() => {});

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
        
        // 7. ORPHAN SWEEP: Clean up any lingering data where parent FK is null, from incomplete runs
        console.log('[CRON] Performing orphan sweep on child tables...');
        const sweeps = [
            supabase.from('ai_reviews').delete().is('page_id', null).then(r => r.error && console.error('[CRON] Error sweeping ai_reviews:', r.error)),
            supabase.from('ux_issues').delete().is('page_id', null).then(r => r.error && console.error('[CRON] Error sweeping ux_issues (page_id null):', r.error)),
            supabase.from('project_issues').delete().is('project_id', null).then(r => r.error && r.error.code !== '42P01' && console.error('[CRON] Error sweeping project_issues:', r.error)),
            supabase.from('reports').delete().is('project_id', null).then(r => r.error && r.error.code !== '42P01' && console.error('[CRON] Error sweeping reports db:', r.error)),
            supabase.from('pages').delete().is('project_id', null).then(r => r.error && console.error('[CRON] Error sweeping pages:', r.error))
        ];
        await Promise.allSettled(sweeps);
        console.log('[CRON] Orphan sweep completed.');

    } catch (error) {
        console.error('[CRON] Unknown error during cleanup:', error);
    }
}

// Run every day at midnight (0 0 * * *)
cron.schedule('0 0 * * *', runCleanupJob);
