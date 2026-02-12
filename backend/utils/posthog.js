import { PostHog } from 'posthog-node';
import dotenv from 'dotenv';
dotenv.config();

let posthogClient = null;

if (process.env.POSTHOG_KEY) {
    posthogClient = new PostHog(
        process.env.POSTHOG_KEY,
        { host: process.env.POSTHOG_HOST || 'https://app.posthog.com' }
    );
} else {
    console.warn("PostHog Key not found in environment variables. Analytics disabled.");
}

export const posthog = {
    capture: (event) => {
        if (posthogClient) {
            posthogClient.capture(event);
        }
    },
    shutdown: async () => {
        if (posthogClient) {
            await posthogClient.shutdown();
        }
    },
    client: posthogClient
};
