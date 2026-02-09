import express from 'express';
// import axios from 'axios'; // Not in package.json?
// We can use fetch (Node 18+)
// Assumes process.env.LEMON_API_KEY and STORE_ID

import { PLANS, CREDIT_PACKS } from '../config/pricing.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

async function getUser(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new Error('No Authorization header');
    const token = authHeader.replace('Bearer ', '').trim();
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.sub) throw new Error('Invalid token');
    return { id: decoded.sub, email: decoded.email };
}

router.post('/', async (req, res) => {
    try {
        const user = await getUser(req);
        const { productId } = req.body; // In Lemon Squeezy terms, this is the Variant ID

        if (!productId) return res.status(400).json({ error: 'Missing productId' });

        // Basic validation that productId exists in our constants
        // ... (Optional)

        const payload = {
            data: {
                type: 'checkouts',
                attributes: {
                    checkout_data: {
                        email: user.email,
                        custom: {
                            user_id: user.id
                        }
                    }
                },
                relationships: {
                    store: { data: { type: 'stores', id: process.env.STORE_ID } },
                    variant: { data: { type: 'variants', id: productId } }
                }
            }
        };

        // Defensive Logging (Temporary)
        console.log("--- DEBUG CHECKOUT ---");
        console.log("Using Env Vars:");
        console.log("STORE_ID:", process.env.STORE_ID || "MISSING");
        console.log("LEMON_API_KEY Present:", !!process.env.LEMON_API_KEY);
        console.log("LEMON_API_KEY Length:", process.env.LEMON_API_KEY ? process.env.LEMON_API_KEY.length : 0);
        console.log("----------------------");

        const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.LEMON_API_KEY}`,
                'Content-Type': 'application/vnd.api+json',
                'Accept': 'application/vnd.api+json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.errors) {
            console.error('Lemon API Error:', data.errors);
            return res.status(500).json({ error: 'Failed to create checkout' });
        }

        res.json({ url: data.data.attributes.url });

    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
