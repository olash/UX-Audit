import { PostHog } from 'posthog-node'

let client = null;

if (process.env.POSTHOG_SERVER_KEY) {
    client = new PostHog(
        process.env.POSTHOG_SERVER_KEY,
        { host: process.env.POSTHOG_HOST || 'https://app.posthog.com' }
    )
} else {
    console.warn("⚠️ POSTHOG_SERVER_KEY not set. Analytics disabled.");
}

export const posthog = client;
