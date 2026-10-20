const Admin = require('../models/Admin');
const User = require('../models/user');
const AppError = require('../models/AppError');
const ClientSnapshot = require('../models/ClientSnapshot');
const jwt = require('jsonwebtoken');
const { PLANS, PLAN_IDS, getPlan, expiryFromPlan, statusFor } = require('../plans');

const signAdminToken = (adminId) => {
    return jwt.sign({ sub: String(adminId), role: 'admin' }, process.env.JWT_SECRET, {
        expiresIn: '12h',
    });
};

const adminService = {
    // Connexion admin : collection "admins" d'abord, fallback .env (bootstrap)
    login: async (email, password) => {
        if (!email || !password) {
            throw new Error('Email et mot de passe sont obligatoires');
        }

        const admin = await Admin.findOne({ email: email.toLowerCase() });
        if (admin) {
            const ok = await admin.isPasswordValid(password);
            if (!ok) throw new Error('Identifiants admin invalides');
            return { token: signAdminToken(admin._id), admin: admin.toPublic() };
        }

        // Fallback : identifiants d'environnement tant qu'aucun admin n'existe
        const okEnv =
            email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD;
        if (!okEnv) {
            throw new Error('Identifiants admin invalides');
        }
        return { token: signAdminToken('admin-env') };
    },

    plans: () => PLANS,

    // Liste avec filtres optionnels : ?status=active|expired &plan=starter&q=texte
    listUsers: async ({ status, plan, q } = {}) => {
        const filter = {};
        if (plan && PLAN_IDS.includes(plan)) filter.plan = plan;
        if (q) {
            const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [{ name: rx }, { username: rx }, { phone: rx }, { company: rx }];
        }

        let users = await User.find(filter).sort({ createdAt: -1 });

        // Filtre statut : derive cote serveur (expiryDate = source de verite)
        if (status === 'active' || status === 'expired') {
            users = users.filter((u) => statusFor(u.expiryDate) === status);
        }

        // Telemetry counts per client (joined on clientId = user id):
        // nb d'erreurs rapportees + nb de fournisseurs "non configure".
        // Errors sent before login only carry machineId -> counted via the
        // client's snapshots (same join as GET /admin/clients/:id profile).
        const rows = users.map((u) => u.toPublic());
        const ids = rows.map((r) => String(r.id));
        let errCount = {};
        let snapCount = {};
        if (ids.length) {
            const snaps = await ClientSnapshot.find(
                { clientId: { $in: ids } },
                { clientId: 1, machineId: 1 },
            ).lean();
            const machines = [...new Set(snaps.map((s) => s.machineId).filter(Boolean))];
            const clientByMachine = Object.fromEntries(
                snaps.filter((s) => s.machineId && s.clientId).map((s) => [s.machineId, s.clientId]),
            );
            const [errByClient, errByMachine, snapAgg] = await Promise.all([
                AppError.aggregate([
                    { $match: { clientId: { $in: ids } } },
                    { $group: { _id: '$clientId', n: { $sum: 1 } } },
                ]),
                machines.length
                    ? AppError.aggregate([
                        {
                            $match: {
                                machineId: { $in: machines },
                                $or: [{ clientId: '' }, { clientId: { $exists: false } }],
                            },
                        },
                        { $group: { _id: '$machineId', n: { $sum: 1 } } },
                    ])
                    : [],
                ClientSnapshot.aggregate([
                    { $match: { clientId: { $in: ids } } },
                    { $group: { _id: '$clientId', n: { $sum: { $size: '$unconfigured' } } } },
                ]),
            ]);
            for (const g of errByClient) errCount[String(g._id)] = g.n;
            for (const g of errByMachine) {
                const c = clientByMachine[String(g._id)];
                if (c) errCount[String(c)] = (errCount[String(c)] || 0) + g.n;
            }
            snapCount = Object.fromEntries(snapAgg.map((g) => [String(g._id), g.n]));
        }

        return rows.map((r) => ({
            ...r,
            errorCount: errCount[String(r.id)] || 0,
            unconfiguredCount: snapCount[String(r.id)] || 0,
        }));
    },

    // Creation : expiryDate = date de creation + duree du plan (si non fournie)
    createUser: async (data) => {
        const { name, username, phone, company, plan, password, expiryDate } = data;

        if (!name || !username || !phone || !password) {
            throw new Error('Champs obligatoires manquants (name, username, phone, password)');
        }
        if (!PLAN_IDS.includes(plan)) {
            throw new Error('Plan invalide');
        }

        const existingUser = await User.findOne({ username: username.trim().toLowerCase() });
        if (existingUser) {
            throw new Error("Ce username existe deja");
        }

        const user = new User({
            name,
            username,
            phone,
            company: company || '',
            plan,
            expiryDate: expiryDate ? new Date(expiryDate) : expiryFromPlan(plan),
            password,
        });
        await user.save();
        return user.toPublic();
    },

    // Mise a jour : plan re-derive l'expiration si expiryDate n'est pas explicite
    updateUser: async (id, data) => {
        const user = await User.findById(id);
        if (!user) throw new Error('Utilisateur non trouve');

        const { name, username, phone, company, plan, password, expiryDate, resetPassword } = data;

        if (username !== undefined && username.trim().toLowerCase() !== user.username) {
            const existingUser = await User.findOne({ username: username.trim().toLowerCase() });
            if (existingUser) throw new Error('Ce username existe deja');
            user.username = username;
        }
        if (phone !== undefined) user.phone = phone;
        if (name !== undefined) user.name = name;
        if (company !== undefined) user.company = company;

        if (plan !== undefined) {
            if (!PLAN_IDS.includes(plan)) throw new Error('Plan invalide');
            const planChanged = plan !== user.plan;
            user.plan = plan;
            // Recalcul auto sauf si l'admin a fourni une date explicitement
            if (expiryDate !== undefined) {
                user.expiryDate = new Date(expiryDate);
            } else if (planChanged) {
                user.expiryDate = expiryFromPlan(plan);
            }
        } else if (expiryDate !== undefined) {
            // Renouvellement / blocage : on reecrit simplement la date
            user.expiryDate = new Date(expiryDate);
        }

        if (resetPassword) {
            if (!password) throw new Error('Nouveau mot de passe requis');
            user.password = password;
        }

        await user.save();
        return user.toPublic();
    },

    deleteUser: async (id) => {
        const user = await User.findByIdAndDelete(id);
        if (!user) throw new Error('Utilisateur non trouve');
        return { id };
    },

    // Stats : total, actifs, expires, repartition par plan, revenu estime
    stats: async () => {
        const users = await User.find();
        const byPlan = {};
        let active = 0;
        let expired = 0;
        let revenueEstimated = 0;

        for (const u of users) {
            byPlan[u.plan] = (byPlan[u.plan] || 0) + 1;
            if (statusFor(u.expiryDate) === 'active') {
                active += 1;
                const plan = getPlan(u.plan);
                if (plan) revenueEstimated += plan.price;
            } else {
                expired += 1;
            }
        }

        return { total: users.length, active, expired, byPlan, revenueEstimated };
    },
};

module.exports = adminService;
