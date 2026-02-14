export const PLANS = {
    free: {
        name: 'Free',
        pages: 3,
        audits: 2, // explicit limit
        price: 0,
        priceId: process.env.STRIPE_PRICE_FREE || null
    },
    starter: {
        name: 'Starter',
        pages: 10,
        audits: 10,
        price: 12,
        priceId: '1292487'
    },
    pro: {
        name: 'Pro',
        pages: 30,
        audits: 30,
        price: 39,
        priceId: '1284104'
    },
    team: {
        name: 'Agency',
        pages: 75,
        audits: 75,
        price: 79,
        priceId: '1284106'
    }
};

export const PLAN_ENTITLEMENTS = {
    free: {
        maxPagesPerAudit: 3,
        auditsPerMonth: 2,
        canGenerateReports: false,
        advancedInsights: false
    },
    starter: {
        maxPagesPerAudit: 15,
        auditsPerMonth: 8,
        canGenerateReports: true,
        advancedInsights: false
    },
    pro: {
        maxPagesPerAudit: 40,
        auditsPerMonth: 30,
        canGenerateReports: true,
        advancedInsights: true
    },
    team: {
        maxPagesPerAudit: 75,
        auditsPerMonth: 75,
        canGenerateReports: true,
        advancedInsights: true,
        whiteLabel: true
    }
};

export const CREDIT_PACKS = [
    { credits: 50, price: 12, priceId: '1284150' },
    { credits: 200, price: 40, priceId: '1292508' },
    { credits: 500, price: 80, priceId: '1292509' },
    { credits: 1000, price: 140, priceId: '1292511' }
];
