// blog-lead.js
import { supabase } from '../supabase.js';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('lead-magnet-form');
    const emailInput = document.getElementById('lead-email');
    const submitBtn = document.getElementById('lead-submit-btn');
    const successMsg = document.getElementById('lead-success-msg');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = emailInput.value.trim();
            if (!email) return;

            // Visual loading state
            const originalText = submitBtn.innerText;
            submitBtn.innerText = 'Sending...';
            submitBtn.disabled = true;

            try {
                // Save the lead to Supabase
                // Note: You will need to create a 'leads' table in Supabase with columns: id, email, source
                const { error } = await supabase.from('leads').insert([
                    { email: email, source: 'stripe_teardown_pdf' }
                ]);

                if (error) throw error;

                // Show success message
                form.classList.add('hidden');
                successMsg.classList.remove('hidden');

                // Optional: Fire an event to PostHog to track the conversion
                if (window.posthog) {
                    posthog.capture('lead_captured', { source: 'stripe_teardown' });
                }

            } catch (err) {
                console.error('Error capturing lead:', err);
                submitBtn.innerText = 'Error. Try again.';
                submitBtn.disabled = false;
            }
        });
    }
});
