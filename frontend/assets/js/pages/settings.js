import { supabase } from '../supabase.js';

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

    // We wait a tick for DOM just in case, though usually fine here
    setTimeout(async () => {
        try {
            const usage = await App.getUsage();
            const audits = await App.audits.getAll();
            const count = audits.length;
            let limit = 50;
            // Best effort usage limit detection from plan or usage API
            if (usage.plan === 'pro') limit = 1000;
            // If usage API returned a limit, use it
            if (usage.pageLimit && usage.pageLimit > 50) {
                // Note: usage.pageLimit is per-audit page limit, not total audits limit.
                // So we stick to hardcoded plan limits for now unless API changes.
            }

            const subscription = await App.getSubscription();

            const percent = Math.min((count / limit) * 100, 100);

            const txt = document.getElementById('stat-usage-text');
            const bar = document.getElementById('stat-usage-bar');

            if (txt) txt.innerText = `${count} / ${limit} Audits`;
            if (bar) bar.style.width = `${percent}%`;

            if (document.getElementById('current-plan') && subscription.plan) {
                document.getElementById('current-plan').innerText = subscription.plan.toUpperCase();
            }

            // Credits
            const creditsEl = document.getElementById('credits-balance');
            if (creditsEl) {
                // Fetch latest profile because usage/subscription endpoint might not include credits yet
                const profile = await App.getProfile();
                // Note: /api/me returns user_metadata etc. 
                // Wait, default api/me in users.js returns user.user_metadata from AUTH.
                // The 'credits' column is in 'profiles' table (public schema), NOT auth.users metadata.
                // Backend /api/me needs update to return profile data or we fetch from supabase directly here.
                // Because we are using RLS on profiles, we can fetch from supabase client.

                const { data: profileData } = await supabase.from('profiles').select('credits').eq('id', App.user.id).single();
                if (profileData) {
                    creditsEl.innerText = profileData.credits || 0;
                }
            }

        } catch (e) {
            console.error("Failed to fetch usage stats", e);
        }
    }, 50);
}
