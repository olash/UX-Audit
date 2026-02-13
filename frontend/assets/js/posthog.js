// PostHog Analytics
// Loaded via CDN in index.html or imported here if using ES modules with CDN

import posthog from 'https://cdn.jsdelivr.net/npm/posthog-js/+esm';

const POSTHOG_KEY = 'phc_XaI8jVYPDp9rsY24KmwsbYRvFquzBjN7KtxuhYCa3jQ';
const POSTHOG_HOST = 'https://app.posthog.com';

if (window.location.hostname !== 'localhost' && POSTHOG_KEY.startsWith('phc_')) {
    posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        capture_pageview: false, // We control manually or let it auto
        autocapture: true,
        persistence: 'localStorage'
    });
} else {
    console.log('PostHog not initialized (Localhost or Missing Key)');
}

export default posthog;
