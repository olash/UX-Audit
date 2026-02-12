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
        variantId: '1261057'
    },
    pro: {
        name: 'Pro',
        auditLimit: 30,
        pageLimit: 30,
        price: 29,
        variantId: '1301079', // Test ID
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
        variantId: '1301081', // Test ID
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
    { credits: 50, price: 10, pricePerCredit: 0.20, variantId: '1301083' },
    { credits: 200, price: 40, pricePerCredit: 0.20, variantId: '1301084' },
    { credits: 500, price: 80, pricePerCredit: 0.16, variantId: '1301085' },
    { credits: 1000, price: 140, pricePerCredit: 0.14, variantId: '1301086' }
];
