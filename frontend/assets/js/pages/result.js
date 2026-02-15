document.addEventListener('DOMContentLoaded', async () => {
    // 1. Init
    await App.init();
    await App.requireAuth();
    await Layout.load('nav-reports'); // Highlight 'Reports' in nav
    await Layout.loadContent('partials/result.html');

    // ... (inside DOMContentLoaded)

    // 2. Get ID
    const urlParams = new URLSearchParams(window.location.search);
    const auditId = urlParams.get('id');

    if (!auditId) {
        App.toast('error', 'No Audit ID specified');
        setTimeout(() => window.location.href = '/pages/Reports.html', 1500);
        return;
    }

    // NEW: Realtime Subscription
    initRealtime(auditId);

    try {
        await loadFullProjectData(auditId);
    } catch (err) {
        console.error(err);
        App.toast('error', 'Failed to load audit results');
    }
});

async function loadFullProjectData(auditId) {
    // Fetch Project
    const project = await App.api.get(`/audits/${auditId}`);
    bindProjectHeader(project);
    renderProgressBlock(project);

    // Only fetch results/issues if ready (Step >= 3 implicitly, or just try and handle empty)
    // Actually, we can fetch always, but if crawling, it might be empty.

    // Fetch Results
    try {
        const { pages } = await App.api.get(`/audits/${auditId}/results`);
        // REFACTOR: Calculate breakdown from pages instead of project
        const breakdown = calculateBreakdown(pages);
        renderBreakdown(breakdown);
        renderScoreCircle(project.score); // Re-render score
        renderPages(pages);
    } catch (e) { console.warn("Results fetch skipped/failed", e); }

    // Fetch Issues
    try {
        const { issues } = await App.api.get(`/audits/${auditId}/issues`);
        renderIdentifiedIssues(issues);
        const fixes = issues ? issues.filter(i => i.ai_suggestion) : [];
        renderSuggestedFixes(fixes);
    } catch (e) { console.warn("Issues fetch skipped/failed", e); }

    // Bind Download Button
    const btn = document.getElementById('btn-download');

    // Enterprise Polish: Button States
    // Case 1: Free Plan + Monthly Source -> BLOCKED (Upgrade)
    // Case 2: Generating -> LOADING
    // Case 3: Ready -> DOWNLOAD

    // We need to know plan and payment_source. 
    // project has payment_source. We need user plan. 
    // We can fetch profile or assume passed in project (not yet).
    // Let's assume we fetch profile here or check App.user?
    // App.user has basic info. 
    // Let's fetch profile quickly or check if project has metadata.

    // Quick fetch for entitlements
    let isFreeMonthly = false;
    try {
        const { data: profile } = await App.api.get('/me'); // Assuming /api/me exists and returns plan
        const plan = (profile?.plan || 'free').toLowerCase();
        const source = project.payment_source || project.metadata?.usage_type || 'monthly';

        if (plan === 'free' && source === 'monthly') {
            isFreeMonthly = true;
        }
    } catch (e) { console.warn("Plan check failed", e); }

    if (isFreeMonthly) {
        btn.disabled = true;
        btn.innerHTML = `<span class="iconify" data-icon="lucide:lock" data-width="14"></span> Upgrade to Export`;
        btn.className = "group inline-flex items-center gap-2 bg-slate-100 text-slate-500 text-xs font-medium px-3 py-2 rounded border border-slate-200 hover:bg-slate-200 transition-colors cursor-pointer";
        btn.onclick = () => window.location.href = '/pages/Pricing.html';
        // Make it clickable to go to pricing even if "disabled" look? 
        // Better: Remove disabled attribute but keep style.
        btn.disabled = false;
    } else if (project.report_ready && project.report_url) {
        btn.disabled = false;
        btn.innerHTML = `<span class="iconify" data-icon="lucide:download" data-width="16"></span> Download Report`;
        btn.onclick = () => {
            if (window.posthog) {
                posthog.capture('report_downloaded', {
                    project_id: project.id
                });
            }
            window.open(project.report_url, '_blank');
        };
        btn.className = "group inline-flex items-center gap-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-medium px-3 py-2 rounded shadow-sm transition-all";
    } else {
        btn.disabled = true;
        btn.innerHTML = `<span class="iconify animate-spin" data-icon="lucide:loader-2" data-width="14"></span> Generating PDF...`;
        btn.className = "group inline-flex items-center gap-2 bg-slate-100 text-slate-400 text-xs font-medium px-3 py-2 rounded border border-slate-200 cursor-not-allowed";
    }

    // Bind Re-run Button
    const rerunBtn = document.getElementById('btn-rerun');
    if (rerunBtn) {
        rerunBtn.onclick = async () => {
            if (!confirm("Start a new audit for this URL? This will consume monthly limit or credits.")) return;

            rerunBtn.disabled = true;
            rerunBtn.innerHTML = `<span class="iconify animate-spin" data-icon="lucide:loader-2" data-width="14"></span> Starting...`;

            try {
                // Determine usage type preference? 
                // Default logic in audits.js handles it (Monthly -> Credits).
                // We just send the URL.
                const res = await App.api.post('/audits', {
                    url: project.target_url,
                    force_new: true // Optional flag if backend needs it, but standard POST creates new.
                });

                if (res.id) {
                    window.location.href = `/pages/Result.html?id=${res.id}`;
                } else {
                    throw new Error("No ID returned");
                }
            } catch (err) {
                console.error("Re-run failed", err);
                App.toast('error', err.message || 'Failed to restart audit');
                rerunBtn.disabled = false;
                rerunBtn.innerHTML = `<span class="iconify" data-icon="lucide:refresh-cw" data-width="14"></span> Re-run Audit`;
            }
        };
    }
}

function initRealtime(projectId) {
    const { createClient } = supabase;
    // Assuming supabase client is available globally via window.supabase or App.supabase
    // Since App.js likely imports it, we might need to access it. 
    // Checking App.js: usually it exposes `App.supabase`? 
    // If NOT exposed, we assume global `supabase` from CDN in HTML, OR we need to see how `App.js` connects.
    // The user request shows `supabase.channel(...)`.
    // I will assume `window.supabase` exists or `App.supabase` exists. 
    // Let's try `App.supabase` first, falling back to `window.supabase`.

    const client = window.supabase || (App.supabase);
    if (!client) {
        console.warn("Supabase client not found for realtime");
        return;
    }

    console.log("🔌 Connecting Realtime for project:", projectId);

    client.channel('project-progress')
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'projects',
                filter: `id=eq.${projectId}`
            },
            async (payload) => {
                console.log("⚡ Realtime Update:", payload.new);
                const newProject = payload.new;

                // Update Progress UI immediately
                renderProgressBlock(newProject);
                bindProjectHeader(newProject);

                // If step changed significantly, refetch everything to update lists
                // E.g. moving from crawling -> analyzing -> compiling
                if (newProject.audit_step >= 2) {
                    // Refetch to see incremental progress (e.g. new screenshots appearing)
                    await loadFullProjectData(projectId);
                }
            }
        )
        .subscribe();
}

function renderProgressBlock(project) {
    const container = document.getElementById('progress-container');
    const title = document.getElementById('progress-title');
    const stepText = document.getElementById('progress-step-text');
    const bar = document.getElementById('progress-bar-fill');
    const message = document.getElementById('progress-message');

    if (!container) return;

    if (project.audit_status === 'completed' || project.status === 'completed') {
        container.classList.add('hidden');
        return;
    }

    // Show it
    container.classList.remove('hidden');

    // Calc Step (1 to 5)
    // Map status to step if audit_step is missing (legacy)
    let step = project.audit_step || 0;
    const status = project.audit_status || 'queued';

    if (step === 0) {
        if (status === 'crawling') step = 1;
        if (status === 'analyzing') step = 2;
        if (status === 'compiling') step = 3;
        if (status === 'generating_report') step = 4;
        if (status === 'completed') step = 5;
    }

    const percentage = Math.min((step / 5) * 100, 100);

    stepText.textContent = `Step ${step}/5`;
    bar.style.width = `${percentage}%`;
    message.textContent = project.audit_message || 'Processing...';

    // Status Text
    if (status === 'crawling') title.textContent = 'Discovering pages';
    else if (status === 'analyzing') title.textContent = 'Analyzing UX issues';
    else if (status === 'compiling') title.textContent = 'Compiling insights';
    else if (status === 'generating_report') title.textContent = 'Generating report';
    else if (status === 'failed' || status === 'error') {
        title.textContent = 'Audit Failed';
        bar.classList.add('bg-red-500');
        message.classList.add('text-red-600');
    } else {
        title.textContent = 'Audit in progress';
    }
}

function bindProjectHeader(project) {
    if (!project) return;
    const url = new URL(project.target_url || 'http://example.com');
    document.getElementById('header-url').textContent = url.hostname;
    document.getElementById('meta-url').textContent = project.target_url;
    document.getElementById('meta-date').textContent = new Date(project.created_at).toLocaleDateString();

    // SEO: Dynamic Title & Meta
    document.title = `Audit Result: ${url.hostname} - UX Audit`;

    // Helper to set meta
    const setMeta = (name, content) => {
        let element = document.querySelector(`meta[name="${name}"]`) || document.querySelector(`meta[property="${name}"]`);
        if (!element) {
            element = document.createElement('meta');
            element.setAttribute(name.startsWith('og:') || name.startsWith('twitter:') ? 'property' : 'name', name);
            document.head.appendChild(element);
        }
        element.setAttribute('content', content);
    };

    setMeta('description', `UX Audit Report for ${url.hostname}. Score: ${project.score || 'Pending'}/100.`);
    setMeta('og:title', `UX Audit Result: ${url.hostname}`);
    setMeta('og:description', `View the comprehensive UX audit report for ${url.hostname}.`);
    setMeta('og:url', window.location.href);

    // Status
    const statusEl = document.getElementById('header-status');
    if (project.status === 'completed') {
        statusEl.textContent = 'Completed';
        statusEl.className = "px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-100";
    } else if (project.status === 'error') {
        statusEl.textContent = 'Error';
        statusEl.className = "px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-medium border border-red-100";
    } else {
        statusEl.textContent = 'In Progress';
        statusEl.className = "px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-medium border border-blue-100 animate-pulse";
    }
}

function renderScoreCircle(score) {
    const el = document.getElementById('overall-score');
    if (el) el.textContent = score || '--';

    const circle = document.getElementById('score-circle-overlay');
    if (circle && score) {
        // Circumference 2πr = 2 * 3.14159 * 40 ≈ 251.2
        const c = 251.2;
        const offset = c - ((score / 100) * c);
        // Timeout to animate
        setTimeout(() => {
            circle.style.strokeDashoffset = offset;
            // Color based on score
            if (score >= 90) circle.classList.add('text-emerald-500');
            else if (score >= 70) circle.classList.add('text-blue-500'); // blue for okay
            else if (score >= 50) circle.classList.add('text-amber-500');
            else circle.classList.add('text-red-500');
        }, 100);
    }
}

function renderBreakdown(breakdown) {
    const container = document.getElementById('score-breakdown');
    if (!container) return;

    if (!breakdown || Object.keys(breakdown).length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 col-span-2">No score breakdown available.</p>';
        return;
    }

    container.innerHTML = Object.entries(breakdown).map(([key, val]) => `
        <div>
            <div class="flex justify-between text-xs font-medium text-slate-700 mb-1 capitalize">
                <span>${key}</span>
                <span>${val}/100</span>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div class="bg-slate-900 h-full rounded-full" style="width: ${val}%"></div>
            </div>
        </div>
    `).join('');
}

function renderPages(pages) {
    const issuesContainer = document.getElementById('issues-list');
    const screenshotsContainer = document.getElementById('screenshots-grid');

    if (!issuesContainer || !screenshotsContainer) return;

    if (document.getElementById('meta-pages')) {
        document.getElementById('meta-pages').textContent = pages.length;
    }

    issuesContainer.innerHTML = '';
    screenshotsContainer.innerHTML = '';

    // Reset grids class for screenshots if needed or ensure it has grid
    screenshotsContainer.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6 transition-all duration-300 ease-in-out';

    let screenshotCount = 0;

    if (!pages || pages.length === 0) {
        screenshotsContainer.innerHTML = '<div class="p-6 text-center text-sm text-slate-500">No screenshots found.</div>';
        // Disable expand
        const btn = document.querySelector('button[onclick="toggleSection(\'screenshots-grid\')"]');
        if (btn) btn.disabled = true;
        return;
    }

    pages.forEach(page => {
        // 1. Screenshot
        // FIX: API returns screenshot_url, not screenshot_path
        if (page.screenshot_url) {
            const img = document.createElement('div');
            img.className = 'group relative rounded border border-slate-200 overflow-hidden bg-slate-100 aspect-[4/3]';
            img.innerHTML = `
                 <img src="${page.screenshot_url}" loading="lazy" class="object-cover w-full h-full transition-transform group-hover:scale-105" alt="Screenshot of ${page.url}">
                 <div class="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm p-1.5 border-t border-slate-200">
                     <p class="text-[10px] font-medium text-slate-700 truncate text-center">${new URL(page.url).pathname}</p>
                 </div>
             `;
            screenshotsContainer.appendChild(img);
            screenshotCount++;
            screenshotsContainer.appendChild(img);
            screenshotCount++;
        }
    });

    // Update Badge Counts
    const screenshotBadge = document.getElementById('screenshots-count');
    if (screenshotBadge) screenshotBadge.textContent = `(${screenshotCount})`;

    // Disable expand if 0
    if (screenshotCount === 0) {
        const btn = document.querySelector('button[onclick="toggleSection(\'screenshots-grid\')"]');
        if (btn) btn.disabled = true;
    }

    // Icons
    if (window.Iconify) window.Iconify.scan();
}

function calculateBreakdown(pages) {
    if (!pages || pages.length === 0) return {};

    const totals = {};
    const counts = {};
    const DIMENSIONS = ["usability", "navigation", "clarity", "accessibility", "aesthetics"];

    DIMENSIONS.forEach(d => { totals[d] = 0; counts[d] = 0; });

    pages.forEach(page => {
        const review = page.ai_reviews && page.ai_reviews.length > 0 ? page.ai_reviews[0] : null;
        if (review && review.scores) {
            Object.entries(review.scores).forEach(([key, val]) => {
                const k = key.toLowerCase();
                if (typeof val === 'number' && DIMENSIONS.includes(k)) {
                    totals[k] += val;
                    counts[k]++;
                }
            });
        }
    });

    const breakdown = {};
    DIMENSIONS.forEach(d => {
        if (counts[d] > 0) {
            breakdown[d] = Math.round(totals[d] / counts[d]);
        }
    });

    return breakdown;
}

function renderIdentifiedIssues(issues) {
    const container = document.getElementById('issues-list');
    if (!container) return;

    // Update Badge
    const badge = document.getElementById('issues-count');
    if (badge) badge.textContent = issues ? `(${issues.length})` : '(0)';

    // Empty State & Disable Button
    if (!issues || issues.length === 0) {
        container.innerHTML = `
            <div class="p-8 text-center bg-slate-50/50">
                <div class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-400 mb-3">
                    <span class="iconify" data-icon="lucide:check-circle" data-width="16"></span>
                </div>
                <h4 class="text-sm font-medium text-slate-900 mb-1">No issues found</h4>
                <p class="text-xs text-slate-500 max-w-xs mx-auto">This audit did not surface any critical UX issues.</p>
            </div>
        `;
        const btn = document.querySelector('button[onclick="toggleSection(\'issues-list\')"]');
        if (btn) btn.disabled = true;
        return;
    }

    container.innerHTML = issues.map(issue => {
        const severity = issue.severity ? issue.severity.toLowerCase() : 'info';
        let badgeClass = 'bg-slate-50 text-slate-600 border-slate-100';
        if (severity === 'critical') badgeClass = 'bg-red-50 text-red-700 border-red-100';
        else if (severity === 'high') badgeClass = 'bg-orange-50 text-orange-700 border-orange-100';
        else if (severity === 'medium') badgeClass = 'bg-yellow-50 text-yellow-700 border-yellow-100';

        return `
            <div class="p-5 hover:bg-slate-50/50 transition-colors">
                <div class="flex items-start gap-3">
                        <div class="mt-0.5">
                        <span class="flex items-center justify-center w-5 h-5 rounded-full text-slate-500 bg-slate-100 border border-slate-200">
                            <span class="iconify" data-icon="lucide:alert-circle" data-width="12"></span>
                        </span>
                    </div>
                    <div class="flex-1">
                        <div class="flex flex-wrap justify-between items-start gap-2 mb-1">
                            <h4 class="text-sm font-medium text-slate-900">${issue.title}</h4>
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badgeClass}">${severity}</span>
                        </div>
                        <p class="text-xs text-slate-500 leading-relaxed mb-2">${issue.description}</p>
                        
                        <div class="flex gap-2">
                            ${issue.pages && issue.pages.url ? `
                            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-500 border border-slate-200 max-w-[150px]">
                                <span class="iconify shrink-0" data-icon="lucide:link" data-width="10"></span>
                                <span class="truncate">${new URL(issue.pages.url).pathname}</span>
                            </span>` : ''}
                            ${issue.category ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-500 border border-slate-200">${issue.category}</span>` : ''}
                        </div>
                    </div>
                </div>
            </div>`;
    }).join('');

    if (window.Iconify) window.Iconify.scan();
}

function renderSuggestedFixes(fixes) {
    const container = document.getElementById('suggested-fixes-list');
    if (!container) return;

    const fixesBadge = document.getElementById('fixes-count');
    if (fixesBadge) fixesBadge.textContent = fixes ? `(${fixes.length})` : '(0)';

    // Empty State & Disable Button
    if (!fixes || fixes.length === 0) {
        container.innerHTML = `
            <div class="p-8 text-center bg-slate-50/50">
                <div class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-400 mb-3">
                    <span class="iconify" data-icon="lucide:check-circle" data-width="16"></span>
                </div>
                <h4 class="text-sm font-medium text-slate-900 mb-1">No actionable fixes needed yet</h4>
                <p class="text-xs text-slate-500 max-w-xs mx-auto">Actionable recommendations will appear here as they are generated from the audit insights.</p>
            </div>
        `;
        const btn = document.querySelector('button[onclick="toggleSection(\'suggested-fixes-list\')"]');
        if (btn) btn.disabled = true;
        return;
    }

    container.innerHTML = fixes.map(fix => {
        // Icon based on category
        let icon = 'lucide:lightbulb';
        const cat = fix.category ? fix.category.toLowerCase() : '';
        if (cat.includes('accessibility')) icon = 'lucide:accessibility';
        else if (cat.includes('usability')) icon = 'lucide:mouse-pointer-click';
        else if (cat.includes('clarity')) icon = 'lucide:eye';
        else if (cat.includes('navigation')) icon = 'lucide:compass';
        else if (cat.includes('aesthetics')) icon = 'lucide:palette';

        const severity = fix.severity ? fix.severity.toLowerCase() : 'medium';
        let badgeClass = 'bg-slate-50 text-slate-600 border-slate-100';
        if (severity === 'critical') badgeClass = 'bg-red-50 text-red-700 border-red-100';
        else if (severity === 'high') badgeClass = 'bg-orange-50 text-orange-700 border-orange-100';

        return `
            <div class="p-5 hover:bg-slate-50/50 transition-colors group">
                <div class="flex items-start gap-4">
                    <div class="mt-0.5 shrink-0">
                        <span class="flex items-center justify-center w-8 h-8 rounded-full text-blue-600 bg-blue-50 border border-blue-100 ring-2 ring-blue-50/50">
                            <span class="iconify" data-icon="${icon}" data-width="14"></span>
                        </span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex flex-wrap justify-between items-start gap-2 mb-1.5">
                            <h4 class="text-sm font-semibold text-slate-900 truncate pr-4">${fix.title}</h4>
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badgeClass}">${fix.severity}</span>
                        </div>
                        <div class="bg-slate-50 rounded p-3 mb-2 border border-slate-100">
                             <p class="text-xs text-slate-700 leading-relaxed font-medium">
                                <span class="text-blue-600 font-semibold mr-1">Fix:</span> 
                                ${fix.ai_suggestion}
                             </p>
                        </div>
                         <div class="flex gap-2">
                             ${fix.pages && fix.pages.url ? `
                                <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white text-[10px] text-slate-400 border border-slate-200 shadow-sm max-w-[150px]">
                                    <span class="iconify shrink-0" data-icon="lucide:link" data-width="10"></span>
                                    <span class="truncate">${new URL(fix.pages.url).pathname}</span>
                                </span>
                             ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (window.Iconify) window.Iconify.scan();
    if (window.Iconify) window.Iconify.scan();
}

// Global scope for HTML access
window.toggleSection = function (id) {
    const el = document.getElementById(id);
    const chevron = document.getElementById(id + '-chevron');
    if (!el) return;

    if (el.style.maxHeight === '0px' || el.classList.contains('hidden')) {
        // Expand
        el.classList.remove('hidden');
        el.style.maxHeight = el.scrollHeight + 'px';
        el.style.opacity = '1';
        el.style.padding = id === 'screenshots-grid' ? '1.5rem' : ''; // Restore padding

        if (chevron) {
            chevron.style.transform = 'rotate(180deg)';
        }
    } else {
        // Collapse
        el.style.maxHeight = el.scrollHeight + 'px'; // Set explicit height first for transition
        // Force reflow
        el.offsetHeight;
        el.style.maxHeight = '0px';
        el.style.opacity = '0';
        el.style.padding = '0'; // Remove padding to avoid gaps
        setTimeout(() => el.classList.add('hidden'), 300); // Hide after transition

        if (chevron) {
            chevron.style.transform = 'rotate(0deg)';
        }
    }
}
