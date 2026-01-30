export const PLANS = {
    free: {
        name: 'Free',
        auditLimit: 2,
        pageLimit: 3,
        price: 0,
        variantId: null,
        features: [
            '2 audits / month',
            '3 pages per audit',
            'Buy credits for extra pages',
            'No PDF exports',
            'Personal use only'
        ]
    },
    starter: {
        name: 'Starter',
        auditLimit: 10,
        pageLimit: 10,
        price: 12,
        variantId: 'variant_starter_123',
        features: [
            '10 audits / month',
            '10 pages per audit',
            'Full PDF Reports',
            'Commercial Use',
            'Standard Support'
        ]
    },
    pro: {
        name: 'Pro',
        auditLimit: 30,
        pageLimit: 30,
        price: 29,
        variantId: 'variant_pro_456',
        features: [
            '30 audits / month',
            '30 pages per audit',
            'Advanced Insights',
            'Priority Support',
            'Commercial Use'
        ]
    },
    team: {
        name: 'Team',
        auditLimit: 75,
        pageLimit: 75,
        price: 59,
        variantId: 'variant_team_789',
        features: [
            '75 audits / month',
            '75 pages per audit',
            'Unlimited Team Members',
            'White-label Reports',
            'Priority Support'
        ]
    }
};

export const CREDIT_PACKS = [
    { credits: 50, price: 10, variantId: 'variant_credits_50' },
    { credits: 200, price: 40, variantId: 'variant_credits_200' },
    { credits: 500, price: 90, variantId: 'variant_credits_500' }
];
