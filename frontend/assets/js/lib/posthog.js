// frontend/assets/js/lib/posthog.js
import posthog from 'https://cdn.jsdelivr.net/npm/posthog-js/+esm';

const POSTHOG_KEY = 'phc_XaI8jVYPDp9rsY24KmwsbYRvFquzBjN7KtxuhYCa3jQ';
const POSTHOG_HOST = 'https://app.posthog.com'; // Default US cloud

if (!window.location.host.includes('127.0.0.1') && !window.location.host.includes('localhost')) {
    posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        capture_pageview: false, // Manually controlled
        autocapture: true,
        session_recording: {
            maskAllInputs: true
        },
        persistence: 'localStorage',
        loaded: (ph) => {
            // console.log('PostHog loaded');
        }
    });
} else {
    // Optional: Enable in dev if needed, or mock it
    // console.log('PostHog not enabled in localhost');
    // Mock for dev to prevent errors
    if (!posthog.__loaded) {
        posthog.capture = (event, props) => console.log('[PostHog Dev] Capture:', event, props);
        posthog.identify = (id, props) => console.log('[PostHog Dev] Identify:', id, props);
        posthog.reset = () => console.log('[PostHog Dev] Reset');
    }
}

export default posthog;
