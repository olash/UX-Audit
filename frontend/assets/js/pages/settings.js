import { supabase } from '../supabase.js';
import { PLANS } from '../config/pricing.js';

let initialProfile = {};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize App & Auth
    await App.init();
    await App.requireAuth();

    // 2. Load Layout
    await Layout.load('nav-settings');
    Layout.setBreadcrumbs([{ label: 'Settings', href: '/pages/Settings.html' }, { label: 'Account' }]);

    // 3. Load Content
    await Layout.loadContent('partials/settings.html');

    // 4. Initialize Features
    await loadProfile();
    // await loadUsageStats(); // Removed
});

async function loadProfile() {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        console.error('No user session');
        return;
    }

    // Populate fields
    const emailInput = document.getElementById('email');
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    const avatarImg = document.getElementById('avatar');

    if (emailInput) emailInput.value = user.email;
    if (firstNameInput) firstNameInput.value = user.user_metadata?.first_name || '';
    if (lastNameInput) lastNameInput.value = user.user_metadata?.last_name || '';

    if (user.user_metadata?.avatar_url && avatarImg) {
        avatarImg.src = user.user_metadata.avatar_url;
    }

    // Store initial state
    initialProfile = {
        firstName: firstNameInput ? firstNameInput.value : '',
        lastName: lastNameInput ? lastNameInput.value : ''
    };

    setupChangeListeners();
    setupSaveHandler();
    setupAvatarHandler();
}

function setupChangeListeners() {
    const firstName = document.getElementById('firstName');
    const lastName = document.getElementById('lastName');
    const saveBtn = document.getElementById('saveBtn');

    if (!firstName || !lastName || !saveBtn) return;

    function checkChanges() {
        const changed =
            firstName.value !== initialProfile.firstName ||
            lastName.value !== initialProfile.lastName;

        saveBtn.disabled = !changed;
        saveBtn.classList.toggle('opacity-50', !changed);
        saveBtn.classList.toggle('cursor-not-allowed', !changed);
    }

    firstName.addEventListener('input', checkChanges);
    lastName.addEventListener('input', checkChanges);
}

function setupSaveHandler() {
    const saveBtn = document.getElementById('saveBtn');
    if (!saveBtn) return;

    saveBtn.addEventListener('click', async () => {
        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;

        // UI Loading state could be added here

        const { error } = await supabase.auth.updateUser({
            data: {
                first_name: firstName,
                last_name: lastName
            }
        });

        if (error) {
            App.toast('error', 'Failed to update profile');
            return;
        }

        App.toast('success', 'Profile updated successfully');

        initialProfile.firstName = firstName;
        initialProfile.lastName = lastName;

        // Reset button state
        saveBtn.disabled = true;
        saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
    });
}

function setupAvatarHandler() {
    const avatarUpload = document.getElementById('avatarUpload');
    const removeBtn = document.querySelector('button.text-red-600'); // Select Remove button

    // Initial state check for Remove button
    const avatarImg = document.getElementById('avatar');
    if (removeBtn) {
        // Disable if showing placeholder
        removeBtn.disabled = avatarImg && avatarImg.src.includes('avatar-placeholder.png');
        if (removeBtn.disabled) removeBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }

    // --- REMOVE HANDLER ---
    if (removeBtn) {
        removeBtn.addEventListener('click', async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !user.user_metadata?.avatar_url) return;

            // 1. Optimistic UI
            const originalSrc = avatarImg.src;
            avatarImg.src = '/avatar-placeholder.png';
            removeBtn.disabled = true;
            removeBtn.classList.add('opacity-50', 'cursor-not-allowed');

            try {
                // 2. Delete from Storage
                const avatarUrl = user.user_metadata.avatar_url;
                // Extract path: url ends with /avatars/{userId}.png usually, but let's be safe
                // Format: .../storage/v1/object/public/avatars/user_id.png
                const path = avatarUrl.split('/avatars/')[1];

                if (path) {
                    const { error: storageError } = await supabase.storage
                        .from('avatars')
                        .remove([path]);

                    if (storageError) {
                        console.error('Storage delete error:', storageError);
                        // We continue anyway to clear the DB reference, strictly speaking 
                        // we might want to stop, but clearing DB is more important for UX.
                    }
                }

                // 3. Update User Profile
                const { error: updateError } = await supabase.auth.updateUser({
                    data: { avatar_url: null }
                });

                if (updateError) throw updateError;

                App.toast('success', 'Profile photo removed');

            } catch (error) {
                console.error('Remove avatar failed:', error);
                App.toast('error', 'Failed to remove avatar');
                // Revert UI
                avatarImg.src = originalSrc;
                removeBtn.disabled = false;
                removeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        });
    }

    // --- UPLOAD HANDLER ---
    if (!avatarUpload) return;

    // --- SUBSCRIPTION & BILLING LOGIC ---

    // Listen for global usage updates (from Layout.loadUsage)
    document.addEventListener('usageUpdated', (e) => {
        renderSubscriptionSection(e.detail);
        renderPlanComparison(e.detail); // Re-render to update "Current Plan" button states
    });

    function initSubscriptionTabs() {
        const tabOverview = document.getElementById('tab-overview');
        const tabPlans = document.getElementById('tab-plans');
        const viewOverview = document.getElementById('view-overview');
        const viewPlans = document.getElementById('view-plans');

        if (!tabOverview || !tabPlans) return;

        tabOverview.addEventListener('click', () => {
            tabOverview.classList.add('bg-white', 'shadow-sm', 'text-slate-900');
            tabOverview.classList.remove('text-slate-500');
            tabPlans.classList.remove('bg-white', 'shadow-sm', 'text-slate-900');
            tabPlans.classList.add('text-slate-500');

            viewOverview.classList.remove('hidden');
            viewPlans.classList.add('hidden');
        });

        tabPlans.addEventListener('click', () => {
            tabPlans.classList.add('bg-white', 'shadow-sm', 'text-slate-900');
            tabPlans.classList.remove('text-slate-500');
            tabOverview.classList.remove('bg-white', 'shadow-sm', 'text-slate-900');
            tabOverview.classList.add('text-slate-500');

            viewOverview.classList.add('hidden');
            viewPlans.classList.remove('hidden');
        });

        // Helper to jump to plans
        window.showPlansTab = () => tabPlans.click();
    }

    /**
     * Renders the Overview Tab (Current Plan + Usage)
     */
    function renderSubscriptionSection(usage) {
        if (!usage) return;

        // 1. Current Plan Card
        const planNameEl = document.getElementById('settings-plan-name');
        const planDescEl = document.getElementById('settings-plan-desc');
        const iconContainer = document.getElementById('plan-icon-container');

        if (planNameEl) {
            const planKey = (usage.plan || 'free').toLowerCase();
            planNameEl.textContent = planKey.charAt(0).toUpperCase() + planKey.slice(1) + ' Plan';

            // Icon Styling
            if (iconContainer) {
                iconContainer.className = 'w-12 h-12 rounded-full flex items-center justify-center ';
                if (planKey === 'starter') iconContainer.classList.add('bg-blue-100', 'text-blue-600');
                else if (planKey === 'pro') iconContainer.classList.add('bg-emerald-100', 'text-emerald-600');
                else if (planKey === 'team') iconContainer.classList.add('bg-purple-100', 'text-purple-600');
                else iconContainer.classList.add('bg-slate-100', 'text-slate-500');
            }

            if (planDescEl) {
                planDescEl.textContent = `You are currently on the ${planKey} plan.`;
            }
        }

        // 2. Usage Grid
        const usedEl = document.getElementById('usage-audits-used');
        const limitEl = document.getElementById('usage-audits-limit');
        const barEl = document.getElementById('usage-audits-bar');
        const remainEl = document.getElementById('usage-audits-remaining');
        const warningEl = document.getElementById('usage-warning');
        const creditsEl = document.getElementById('usage-credits');

        if (usedEl) usedEl.textContent = usage.audits_used;
        if (limitEl) limitEl.textContent = usage.audits_per_month;

        if (barEl) {
            const pct = usage.audits_per_month > 0
                ? Math.min((usage.audits_used / usage.audits_per_month) * 100, 100)
                : 100;
            barEl.style.width = `${pct}%`;

            if (usage.audits_remaining === 0) {
                barEl.classList.add('bg-red-500');
                barEl.classList.remove('bg-slate-800');
                if (warningEl) warningEl.classList.remove('hidden');
            } else {
                barEl.classList.remove('bg-red-500');
                barEl.classList.add('bg-slate-800');
                if (warningEl) warningEl.classList.add('hidden');
            }
        }

        if (remainEl) remainEl.textContent = `${usage.audits_remaining} remaining`;
        if (creditsEl) creditsEl.textContent = usage.credits_remaining;
    }

    /**
     * Renders the Plans Comparison Grid
     */
    function renderPlanComparison(currentUsage) {
        const container = document.getElementById('plans-container');
        if (!container) return;

        const currentPlanKey = (currentUsage?.plan || 'free').toLowerCase();

        // Map through PLANS config
        const html = Object.keys(PLANS).map(key => {
            const plan = PLANS[key];
            const isCurrent = key === currentPlanKey;
            const btnState = isCurrent
                ? `<button disabled class="w-full py-2 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 opacity-75 cursor-default">Current Plan</button>`
                : `<button onclick="App.checkout('${plan.variantId}')" class="w-full py-2 rounded-md text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors">Upgrade</button>`;

            return `
            <div class="border rounded-lg p-5 flex flex-col ${isCurrent ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/10' : 'border-slate-200 bg-white'}">
                <div class="mb-4">
                    <h4 class="text-sm font-bold text-slate-900 capitalize">${key}</h4>
                    <div class="flex items-baseline gap-1 mt-1">
                        <span class="text-2xl font-bold text-slate-900">$${plan.price}</span>
                        <span class="text-[10px] text-slate-500">/mo</span>
                    </div>
                </div>
                
                <ul class="space-y-2 mb-6 flex-1">
                    <li class="flex items-start gap-2 text-xs text-slate-600">
                        <span class="iconify text-emerald-500 mt-0.5" data-icon="lucide:check" data-width="12"></span>
                        ${plan.auditLimit} Audits / mo
                    </li>
                     <li class="flex items-start gap-2 text-xs text-slate-600">
                        <span class="iconify text-emerald-500 mt-0.5" data-icon="lucide:check" data-width="12"></span>
                        Max ${plan.pageLimit} Pages / scan
                    </li>
                </ul>

                ${btnState}
            </div>
        `;
        }).join('');

        container.innerHTML = html;
        if (window.Iconify) window.Iconify.scan(container);
    }

    /**
     * Renders Credit Packs
     */
    function renderCreditPacks() {
        const container = document.getElementById('credits-container');
        if (!container) return;

        const packs = [
            { credits: 50, price: 15, id: CREDIT_PACKS.credits_50 },
            { credits: 200, price: 50, id: CREDIT_PACKS.credits_200 },
            { credits: 500, price: 100, id: CREDIT_PACKS.credits_500 }
        ];

        const html = packs.map(pack => `
        <div class="border border-slate-200 rounded-lg p-4 bg-white hover:border-indigo-300 transition-colors">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <span class="block text-lg font-bold text-slate-900">${pack.credits} Credits</span>
                    <span class="text-xs text-slate-500">One-time purchase</span>
                </div>
                <div class="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-bold">$${pack.price}</div>
            </div>
            <button onclick="App.checkout('${pack.id}')" class="w-full mt-2 py-2 rounded border border-indigo-600 text-indigo-600 hover:bg-indigo-50 text-xs font-medium transition-colors">
                Buy Credits
            </button>
        </div>
    `).join('');

        container.innerHTML = html;
    }

    // Initial Call when settings.html loads
    setTimeout(() => {
        initSubscriptionTabs();

        // If usage is already loaded in Layout
        if (App.usage) {
            renderSubscriptionSection(App.usage);
            renderPlanComparison(App.usage);
        } else {
            // Fallback or wait for event
            renderPlanComparison(); // Render generic plan cards at least
        }

        renderCreditPacks(); // Static config
    }, 100);
    // loadUsageStats: Removed per user request

    // Global helper for billing portal
    window.openBillingPortal = async () => {
        try {
            const res = await App.api.post('/create-portal-session'); // Assuming this endpoint exists or will exist
            if (res.url) window.location.href = res.url;
            else alert("Billing portal not configured yet.");
        } catch (e) {
            alert("Could not open billing portal: " + e.message);
        }
    };
