// frontend/assets/js/auth.js

// Expects App to be available globally since app.js attaches it to window.
// We could import it, but to match the "script tag" pattern:
// <script type="module" src="app.js"></script> runs and sets window.App
// <script type="module" src="auth.js"></script> runs and uses window.App

document.addEventListener('DOMContentLoaded', () => {

    // --- LOGIN FORM ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginForm.email.value;
            const password = loginForm.password.value;
            const button = loginForm.querySelector('button[type="submit"]');
            const originalText = button.innerText;

            try {
                button.disabled = true;
                button.innerHTML = '<span class="iconify animate-spin mr-2" data-icon="lucide:loader-2"></span> Signing in...';

                await window.App.login(email, password);

                window.App.toast('success', 'Logged in successfully');
                // Allow init() to handle redirect, or force it
                setTimeout(() => window.location.href = '/pages/Dashboard_Homepage.html', 500);

            } catch (err) {
                window.App.toast('error', err.message || 'Login failed');
                button.disabled = false;
                button.innerText = originalText;
                if (window.Iconify) window.Iconify.scan(button);
            }
        });
    }

    // --- SIGNUP FORM ---
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = signupForm.email.value;
            const password = signupForm.password.value;
            const button = signupForm.querySelector('button[type="submit"]');
            const originalText = button.innerText;

            try {
                button.disabled = true;
                button.innerHTML = '<span class="iconify animate-spin mr-2" data-icon="lucide:loader-2"></span> Creating...';

                // Passing mock 'User' name
                await window.App.signup(email, password, 'User', '');

                window.App.toast('success', 'Account created! Please check your email.');
                setTimeout(() => {
                    window.location.href = '/pages/Login.html';
                }, 2000);

            } catch (err) {
                window.App.toast('error', err.message || 'Signup failed');
                button.disabled = false;
                button.innerText = originalText;
                if (window.Iconify) window.Iconify.scan(button);
            }
        });
    }

    // --- RESET PASSWORD FORM ---
    const resetForm = document.getElementById('reset-form');
    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = resetForm.email.value;
            const button = resetForm.querySelector('button[type="submit"]');
            const originalText = button.innerText;

            try {
                button.disabled = true;
                button.innerHTML = '<span class="iconify animate-spin mr-2" data-icon="lucide:loader-2"></span> Sending...';

                await window.App.resetPassword(email);

                window.App.toast('success', `Password reset link sent to ${email}`);
                button.disabled = false;
                button.innerText = 'Sent!';
            } catch (err) {
                window.App.toast('error', err.message || 'Failed to send reset link');
                button.disabled = false;
                button.innerText = originalText;
                if (window.Iconify) window.Iconify.scan(button);
            }
        });
    }

});
