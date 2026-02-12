export const PLANS = {
    free: {
        name: 'Free',
        price: '0',
        auditLimit: 2,
        pageLimit: 3,
        features: ['2 Audits / Month', '3 Pages / Audit', 'Standard Insights']
    },
    starter: {
        name: 'Starter',
        price: '12',
        auditLimit: 8,
        pageLimit: 15,
        features: ['8 Audits / Month', '15 Pages / Audit', 'PDF Reports', 'Standard Insights'],
        variantId: '1292487'
    },
    pro: {
        name: 'Pro',
        auditLimit: 30,
        pageLimit: 40,
        price: 39,
        variantId: '1284104',
        features: [
            '30 audits / month',
            '40 pages per audit',
            'Advanced Insights',
            'Priority Support',
            'Commercial Use'
        ]
    },
    team: {
        name: 'Team',
        auditLimit: 75,
        pageLimit: 75,
        price: 79,
        variantId: '1284106',
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
    { credits: 50, price: 12, pricePerCredit: 0.24, variantId: '1284150' },
    { credits: 200, price: 40, pricePerCredit: 0.20, variantId: '1292508' },
    { credits: 500, price: 80, pricePerCredit: 0.16, variantId: '1292509' },
    { credits: 1000, price: 140, pricePerCredit: 0.14, variantId: '1292511' }
];
