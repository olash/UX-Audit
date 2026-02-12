import { PLANS, CREDIT_PACKS } from '../config/pricing.js';
import posthog from '../lib/posthog.js';
// Note: App and Layout are global or imported via main module pattern usually, but here we assume ES modules.
// We need to access App.user to decide button state.

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize App (check auth)
    await App.init();

    // We don't enforce auth for pricing page, so no App.requireAuth()

    // 2. Load Layout (Public or Dashboard depending on auth?)
    // Actually pricing page usually has public nav. 
    // If we want consistency, we can check auth. 
    // If logged in -> show dashboard layout? Or just public layout with "Dashboard" button?
    // Let's stick to the current design: Public Navbar (handled by index.html usually) OR 
    // since we are refactoring to use Layout, let's load a 'nav-public' or similar if we had it.
    // However, existing pages use 'nav-dashboard' for sidebar. 
    // Let's Assume this page is inside the app -> User wants to see pricing to upgrade.
    // If the user meant the Public Landing Page pricing section, that's different.
    // The request implies "Pricing Page (Antigravity / Next.js)" style.
    // We will render the partial inside the main #app div.

    // If user IS logged in, we might want the sidebar. 
    // If NOT logged in, we want full width.
    // Complexity: The `Layout` helper loads sidebar implementation `dashboard-layout.html`.
    // We probably want a simple header for non-logged in users.
    // For now, let's detect auth.

    // Layout Decision
    if (App.user) {
        // Logged In -> Dashboard Layout
        await Layout.load('nav-pricing');
    } else {
        // Logged Out -> Public Layout
        await Layout.loadPublic();
    }

    // 3. Load Content
    await Layout.loadContent('partials/pricing.html');

    // 4. Render Cards
    renderPlans();
    renderCredits();
});

function renderPlans() {
    const container = document.getElementById('plans-container');
    if (!container) return;

    container.innerHTML = Object.entries(PLANS).map(([key, plan]) => {
        const isCurrent = false; // TODO: Check user plan
        const btnText = App.user ? (isCurrent ? 'Current Plan' : 'Upgrade') : 'Sign in to continue';
        const btnAction = App.user ? `purchaseSubscription('${key}')` : `window.location.href='Login.html'`;
        const btnClass = key === 'pro'
            ? 'bg-slate-900 text-white hover:bg-slate-800'
            : 'bg-slate-50 text-slate-900 border border-slate-200 hover:bg-slate-100';

        const featuresList = plan.features.map(f => `
            <li class="flex gap-2">
                <span class="iconify text-emerald-500" data-icon="lucide:check" data-width="16"></span>
                <span class="text-slate-600">${f}</span>
            </li>
        `).join('');

        return `
        <div class="border border-slate-200 rounded-xl p-6 flex flex-col bg-white ${key === 'pro' ? 'ring-2 ring-slate-900 relative' : ''}">
            ${key === 'pro' ? '<div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-semibold px-3 py-1 rounded-full">Most Popular</div>' : ''}
            <div class="mb-4">
                <h3 class="text-lg font-semibold text-slate-900">${plan.name}</h3>
                <div class="mt-2 flex items-baseline gap-1">
                    <span class="text-3xl font-bold tracking-tight">$${plan.price}</span>
                    <span class="text-slate-500 text-sm">/ month</span>
                </div>
                <p class="text-sm text-slate-500 mt-2">${plan.auditLimit} audits · ${plan.pageLimit} pages/audit</p>
            </div>
            
            <ul class="space-y-3 text-sm flex-1 mb-6">
                ${featuresList}
            </ul>

            <button onclick="${btnAction}" 
                class="w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${btnClass}">
                ${btnText}
            </button>
        </div>
        `;
    }).join('');

    if (window.Iconify) window.Iconify.scan(container);
}

function renderCredits() {
    const container = document.getElementById('credits-container');
    if (!container) return;

    container.innerHTML = CREDIT_PACKS.map(pack => {
        const btnText = App.user ? 'Buy Credits' : 'Sign in to continue';
        const btnAction = App.user ? `purchaseCredits(${pack.credits})` : `window.location.href='Login.html'`;

        return `
        <div class="border border-slate-200 rounded-xl p-6 flex flex-col bg-white">
            <div class="mb-4">
                <h3 class="text-lg font-semibold text-slate-900">${pack.credits} Credits</h3>
                <div class="mt-2 flex items-baseline gap-1">
                    <span class="text-3xl font-bold tracking-tight">$${pack.price}</span>
                </div>
            </div>
            <button onclick="${btnAction}" 
                class="w-full bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 py-2.5 rounded-lg text-sm font-medium transition-colors">
                ${btnText}
            </button>
        </div>
        `;
    }).join('');
}

// Global actions
// Global actions
window.purchaseSubscription = async (planKey) => {
    try {
        posthog.capture('upgrade_clicked', {
            from_plan: App.user?.user_metadata?.plan || 'free',
            to_plan: planKey
        });

        const plan = PLANS[planKey];
        if (!plan || !plan.variantId) {
            App.toast('error', 'Plan not available for purchase');
            return;
        }

        const res = await App.api.post('/checkout', { productId: plan.variantId });
        if (res.url) window.location.href = res.url;
    } catch (e) {
        App.toast('error', `Checkout failed: ${e.message}`);
    }
};

window.purchaseCredits = async (amount) => {
    try {
        posthog.capture('credits_purchase_clicked', {
            amount: amount
        });

        const pack = CREDIT_PACKS.find(p => p.credits === amount);
        if (!pack || !pack.variantId) {
            App.toast('error', 'Pack not available');
            return;
        }

        const res = await App.api.post('/checkout', { productId: pack.variantId });
        if (res.url) window.location.href = res.url;
    } catch (e) {
        App.toast('error', `Checkout failed: ${e.message}`);
    }
};
