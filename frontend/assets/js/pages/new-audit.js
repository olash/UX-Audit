import { PLANS } from '../config/pricing.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize App & Auth
    await App.init();
    await App.requireAuth();

    // 2. Load Layout ('nav-new-audit' is the ID in the html sidebar)
    await Layout.load('nav-new-audit');

    // 3. Load Content
    await Layout.loadContent('partials/new-audit.html');

    // 4. Attach Event Listeners
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', startAudit);
    }

    // 5. Initialize Cost Preview
    updateCostPreview();
});

async function updateCostPreview() {
    const previewEl = document.getElementById('cost-preview');
    const detailsEl = document.getElementById('cost-details');
    if (!previewEl || !detailsEl) return;

    try {
        const usage = await App.getUsage();
        const profile = await App.getProfile();

        const planKey = (profile.plan || 'free').toLowerCase();
        const currentPlan = PLANS[planKey] || PLANS.free;

        const monthlyUsed = usage.thisMonthCount || 0;
        const monthlyLimit = currentPlan.auditLimit;

        if (monthlyUsed < monthlyLimit) {
            // Using Monthly
            previewEl.classList.remove('hidden');
            detailsEl.innerHTML = `
                <span class="font-semibold text-emerald-700">✓ 1 Monthly Audit</span><br>
                <span class="text-xs text-slate-500">You have ${monthlyLimit - monthlyUsed} monthly audits remaining.</span>
            `;
        } else {
            // Using Credits
            const balance = profile.credits || 0;
            const maxPages = currentPlan.pageLimit;

            previewEl.classList.remove('hidden');
            if (balance < 1) {
                detailsEl.innerHTML = `
                    <span class="font-semibold text-red-600">Insufficient Credits</span><br>
                    <span class="text-xs text-slate-500">You used all monthly audits. <a href="/pages/Pricing.html" class="underline text-emerald-600">Buy credits</a> to continue.</span>
                `;
                const btn = document.getElementById('start-btn');
                if (btn) btn.disabled = true;
            } else {
                detailsEl.innerHTML = `
                    <span class="font-semibold text-amber-600">⚡ Uses Credits</span><br>
                    <span class="text-xs text-slate-500">Monthly limit reached. This audit will use credits.<br><strong>Limit: Up to ${balance} Pages</strong> (1 credit/page).<br>Balance: ${balance} credits.</span>
                `;
            }
        }
    } catch (e) {
        console.error("Cost preview error", e);
    }
}

async function startAudit() {
    const urlInput = document.getElementById('url');
    const url = urlInput.value;
    const btn = document.getElementById('start-btn');

    if (!url) {
        App.toast('error', 'Please enter a valid URL');
        urlInput.focus();
        return;
    }

    try {
        // Loading State
        btn.disabled = true;
        btn.innerHTML = '<span class="iconify animate-spin" data-icon="lucide:loader-2" data-width="14"></span> Starting...';

        // Call API
        const res = await App.audits.create(url);
        App.toast('success', 'Audit started successfully');

        // Redirect to result page (or dashboard)
        // If the API returns an ID, we can go straight to results
        // audits.js returns { message, auditId }

        setTimeout(() => {
            if (res.auditId) {
                // If the scraper is fast enough or async, we might see it running
                // But usually we go to dashboard or the specific result page
                window.location.href = `/pages/Result.html?id=${res.auditId}`;
            } else {
                window.location.href = 'Dashboard_Homepage.html';
            }
        }, 1000);

    } catch (err) {
        console.error(err);
        // App.api now throws the actual message from backend
        App.toast('error', err.message || 'Failed to start audit.');

        btn.disabled = false;
        btn.innerHTML = '<span class="iconify" data-icon="lucide:play" data-width="14" data-stroke-width="1.5"></span> Start Audit';
    }
}
