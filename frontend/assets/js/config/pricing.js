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
        variantId: '814375', // Starter
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
        variantId: '814573', // Pro
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
        variantId: '814574', // Team
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
    { credits: 50, price: 10, variantId: '1284150' },
    { credits: 200, price: 40, variantId: '1292508' },
    { credits: 500, price: 90, variantId: '1292509' }
];
