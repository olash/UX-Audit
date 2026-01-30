document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize App & Auth
    await App.init();
    await App.requireAuth();

    // 2. Load Layout ('nav-new-audit' is the ID in the html sidebar)
    await Layout.load('nav-new-audit');

    // 3. Load Content
    await Layout.loadContent('partials/new-audit.html');

    // 4. Attach Event Listeners
    // We need to wait for content to load, or delegate.
    // Since Layout.loadContent awaits fetch, elements should be ready immediately after.

    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', startAudit);
    }
});

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
        let msg = 'Failed to start audit.';
        if (err.message && err.message.includes('Limit')) msg = err.message; // "Limit Exceeded"

        App.toast('error', msg);
        btn.disabled = false;
        btn.innerHTML = '<span class="iconify" data-icon="lucide:play" data-width="14" data-stroke-width="1.5"></span> Start Audit';
    }
}
