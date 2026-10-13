// Catalogue unique des plans d'abonnement (partage serveur + dashboard)
const PLANS = [
    { id: 'tester', label: 'Tester', months: 1, price: 50 },
    { id: 'starter', label: 'Starter', months: 3, price: 150 },
    { id: 'pro', label: 'Pro', months: 6, price: 280 },
    { id: 'enterprise', label: 'Enterprise', months: 12, price: 500 },
];

const PLAN_IDS = PLANS.map((p) => p.id);

const getPlan = (id) => PLANS.find((p) => p.id === id) || null;

// Expiration par defaut : date de creation + duree du plan (mois fixes de 30 jours)
const expiryFromPlan = (planId, from = new Date()) => {
    const plan = getPlan(planId);
    if (!plan) return null;
    const d = new Date(from);
    d.setDate(d.getDate() + plan.months * 30);
    return d;
};

// Statut derive : la seule source de verite est expiryDate (jamais stocke)
const statusFor = (expiryDate) => {
    if (!expiryDate) return 'expired';
    return new Date(expiryDate) > new Date() ? 'active' : 'expired';
};

module.exports = { PLANS, PLAN_IDS, getPlan, expiryFromPlan, statusFor };
