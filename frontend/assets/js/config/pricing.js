export const PLANS = {
    free: {
        name: 'Free',
        pages: 3,
        price: 0,
        variantId: null // Free plans don't need Lemon Squeezy variant
    },
    starter: {
        name: 'Starter',
        pages: 10,
        price: 12,
        variantId: 'variant_starter_123'
    },
    pro: {
        name: 'Pro',
        pages: 30,
        price: 29,
        variantId: 'variant_pro_456'
    },
    team: {
        name: 'Team',
        pages: 75,
        price: 59,
        variantId: 'variant_team_789'
    }
};

export const CREDIT_PACKS = [
    { credits: 50, price: 10, variantId: 'variant_credits_50' },
    { credits: 200, price: 40, variantId: 'variant_credits_200' },
    { credits: 500, price: 90, variantId: 'variant_credits_500' }
];
