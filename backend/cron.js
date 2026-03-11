import cron from 'node-cron';
import { supabase } from './db/supabase.js';

// Run every day at midnight (0 0 * * *)
cron.schedule('0 0 * * *', async () => {
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

        // 5. Database Cleanup - Delete projects
        // Assuming cascade deletion on child tables, deleting the project deletes its pages/issues
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
});
