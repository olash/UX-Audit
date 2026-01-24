// frontend/assets/js/app.js
import { supabase } from './supabase.js';

// Create single instance - REMOVED (imported above)

const App = {
    // Auth State
    user: null,
    supabase: supabase, // Expose if needed

    init: async () => {
        // Check active session
        const { data: { session } } = await supabase.auth.getSession();
        App.user = session?.user || null;

        // Listen for auth changes
        supabase.auth.onAuthStateChange((event, session) => {
            App.user = session?.user || null;
            if (event === 'USER_UPDATED' || event === 'SIGNED_IN') {
                // Update header if layout is loaded
                if (window.Layout && window.Layout.updateHeaderUser) {
                    window.Layout.updateHeaderUser();
                }
            }

            console.log("Auth Event:", event, App.user);

            if (event === 'SIGNED_IN') {
                // Check for redirect memory
                const redirect = localStorage.getItem('postLoginRedirect');
                if (redirect) {
                    localStorage.removeItem('postLoginRedirect');
                    window.location.href = redirect;
                    return;
                }

                // If on login page, redirect to dashboard
                // Only redirect if explicitly on an auth page to avoid redirect loops
                const isAuthPage = ['Login.html', 'Signup.html', 'ResetPassword.html'].some(p => window.location.pathname.includes(p));
                if (isAuthPage) {
                    window.location.href = '/pages/Dashboard_Homepage.html';
                }
            }
            if (event === 'SIGNED_OUT') {
                // Only redirect if NOT on an auth page already
                const isAuthPage = ['Login.html', 'Signup.html', 'ResetPassword.html', 'Landing Page.html', 'index.html'].some(p => window.location.pathname.includes(p));
                // Allow public landing page
                if (!isAuthPage && window.location.pathname !== '/' && !window.location.pathname.endsWith('/pages/index.html')) {
                    window.location.href = '/pages/index.html';
                }
            }
        });
    },

    // Auth Actions
    login: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        console.log('AUTH RESULT', { data, error });

        if (error) {
            alert(error.message);
            throw error;
        }
        return data;
    },

    signup: async (email, password, firstName, lastName) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { first_name: firstName, last_name: lastName }
            }
        });
        if (error) throw error;
        return data;
    },

    resetPassword: async (email) => {
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/frontend/pages/ResetPassword.html'
        });
        if (error) throw error;
        return data;
    },

    // User Data Helpers
    async getProfile() {
        return await App.api.get('/me');
    },

    async getUsage() {
        return await App.api.get('/usage');
    },

    async getSubscription() {
        return await App.api.get('/subscription');
    },

    logout: async () => {
        await supabase.auth.signOut();
        window.location.replace('/pages/index.html');
    },

    // API Helper
    api: {
        baseUrl: 'https://api.tryuxaudit.com',

        async getAuthHeaders() {
            const { data, error } = await supabase.auth.getSession();

            if (error || !data?.session?.access_token) {
                console.error('❌ No active session found');
                throw new Error('Not authenticated');
            }

            return {
                'Authorization': `Bearer ${data.session.access_token}`,
                'Content-Type': 'application/json'
            };
        },

        async get(endpoint) {
            const headers = await this.getAuthHeaders();
            const res = await fetch(`${this.baseUrl}/api${endpoint}`, { headers });
            if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
            return res.json();
        },

        async post(endpoint, body) {
            const headers = await this.getAuthHeaders();

            const res = await fetch(`${this.baseUrl}/api${endpoint}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`API Error: ${text}`);
            }

            return res.json();
        }
    },

    // Domain Helpers
    audits: {
        async getAll(filters = {}) {
            const query = new URLSearchParams(filters).toString();
            return await App.api.get(`/audits?${query}`);
        },

        async get(id) {
            return await App.api.get(`/audits/${id}`);
        },

        async getResults(id) {
            return await App.api.get(`/audits/${id}/results`);
        },

        async create(url) {
            return await App.api.post('/audits', { url });
        },

        // Client-side stats calculation to centralize logic
        calculateStats(audits) {
            const total = audits.length;
            const completed = audits.filter(a => a.status === 'completed').length;
            const active = total - completed;

            // Score calculation
            const scoredAudits = audits.filter(a => a.score > 0);
            const avgScore = scoredAudits.length > 0
                ? Math.round(scoredAudits.reduce((acc, a) => acc + a.score, 0) / scoredAudits.length)
                : 0;

            // Simple storage estimate (mock)
            const storageUsed = Math.round(total * 5.2);

            // Monthly stats
            const now = new Date();
            const thisMonthCount = audits.filter(a => {
                const d = new Date(a.created_at);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).length;

            return { total, completed, active, avgScore, storageUsed, thisMonthCount };
        }
    },

    // Guard Clause for Protected Pages
    requireAuth: async () => {
        // Wait for init if not ready
        if (!App.user) {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                // If not on an auth page, redirect
                const isAuthPage = ['Login.html', 'Signup.html', 'ResetPassword.html'].some(p => window.location.pathname.includes(p));
                if (!isAuthPage) {
                    // Save Redirect Memory
                    localStorage.setItem('postLoginRedirect', window.location.href);
                    window.location.href = '/pages/Login.html';
                }
                throw new Error("Unauthorized");
            }
            App.user = session.user;
        }
    },

    // UI Helpers
    toast: (type, message) => {
        // Create container if not exists
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none';
            document.body.appendChild(container);
        }

        // Create Toast
        const el = document.createElement('div');
        el.className = 'animate-[slideUp_0.3s_ease-out] pointer-events-auto bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg shadow-slate-300 flex items-center gap-3 border border-slate-800 min-w-[300px]';

        let icon = 'info';
        let colorClass = 'bg-blue-500';

        if (type === 'success') {
            icon = 'check';
            colorClass = 'bg-emerald-500';
        } else if (type === 'error') {
            icon = 'alert-triangle';
            colorClass = 'bg-red-500';
        }

        el.innerHTML = `
            <div class="w-5 h-5 rounded-full ${colorClass} flex items-center justify-center text-slate-950 flex-shrink-0">
                <span class="iconify" data-icon="lucide:${icon}" data-width="12" data-stroke-width="3"></span>
            </div>
            <div class="flex-1">
                <p class="text-xs font-medium">${message}</p>
            </div>
            <button class="ml-2 text-slate-400 hover:text-white transition-colors" onclick="this.parentElement.remove()">
                <span class="iconify" data-icon="lucide:x" data-width="14"></span>
            </button>
        `;

        container.appendChild(el);

        // Refresh icons
        if (window.Iconify) window.Iconify.scan(el);

        // Auto remove
        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(10px)';
            el.style.transition = 'all 0.3s ease-out';
            setTimeout(() => el.remove(), 300);
        }, 5000);
    }
};

// Global Exposure (for backward compat with inline scripts if any remain)
window.App = App;
window.supabase = supabase; // Explicitly expose supabase if needed by older scripts (though we aim to remove)

// Auto-init
App.init();

export default App; // Compatibility
