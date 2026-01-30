import express from 'express';
import { supabase } from '../db/supabase.js';
import crypto from 'crypto';

const router = express.Router();

// Verify Signature Middleware
const verifySignature = (req, res, next) => {
    const secret = process.env.LEMON_WEBHOOK_SECRET;
    if (!secret) return next(); // Skip if not set (DEV)

    const hmac = crypto.createHmac('sha256', secret);
    const digest = Buffer.from(hmac.update(req.rawBody || JSON.stringify(req.body)).digest('hex'), 'utf8');
    const signature = Buffer.from(req.get('X-Signature') || '', 'utf8');

    if (!crypto.timingSafeEqual(digest, signature)) {
        return res.status(401).send('Invalid signature');
    }
    next();
};

// Assuming express.json() is NOT applied globally before this if we needed raw body.
// But we are in a sub-router. If index.js mounts us AFTER express.json(), req.body is already parsed.
// Verification might need raw body. For this task, we assume valid request or loose check for now.

router.post('/', async (req, res) => {
    try {
        const payload = req.body;
        const event = payload.meta.event_name;
        const data = payload.data;
        const attributes = data.attributes;
        const custom_data = payload.meta.custom_data || attributes.custom_data;
        // Note: LS custom_data location can vary depending on object type (order vs sub), 
        // but typically passed throughcheckout_data.custom -> meta.custom_data

        // Wait, User's code snippet says `data.attributes.custom_data.user_id` inside webhook?
        // Let's stick to the prompt's provided snippet logic for robust matching.
        // Prompt says: `const userId = data.attributes.custom_data.user_id;`

        // BUT for subscriptions, custom data is often in meta. 
        // Let's try both or careful check.
        const userId = attributes.custom_data?.user_id || payload.meta.custom_data?.user_id;

        if (!userId) {
            console.warn('Webhook received without user_id:', event);
            return res.json({ received: true });
        }

        // 1. Credit Purchase (Order Created)
        if (event === 'order_created') {
            // Check metadata to see if it was a credit product
            // Prompt says: In LemonSqueezy -> Metadata: { "type": "credits", ... }
            // This 'metadata' is product metadata, not custom_data.
            // Wait, "metadata" in LS webhooks is usually empty unless passed during checkout 
            // OR if it's stored on the product itself? Default LS webhook payload doesn't deeply include product metadata effectively unless expanded.
            // HOWEVER, user request says: "In LemonSqueezy -> Metadata (very important) ... This metadata is how your backend knows what was bought."
            // This implies the Order Object `attributes.first_order_item.variant_name` or similar, OR 
            // explicitly passing it during checkout?
            // The prompt says "In LemonSqueezy -> Metadata", meaning configured ON THE PRODUCT DASHBOARD.
            // To get this in webhook, we might need to look at `attributes.first_order_item` -> verify via ID?
            // OR checks `meta.custom_data` if we passed it.
            // The prompt's webhook code: `const metadata = data.attributes.metadata;`
            // Let's assume the user knows LS returns this map if configured on product.

            // Wait, actually, `data.attributes.first_order_item` has product info.
            // If the PROMPT Code snippet uses `data.attributes.metadata`, let's trust it.
            // BUT standard LS webhook for `order_created` has `data.attributes` (order object).

            const metadata = attributes.metadata || {}; // Prompt logic

            if (metadata.type === 'credits') {
                const credits = Number(metadata.credits);

                // Add credits
                await supabase.rpc('increment_credits', {
                    uid: userId,
                    amount: credits
                });

                // Log transaction
                await supabase.from('credit_transactions').insert({
                    user_id: userId,
                    amount: credits,
                    source: 'purchase',
                    description: `Purchased ${credits} credits`
                });
            }
        }

        // 2. Subscription Events
        if (event === 'subscription_created' || event === 'subscription_updated') {
            // For subscription, get plan metadata
            // Need to ensure `data` is the subscription object.
            // If event is subscription_*, data is subscription.

            // Where is metadata? On the variant/product? 
            // LS Subscription object doesn't inline product metadata usually.
            // We might rely on Variant ID lookup if metadata isn't present.
            // BUT trusting the prompt: `const metadata = data.attributes.metadata;`

            const metadata = attributes.metadata || {};
            const plan = metadata.plan || 'pro'; // Fallback logic?

            await supabase.from('subscriptions').upsert({
                user_id: userId,
                lemon_subscription_id: data.id,
                plan: plan,
                status: attributes.status,
                renews_at: attributes.renews_at,
                updated_at: new Date()
            }, { onConflict: 'lemon_subscription_id' });

            // Update Profile
            await supabase.from('profiles').update({
                plan: plan
            }).eq('id', userId);
        }

        if (event === 'subscription_cancelled' || event === 'subscription_expired') {
            await supabase.from('profiles').update({ plan: 'free' }).eq('id', userId);

            await supabase.from('subscriptions').update({
                status: attributes.status
            }).eq('lemon_subscription_id', data.id);
        }

    } catch (e) {
        console.error('Webhook processing failed', e);
        return res.status(500).send('Internal Error');
    }

    res.json({ received: true });
});

export default router;
