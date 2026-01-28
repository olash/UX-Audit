
import { App } from '../utils/app.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Init (Skip Auth for Print Mode if running locally/via server logic, but for now we might need auth or a token. 
    // The user guide suggests passing an internal token header or similar. 
    // Since this is client-side JS fetching from API, it needs a token. 
    // We'll rely on App.init() getting the token from localStorage if user is viewing it, 
    // OR if Playwright opens it, we might need a way to pass the token.
    // Ideally Playwright can inject localStorage or we use a URL query param for the token (less secure but works for internal generation).
    // For this implementation, we will assume Playwright runs in a context that can access the data or we pass a "secret" query param that backend trusts (if backend API supported it).
    // ACTUALLY: The easiest way for Playwright to render this is if we mock the data injection or if Playwright sets the localStorage token before reloading.

    await App.init();

    // Get ID
    const urlParams = new URLSearchParams(window.location.search);
    const auditId = urlParams.get('id');

    if (!auditId) return;

    try {
        // Fetch Data
        const project = await App.api.get(`/audits/${auditId}`);
        const { pages } = await App.api.get(`/audits/${auditId}/results`);
        const { issues } = await App.api.get(`/audits/${auditId}/issues`);

        // Bind Data
        bindCover(project);
        renderBreakdown(calculateBreakdown(pages));
        renderIssues(issues);

        const fixes = issues ? issues.filter(i => i.ai_suggestion) : [];
        renderFixes(fixes);

        renderScreenshots(pages);

    } catch (err) {
        console.error("Print render error:", err);
    }
});

function bindCover(project) {
    if (!project) return;
    document.getElementById('cover-url').textContent = project.target_url;
    document.getElementById('cover-date').textContent = new Date(project.created_at).toLocaleDateString();
    document.getElementById('cover-score').textContent = project.score || '--';
}

function calculateBreakdown(pages) {
    if (!pages || pages.length === 0) return {};
    const totals = {};
    const counts = {};
    const DIMENSIONS = ["usability", "navigation", "clarity", "accessibility", "aesthetics"];
    DIMENSIONS.forEach(d => { totals[d] = 0; counts[d] = 0; });
    pages.forEach(page => {
        const review = page.ai_reviews?.[0];
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
    DIMENSIONS.forEach(d => { if (counts[d] > 0) breakdown[d] = Math.round(totals[d] / counts[d]); });
    return breakdown;
}

function renderBreakdown(breakdown) {
    const container = document.getElementById('score-breakdown');
    if (!container || !breakdown) return;

    container.innerHTML = Object.entries(breakdown).map(([key, val]) => `
        <div>
            <div class="flex justify-between text-sm font-medium text-slate-700 mb-1 capitalize">
                <span>${key}</span>
                <span>${val}/100</span>
            </div>
            <div class="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div class="bg-slate-900 h-full rounded-full" style="width: ${val}%"></div>
            </div>
        </div>
    `).join('');
}

function renderIssues(issues) {
    const container = document.getElementById('issues-list');
    if (!container) return;

    if (!issues || issues.length === 0) {
        container.innerHTML = '<p class="text-slate-500 italic">No critical issues found.</p>';
        return;
    }

    container.innerHTML = issues.map(issue => {
        const severity = issue.severity || 'Medium';
        let badgeClass = 'bg-slate-100 text-slate-700';
        if (severity.toLowerCase() === 'critical') badgeClass = 'bg-red-100 text-red-800';

        return `
        <div class="bg-slate-50 rounded-lg p-5 border border-slate-100 no-break">
            <div class="flex justify-between items-start mb-2">
                <h3 class="font-bold text-slate-900">${issue.title}</h3>
                <span class="px-2 py-1 rounded text-xs font-bold uppercase ${badgeClass}">${severity}</span>
            </div>
            <p class="text-sm text-slate-600 mb-2">${issue.description}</p>
            <div class="text-xs text-slate-500">
                Category: <span class="font-medium text-slate-700">${issue.category || 'General'}</span>
            </div>
        </div>`;
    }).join('');
}

function renderFixes(fixes) {
    const container = document.getElementById('suggested-fixes-list');
    if (!container) return;

    if (!fixes || fixes.length === 0) {
        container.innerHTML = '<p class="text-slate-500 italic">No suggestions available.</p>';
        return;
    }

    container.innerHTML = fixes.map(fix => `
        <div class="flex gap-4 p-5 bg-white border border-slate-200 rounded-lg no-break">
            <div class="shrink-0 pt-1">
                 <span class="iconify text-blue-600" data-icon="lucide:lightbulb" data-width="24"></span>
            </div>
            <div>
                <h4 class="font-bold text-slate-900 text-sm mb-1">${fix.title}</h4>
                <p class="text-sm text-slate-600">${fix.ai_suggestion}</p>
            </div>
        </div>
     `).join('');

    if (window.Iconify) window.Iconify.scan();
}

function renderScreenshots(pages) {
    const container = document.getElementById('screenshots-grid');
    if (!container || !pages) return;

    pages.forEach(page => {
        if (page.screenshot_url) {
            container.innerHTML += `
                <div class="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 no-break">
                    <img src="${page.screenshot_url}" class="w-full h-48 object-cover object-top">
                    <div class="p-2 border-t border-slate-200 bg-white">
                        <p class="text-xs text-center font-medium text-slate-600 truncate">${new URL(page.url).pathname}</p>
                    </div>
                </div>
            `;
        }
    });
}
