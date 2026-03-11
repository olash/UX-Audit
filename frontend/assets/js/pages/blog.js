// blog.js — Blog index page controller
document.addEventListener('DOMContentLoaded', async () => {
    await App.init();
    await Layout.loadPublic();
    await Layout.loadContent('/pages/partials/blog-index.html');
});
