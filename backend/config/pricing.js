export const PLANS = {
    free: {
        name: 'Free',
        pages: 3,
        price: 0,
        priceId: process.env.STRIPE_PRICE_FREE || null // Optional if needed server-side
    },
    starter: {
        name: 'Starter',
        pages: 10,
        price: 10,
        priceId: 'price_starter_id_here'
    },
    pro: {
        name: 'Pro',
        pages: 30,
        price: 29,
        priceId: 'price_pro_id_here'
    },
    team: {
        name: 'Team',
        pages: 75,
        price: 59,
        priceId: 'price_team_id_here'
    }
};

export const CREDIT_PACKS = [
    { credits: 50, price: 10, priceId: 'price_credit_50' },
    { credits: 200, price: 40, priceId: 'price_credit_200' },
    { credits: 500, price: 90, priceId: 'price_credit_500' }
];
