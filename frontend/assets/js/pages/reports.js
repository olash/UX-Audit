document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize App & Auth
    await App.init();
    await App.requireAuth();

    // 2. Load Layout ('nav-reports' is the ID in the html sidebar we created)
    await Layout.load('nav-reports');

    // 3. Load Content
    await Layout.loadContent('partials/reports.html');

    // 4. Page Specific Logic
    window.loadReports = async function () {
        const list = document.getElementById('reports-list');
        if (!list) return;

        try {
            list.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-sm text-slate-500">Loading reports...</td></tr>';
            const audits = await App.audits.getAll();

            if (audits.length === 0) {
                list.innerHTML = `
                    <tr>
                        <td colspan="6" class="py-16 text-center">
                            <div class="flex flex-col items-center justify-center">
                                <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                    <span class="iconify text-slate-400" data-icon="lucide:file-question" data-width="28"></span>
                                </div>
                                <h3 class="text-sm font-medium text-slate-900 mb-1">No reports generated</h3>
                                <p class="text-xs text-slate-500 mb-4">Your audit history will appear here.</p>
                                <button onclick="window.location.href='/pages/Create New Audit.html'" class="text-xs font-medium text-emerald-600 hover:text-emerald-700">Start new audit &rarr;</button>
                            </div>
                        </td>
                    </tr>
                `;
                // Zero out stats
                if (document.getElementById('rep-stat-total')) document.getElementById('rep-stat-total').innerText = '0';
                if (document.getElementById('rep-stat-month')) document.getElementById('rep-stat-month').innerText = '0';
                if (document.getElementById('rep-stat-score')) document.getElementById('rep-stat-score').innerHTML = '0<span class="text-sm text-slate-400 font-normal">/100</span>';
                if (document.getElementById('rep-stat-storage')) document.getElementById('rep-stat-storage').innerHTML = '0<span class="text-sm text-slate-400 font-normal"> MB</span>';
                return;
            }

            // Calculate Stats
            const stats = App.audits.calculateStats(audits);

            // Update DOM
            if (document.getElementById('rep-stat-total')) document.getElementById('rep-stat-total').innerText = stats.total;
            if (document.getElementById('rep-stat-month')) document.getElementById('rep-stat-month').innerText = stats.thisMonthCount;
            if (document.getElementById('rep-stat-score')) document.getElementById('rep-stat-score').innerHTML = `${stats.avgScore}<span class="text-sm text-slate-400 font-normal">/100</span>`;
            if (document.getElementById('rep-stat-storage')) document.getElementById('rep-stat-storage').innerHTML = `${stats.storageUsed}<span class="text-sm text-slate-400 font-normal"> MB</span>`;

            list.innerHTML = audits.map(audit => {
                const date = new Date(audit.created_at).toLocaleDateString();
                const score = audit.score || '--';

                let statusClass = 'bg-blue-50 text-blue-700 border-blue-100';
                let statusText = 'Running';
                let statusIcon = 'loader-2';

                if (audit.status === 'completed') {
                    statusClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                    statusText = 'Completed';
                    statusIcon = 'check-circle';
                } else if (audit.status === 'error') {
                    statusClass = 'bg-red-50 text-red-700 border-red-100';
                    statusText = 'Error';
                    statusIcon = 'alert-circle';
                }

                return `
                <tr class="group hover:bg-slate-50 transition-colors cursor-pointer" onclick="window.location.href='/pages/Dashboard_Recent Audit Page [View Result].html?id=${audit.id}'">
                    <td class="px-4 py-3 text-center" onclick="event.stopPropagation()">
                         <input type="checkbox" class="rounded border-slate-300 text-slate-900 focus:ring-slate-900 h-3.5 w-3.5 cursor-pointer">
                    </td>
                    <td class="px-4 py-3">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-medium text-xs uppercase">
                                ${new URL(audit.target_url || audit.url).hostname.substring(0, 2)}
                            </div>
                            <div>
                                <p class="text-xs font-medium text-slate-900">${new URL(audit.target_url || audit.url).hostname}</p>
                                <p class="text-[10px] text-slate-500">${audit.target_url || audit.url}</p>
                            </div>
                        </div>
                    </td>
                    <td class="px-4 py-3">
                         <div class="flex flex-col">
                            <span class="text-xs text-slate-600">${date}</span>
                            <span class="text-[10px] text-slate-400">Manual Scan</span>
                         </div>
                    </td>
                    <td class="px-4 py-3">
                        <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-xs font-bold text-slate-700 border border-slate-200">
                            ${score}
                        </span>
                    </td>
                    <td class="px-4 py-3">
                         <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium border ${statusClass} uppercase tracking-wide">
                            <span class="iconify" data-icon="lucide:${statusIcon}" data-width="10"></span>
                            ${statusText}
                         </span>
                    </td>
                     <td class="py-3 px-4 text-right" onclick="event.stopPropagation()">
                         <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button class="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 rounded transition-colors" onclick="window.location.href='/pages/Dashboard_Recent Audit Page [View Result].html?id=${audit.id}'">
                                 <span class="iconify" data-icon="lucide:eye" data-width="16"></span>
                             </button>
                         </div>
                     </td>
                </tr>
                `;
            }).join('');

            if (window.Iconify) window.Iconify.scan();

        } catch (error) {
            console.error(error);
            App.toast('error', 'Failed to refresh reports');
        }
    };

    loadReports();
});
