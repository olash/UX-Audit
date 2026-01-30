document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize App & Auth
    await App.init();
    await App.requireAuth();

    // 2. Load Layout
    // We pass 'nav-dashboard' to highlight the dashboard link in sidebar
    await Layout.load('nav-dashboard');
    Layout.setBreadcrumbs([{ label: 'Dashboard' }]);

    // 3. Load Page Content
    await Layout.loadContent('partials/dashboard.html');

    // --- REALTIME UPDATES ---
    if (App.user) {
        supabase
            .channel('dashboard-updates')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'projects',
                    filter: `user_id=eq.${App.user.id}`
                },
                (payload) => {
                    // unexpected update? reload list
                    window.fetchAudits();
                }
            )
            .subscribe();
    }

    // 4. Check if content loaded - The following logic depends on elements existing in DOM
    const list = document.getElementById('audit-list');
    if (!list) return; // Exit if load failed

    // 5. Page Specific Logic (fetchAudits)
    window.fetchAudits = async function () {
        try {
            const auditTableBody = document.getElementById('audit-list');
            if (!auditTableBody) return;

            auditTableBody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-sm text-slate-500">Loading audits...</td></tr>';

            // Fetch audits from API
            const data = await App.audits.getAll();

            // Update Stats
            const stats = App.audits.calculateStats(data);
            const elTotal = document.getElementById('stat-total');
            const elActive = document.getElementById('stat-active');
            const elCompleted = document.getElementById('stat-completed');

            if (elTotal) elTotal.innerText = stats.total;
            if (elActive) elActive.innerText = stats.active;
            if (elCompleted) elCompleted.innerText = stats.completed;

            // Render Table
            if (data.length === 0) {
                auditTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="py-16 text-center">
                            <div class="flex flex-col items-center justify-center">
                                <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                    <span class="iconify text-slate-400" data-icon="lucide:search-x" data-width="32"></span>
                                </div>
                                <h3 class="text-sm font-medium text-slate-900 mb-1">No audits found</h3>
                                <p class="text-xs text-slate-500 mb-6 max-w-xs mx-auto">Get started by creating your first audit report.</p>
                                <a href="Create New Audit.html" class="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-4 py-2.5 rounded-lg transition-colors">
                                    <span class="iconify" data-icon="lucide:plus" data-width="14"></span>
                                    New Audit
                                </a>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            auditTableBody.innerHTML = data.map(audit => {
                const pages = audit.pages_scanned || '-';
                const score = audit.score || '--';
                const date = new Date(audit.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                let statusBadge = '';
                if (audit.status === 'completed') {
                    statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">Completed</span>';
                } else if (audit.status === 'error') {
                    statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-700 border border-red-100">Error</span>';
                } else {
                    statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100 animate-pulse">Running</span>';
                }

                const displayUrl = audit.target_url ? new URL(audit.target_url).hostname : (audit.url || 'Unknown URL');

                return `
                <tr class="group border-b border-slate-50 last:border-0 hover:bg-slate-50/80 transition-colors cursor-pointer" onclick="window.location.href='/pages/Result.html?id=${audit.id}'">
                    <td class="py-3 px-6 whitespace-nowrap">
                        <div class="flex items-center gap-2">
                            <div class="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-500">
                                <span class="iconify" data-icon="lucide:globe" data-width="12"></span>
                            </div>
                            <div>
                                <div class="text-sm font-medium text-slate-900">${displayUrl}</div>
                                <div class="text-[10px] text-slate-400">${date}</div>
                            </div>
                        </div>
                    </td>
                    <td class="py-3 px-6 whitespace-nowrap">
                        ${statusBadge}
                    </td>
                    <td class="py-3 px-6 whitespace-nowrap text-xs text-slate-500 font-medium">
                        ${pages}
                    </td>
                    <td class="py-3 px-6 whitespace-nowrap">
                        <span class="text-xs font-semibold text-slate-900">${score}</span>
                    </td>
                    <td class="py-3 px-6 whitespace-nowrap text-right">
                        <span class="iconify text-slate-300 group-hover:text-slate-500 transition-colors" data-icon="lucide:chevron-right" data-width="14"></span>
                    </td>
                </tr>
            `;
            }).join('');

            // Re-scan icons
            if (window.Iconify) window.Iconify.scan();

        } catch (err) {
            console.error(err);
            App.toast('error', 'Failed to load audits. Please try again.');
        }
    };

    // Execute
    fetchAudits();
});
