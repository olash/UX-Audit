import { supabase } from '../supabase.js';
import { PLANS } from '../config/pricing.js';

let initialProfile = {};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize App & Auth
    await App.init();
    await App.requireAuth();

    // 2. Load Layout
    await Layout.load('nav-settings');
    Layout.setBreadcrumbs([{ label: 'Settings', href: '/settings' }, { label: 'Account' }]);

    // 3. Load Content
    await Layout.loadContent('partials/settings.html');

    // 4. Initialize Features
    await loadProfile();
    await loadUsageStats();
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

    avatarUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];

        console.log(file, file?.type, file?.size);

        if (!file) return;

        if (file.size === 0 || !file.type.startsWith('image/')) {
            App.toast('error', 'Invalid file. Please upload a valid image (PNG or JPEG).');
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        const filePath = `${user.id}.png`; // Keep simple for now

        try {
            const { data, error } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, {
                    upsert: true,
                    contentType: file.type
                });

            if (error) {
                console.error('Upload Error:', error);
                throw error;
            }

            const { data: publicData } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // Add timestamp to bust cache
            const publicUrl = `${publicData.publicUrl}?t=${new Date().getTime()}`;

            const { error: updateError } = await supabase.auth.updateUser({
                data: {
                    avatar_url: publicUrl
                }
            });

            if (updateError) {
                console.error('Update User Error:', updateError);
                throw updateError;
            }

            document.getElementById('avatar').src = publicUrl;
            App.toast('success', 'Avatar updated');

            // Re-enable remove button
            if (removeBtn) {
                removeBtn.disabled = false;
                removeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }

        } catch (err) {
            console.error('Avatar upload failed', err);
            App.toast('error', 'Failed to upload avatar: ' + (err.message || 'Unknown error'));
        }
    });
}

async function loadUsageStats() {
    if (!App.user) return;

    const container = document.getElementById('subscription-section');
    if (!container) return;

    // Loading State
    container.innerHTML = `
        <div class="animate-pulse space-y-4">
            <div class="h-6 bg-slate-200 rounded w-1/4"></div>
            <div class="h-40 bg-slate-100 rounded-lg border border-slate-200"></div>
        </div>
    `;

    try {
        const data = await App.api.get('/user/usage');

        // Structure: { plan, audits_per_month, audits_used, audits_remaining, credits, reset_date }

        const planKey = (data.plan || 'free').toLowerCase();
        let planName = planKey.charAt(0).toUpperCase() + planKey.slice(1);
        if (planKey === 'team') planName = 'Agency';
        const resetDate = new Date(data.reset_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

        // --- VISUAL LOGIC ---
        let badgeClass = 'bg-slate-100 text-slate-600 border-slate-200';
        let planDesc = 'You are on the Free plan. Upgrade for more power.';
        let progressBarColor = 'bg-slate-900';

        if (planKey === 'starter') {
            badgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
            planDesc = 'Starter plan active. Thank you for your support!';
        } else if (planKey === 'pro') {
            badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
            planDesc = 'Pro plan active. You have access to advanced features.';
            progressBarColor = 'bg-emerald-600';
        } else if (planKey === 'team') {
            badgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
            planDesc = 'Agency plan active.';
            progressBarColor = 'bg-purple-600';
        }

        const percent = Math.min((data.audits_used / data.audits_per_month) * 100, 100);
        if (percent > 90 && data.credits < 1) progressBarColor = 'bg-red-500';

        // --- RENDER ---
        container.innerHTML = `
            <div class="mb-4 flex items-center justify-between">
                <div>
                    <h2 class="text-base font-medium text-slate-900 tracking-tight">Subscription</h2>
                    <p class="text-xs text-slate-500 mt-0.5">Manage your plan and usage.</p>
                </div>
            </div>

            <div class="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden divide-y divide-slate-100">
                
                <!-- 1. Plan Card -->
                <div class="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div class="flex items-start gap-4">
                        <div class="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0">
                             <span class="iconify text-slate-900" data-icon="lucide:zap" data-width="20"></span>
                        </div>
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <h3 class="text-sm font-semibold text-slate-900">${planName} Plan</h3>
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}">Active</span>
                            </div>
                            <p class="text-xs text-slate-500">${planDesc}</p>
                        </div>
                    </div>
                    
                    <!-- Actions -->
                    <div class="flex items-center gap-3">
                         ${planKey === 'free'
                ? `<button onclick="window.location.href='/pricing'" class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md shadow-sm transition-colors">Upgrade Plan</button>`
                : `<button onclick="window.location.href='/pricing'" class="px-3 py-2 text-slate-600 hover:text-slate-900 text-xs font-medium bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors">Change Plan</button>
                               <button onclick="openBillingPortal()" class="px-3 py-2 text-slate-500 hover:text-slate-800 text-xs font-medium decoration-slate-300 underline-offset-2 hover:underline">Manage Billing</button>`
            }
                    </div>
                </div>

                <!-- 2. Usage Details -->
                <div class="p-6 bg-slate-50/50">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <div class="flex justify-between items-end mb-2">
                                <span class="text-xs font-medium text-slate-700">Monthly Audits</span>
                                <span class="text-xs text-slate-500">${data.audits_used} / ${data.audits_per_month}</span>
                            </div>
                            <div class="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-2">
                                <div class="h-full ${progressBarColor} transition-all duration-1000" style="width: ${percent}%"></div>
                            </div>
                            <p class="text-[10px] text-slate-400">Resets on ${resetDate}</p>
                        </div>

                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-xs font-medium text-slate-700">Credit Balance</span>
                                <button onclick="window.location.href='/pricing#credits'" class="text-[10px] font-medium text-emerald-600 hover:text-emerald-700">+ Buy Credits</button>
                            </div>
                            <div class="flex items-center gap-2">
                                <div class="text-xl font-bold text-slate-900 tracking-tight">${data.credits}</div>
                                <span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">Available</span>
                            </div>
                             <p class="text-[10px] text-slate-400 mt-1">Credits are used when monthly limit is reached.</p>
                        </div>
                    </div>
                </div>

            </div>
        `;

        if (window.Iconify) window.Iconify.scan(container);

    } catch (err) {
        console.error("Failed to load usage stats:", err);
        container.innerHTML += `<div class="p-4 bg-red-50 text-red-600 text-xs rounded border border-red-100">Failed to load subscription data.</div>`;
    }
}

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
