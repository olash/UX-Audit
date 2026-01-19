const Layout = {
    /**
     * Loads the shared dashboard layout into the #app container
     * @param {string} activeNavId - ID of the nav item to highlight (e.g., 'nav-dashboard')
     */
    load: async function (activeNavId) {
        try {
            const response = await fetch('../components/dashboard-layout.html');
            const html = await response.text();
            document.getElementById('app').innerHTML = html;

            // --- EVENT LISTENERS ---

            // 1. Mobile Menu
            const menuToggle = document.getElementById('mobileMenuToggle');
            const menu = document.getElementById('mobileMenu');
            if (menuToggle && menu) {
                menuToggle.addEventListener('click', () => {
                    menu.classList.toggle('hidden');
                });
            }

            // 2. Notifications
            const notifBtn = document.getElementById('notifBtn');
            const notifMenu = document.getElementById('notifMenu');
            if (notifBtn && notifMenu) {
                notifBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent closing immediately
                    notifMenu.classList.toggle('hidden');
                });

                // Close on click outside
                document.addEventListener('click', (e) => {
                    if (!notifBtn.contains(e.target) && !notifMenu.contains(e.target)) {
                        notifMenu.classList.add('hidden');
                    }
                });
            }

            // 3. Logout
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', async () => {
                    await App.logout();
                });
            }

            // Highlight Active Nav
            if (activeNavId) {
                const el = document.getElementById(activeNavId);
                if (el) {
                    el.classList.remove('text-slate-400', 'hover:text-white', 'hover:bg-white/5');
                    el.classList.add('bg-emerald-500/10', 'text-emerald-400');
                    const icon = el.querySelector('.iconify');
                    if (icon) icon.classList.remove('group-hover:text-emerald-400');
                }
            }

            // Update User Info in Header
            this.updateHeaderUser();

            // Initialize Icons
            if (window.Iconify) window.Iconify.scan();

            // Load Notifications (Async)
            this.loadNotifications();

            return true;
        } catch (error) {
            console.error("Failed to load layout:", error);
            return false;
        }
    },

    loadNotifications: async function () {
        try {
            const notifMenu = document.getElementById('notifMenu');
            // Simplified: Fetch recent completed audits
            const audits = await App.audits.getAll({ status: 'completed' });

            // Filter primarily for recent ones, or just show last 5 completed
            const recent = audits.slice(0, 5);

            if (recent.length > 0 && notifMenu) {
                notifMenu.innerHTML = recent.map(a => `
                    <div class="px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer" onclick="window.location.href='/pages/Dashboard_Recent Audit Page [View Result].html?id=${a.id}'">
                        <p class="text-xs font-semibold text-slate-900">Audit Completed</p>
                        <p class="text-[10px] text-slate-500 truncate">${a.url}</p>
                    </div>
                `).join('');

                // Add "view all" link
                // notifMenu.innerHTML += ...

                // Show red dot
                const badge = document.querySelector('#notifBtn span.absolute');
                if (badge) badge.style.display = 'block';
            } else if (notifMenu) {
                notifMenu.innerHTML = '<p class="text-sm text-slate-500 p-4">No new notifications</p>';
                const badge = document.querySelector('#notifBtn span.absolute');
                if (badge) badge.style.display = 'none';
            }
        } catch (e) {
            console.error("Failed to load notifications", e);
        }
    },

    updateHeaderUser: function () {
        if (!App.user) return;
        const meta = App.user.user_metadata || {};
        const email = App.user.email || '';
        const name = meta.first_name ? `${meta.first_name} ${meta.last_name || ''}` : email.split('@')[0];
        const initials = name.charAt(0).toUpperCase();

        const nameEl = document.getElementById('user-name');
        const emailEl = document.getElementById('user-email');
        const initEl = document.getElementById('user-initials');

        if (nameEl) nameEl.textContent = name;
        if (emailEl) emailEl.textContent = email;

        // Robust Avatar Logic (Single Source of Truth)
        // 'user', 'meta', 'email' are already defined above

        const avatarUrl = meta.avatar_url;
        const firstName = meta.first_name;
        // email is already 'email' variable

        const initial = (firstName && firstName[0]) ? firstName[0] : (email && email[0] ? email[0] : "U");

        const img = document.getElementById("menuAvatarImg");
        const fallback = document.getElementById("menuAvatarFallback");

        if (img && fallback) {
            // Handle broken image edge-case
            img.onerror = () => {
                img.classList.add("hidden");
                fallback.classList.remove("hidden");
            };

            if (avatarUrl) {
                img.src = avatarUrl;
                img.classList.remove("hidden");
                fallback.classList.add("hidden");
            } else {
                fallback.textContent = initial.toUpperCase();
                fallback.classList.remove("hidden");
                img.classList.add("hidden");
            }
        }
    },

    /**
     * Loads a page partial into the main content area
     * @param {string} partialPath - Path to the HTML partial (e.g., '../pages/partials/dashboard.html')
     */
    loadContent: async function (partialPath) {
        try {
            const response = await fetch(partialPath);
            const html = await response.text();
            document.getElementById('dashboard-content').innerHTML = html;

            if (window.Iconify) window.Iconify.scan();
        } catch (error) {
            console.error(`Failed to load content from ${partialPath}:`, error);
            document.getElementById('dashboard-content').innerHTML = `<div class="text-red-500">Failed to load content.</div>`;
        }
    }
}

window.Layout = Layout;
