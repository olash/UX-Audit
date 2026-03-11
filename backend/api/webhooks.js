import express from 'express';
import { supabase } from '../db/supabase.js';
import crypto from 'crypto';
import { posthog } from '../utils/posthog.js';
import { sendWelcomeEmail, sendLeadMagnetEmail } from '../utils/email.js';

const router = express.Router();

// 1. Body Parsing for Signature Verification
// Lemon Squeezy uses 'application/vnd.api+json'
router.use(express.json({
    type: ['application/vnd.api+json', 'application/json'],
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

// 2. Constants & Maps
const PLAN_MAP = {
    "1292487": "starter",
    "1284104": "pro",
    "1284106": "agency"
};

const CREDIT_MAP = {
    "1284150": 50,
    "1292508": 200,
    "1292509": 500,
    "1292511": 1000
};

// 3. Signature Verification Middleware
const verifySignature = (req, res, next) => {
    const secret = process.env.LEMON_WEBHOOK_SECRET;
    if (!secret) {
        console.warn("⚠️ LEMON_WEBHOOK_SECRET not set. Skipping signature verification.");
        return next();
    }

    const hmac = crypto.createHmac('sha256', secret);
    // Request body is already verified/captured by express.json above if type matches
    const digest = Buffer.from(hmac.update(req.rawBody).digest('hex'), 'utf8');
    const signature = Buffer.from(req.get('X-Signature') || '', 'utf8');

    if (!crypto.timingSafeEqual(digest, signature)) {
        console.error("Invalid Webhook Signature");
        return res.status(401).send('Invalid signature');
    }
    next();
};

router.post('/', verifySignature, async (req, res) => {
    try {
        const payload = req.body;

        // LS Payload Structure: { meta: {...}, data: { type: ..., attributes: {...} } }
        const { meta, data } = payload;
        const eventName = meta.event_name;
        const attributes = data.attributes;

        // Custom Data: usually in meta.custom_data for checkouts that resulted in this event
        const customData = meta.custom_data || attributes.custom_data || {};
        const userId = customData.user_id;

        console.log(`🔔 Webhook received: ${eventName} for User ${userId || 'Unknown'}`);

        if (!userId) {
            console.warn('⚠️ No user_id in webhook custom_data. Ignoring.');
            return res.json({ received: true });
        }

        // A. Subscription Created / Updated
        if (eventName === 'subscription_created' || eventName === 'subscription_updated') {
            const variantId = attributes.variant_id;
            const planName = PLAN_MAP[variantId + '']; // Ensure string key

            if (planName) {
                // Update User Plan
                await supabase.from('profiles').update({
                    plan: planName
                }).eq('id', userId);

                // Upsert Subscription
                // We use 'lemon_subscription_id' as unique key if schema supports it
                // Or just insert separate log. User asked to update subscriptions.
                const { error } = await supabase.from('subscriptions').upsert({
                    user_id: userId,
                    lemon_subscription_id: data.id, // Subscription ID in LS
                    plan: planName,
                    status: attributes.status,
                    renews_at: attributes.renews_at,
                    updated_at: new Date()
                }, { onConflict: 'lemon_subscription_id' }); // Assuming this constraint exists

                if (error) console.error("Subscription Upsert Error:", error);
                else {
                    console.log(`✅ User ${userId} updated to plan ${planName}`);

                    // Track in PostHog
                    if (posthog) {
                        posthog.capture({
                            distinctId: userId,
                            event: 'plan_upgraded',
                            properties: {
                                new_plan: planName,
                                amount: attributes.total / 100 // attributes.total is in cents, converts to dollars (e.g. 49)
                            }
                        });
                    }
                }
            } else {
                console.warn(`⚠️ Unknown plan variant: ${variantId}`);
            }
        }

        // B. Subscription Cancelled / Expired
        if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
            // Downgrade to free immediately per user request

            // 1. Update Subscription Status
            await supabase.from('subscriptions').update({
                status: attributes.status,
                updated_at: new Date()
            }).eq('lemon_subscription_id', data.id);

            // 2. Downgrade Profile
            await supabase.from('profiles').update({
                plan: 'free'
            }).eq('id', userId);

            console.log(`🚫 User ${userId} subscription cancelled - Downgraded to Free`);
        }

        // C. Order Created (Credits)
        if (eventName === 'order_created') {
            // Check first order item for variant
            // LS 'order_created' payload usually has 'first_order_item' in attributes

            // NOTE: first_order_item object structure: { variant_id, variant_name, ... }
            const firstItem = attributes.first_order_item;
            const variantId = firstItem ? firstItem.variant_id : null;

            if (variantId && CREDIT_MAP[variantId + '']) {
                const credits = CREDIT_MAP[variantId + ''];

                // Add Credits RPC
                const { error } = await supabase.rpc('increment_credits', {
                    uid: userId,
                    amount: credits
                });

                if (error) {
                    console.error("RPC Error increment_credits:", error);
                    throw error;
                }

                // Log Transaction
                await supabase.from('credit_transactions').insert({
                    user_id: userId,
                    amount: credits,
                    source: 'purchase',
                    description: `Purchased ${credits} credits`, // Optional
                });

                console.log(`💰 User ${userId} purchased ${credits} credits`);

                // Track in PostHog
                if (posthog) {
                    posthog.capture({
                        distinctId: userId,
                        event: 'credit_purchased',
                        properties: {
                            credits: credits,
                            amount: attributes.total / 100
                        }
                    });
                }
            }
        }

    } catch (e) {
        console.error('❌ Webhook Error:', e);
        return res.status(500).send('Server Error');
    }

    res.json({ received: true });
});

// Supabase Database Webhook for New Users (Fires after email verification)
// Notice we removed the inline express.json() because it's handled at the top of the file
router.post('/new-user', async (req, res) => {
    try {
        const payload = req.body;

        // Log the exact payload so we can see it in Render's dashboard!
        console.log("📨 Received Supabase Webhook:", JSON.stringify(payload));

        const newUser = payload?.record;

        if (!newUser || !newUser.email) {
            return res.status(400).send('No user data');
        }

        // We check if the email_confirmed_at field exists and has a timestamp
        const isVerified = !!newUser.email_confirmed_at;

        if (isVerified) {
            console.log(`🎉 User verified: ${newUser.email}. Sending welcome email...`);
            await sendWelcomeEmail(newUser.email);
        } else {
            console.log(`⏳ User created but not verified yet: ${newUser.email}. Waiting...`);
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('❌ Webhook Error:', error);
        res.status(500).send('Error processing webhook');
    }
});

// Supabase Database Webhook for New Leads (fires after a row is inserted into the 'leads' table)
router.post('/new-lead', async (req, res) => {
    try {
        const payload = req.body;

        console.log("📨 Received New Lead Webhook:", JSON.stringify(payload));

        // Supabase sends the newly inserted row inside the "record" object
        const newLead = payload?.record;

        if (!newLead || !newLead.email || !newLead.source) {
            return res.status(400).send('Missing lead data');
        }

        console.log(`🎉 New lead captured: ${newLead.email}. Attaching PDF for ${newLead.source}...`);

        // Trigger the Resend function we just built
        await sendLeadMagnetEmail(newLead.email, newLead.source);

        res.status(200).send('Webhook processed successfully');
    } catch (error) {
        console.error('❌ Lead Webhook Error:', error);
        res.status(500).send('Error processing webhook');
    }
});

export default router;
