// blog-airbnb.js — Airbnb teardown article page controller
import { supabase } from '../supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    await App.init();
    await Layout.loadPublic();
    await Layout.loadContent('/pages/partials/blog-airbnb.html');

    // Lead magnet form logic
    const form = document.getElementById('lead-magnet-form');
    const emailInput = document.getElementById('lead-email');
    const submitBtn = document.getElementById('lead-submit-btn');
    const successMsg = document.getElementById('lead-success-msg');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = emailInput.value.trim();
            if (!email) return;

            submitBtn.innerText = 'Sending...';
            submitBtn.disabled = true;

            try {
                const { error } = await supabase.from('leads').insert([
                    { email: email, source: 'airbnb_teardown_pdf' }
                ]);

                if (error) throw error;

                form.classList.add('hidden');
                successMsg.classList.remove('hidden');

                if (window.posthog) {
                    posthog.capture('lead_captured', { source: 'airbnb_teardown' });
                }
            } catch (err) {
                console.error('Error capturing lead:', err);
                submitBtn.innerText = 'Error. Try again.';
                submitBtn.disabled = false;
            }
        });
    }
});
