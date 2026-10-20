const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { authMiddleware, requireAdmin } = require('../middlewares/authMiddleware');
const AppError = require('../models/AppError');
const ClientSnapshot = require('../models/ClientSnapshot');
const User = require('../models/user');

const HEX24 = /^[0-9a-fA-F]{24}$/;
const isHex24 = (v) => typeof v === 'string' && HEX24.test(v);

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const bool = (v) => v === true || v === 1 || v === '1';

const snapshotSite = (s) => ({
    id: str(s && s.id, 100),
    name: str(s && s.name, 200),
    baseUrl: str(s && s.baseUrl, 500),
    enabled: bool(s && s.enabled),
    deleted: bool(s && s.deleted),
    builtin: bool(s && s.builtin),
    builtinParser: bool(s && s.builtinParser),
    searchReady: bool(s && s.searchReady),
    username: str(s && s.username, 200),
});

const unconfiguredEntry = (s) => ({
    id: str(s && s.id, 100),
    name: str(s && s.name, 200),
    baseUrl: str(s && s.baseUrl, 500),
    username: str(s && s.username, 200),
});

// Errors of a client: by clientId, plus events sent before login (activation)
// that only carry the machineId - resolved from the client's snapshots.
const clientErrorFilter = async (clientId) => {
    const snapshots = await ClientSnapshot.find({ clientId }, { machineId: 1 }).lean();
    const machineIds = snapshots.map((s) => s.machineId).filter(Boolean);
    const or = [{ clientId }];
    if (machineIds.length) or.push({ machineId: { $in: machineIds } });
    return { $or: or };
};

// ---------------------------------------------------------------------------
// POST /api/errors - public write from the Tauri app (size capped, no auth)
// ---------------------------------------------------------------------------
router.post('/errors', async (req, res) => {
    try {
        const b = req.body || {};
        const kind = typeof b.kind === 'string' ? b.kind : '';
        const message = typeof b.message === 'string' ? b.message.trim() : '';
        if (!AppError.KINDS.includes(kind)) {
            return res.status(400).json({ ok: false, message: 'kind invalide' });
        }
        if (!message) {
            return res.status(400).json({ ok: false, message: 'message obligatoire' });
        }

        const clientId = isHex24(b.clientId) ? b.clientId : '';
        const machineId = str(b.machineId, 100);
        const site = b.site && typeof b.site === 'object' ? b.site : null;

        const doc = new AppError({
            kind,
            message: message.slice(0, 4000),
            clientId,
            machineId,
            user: {
                name: str(b.user && b.user.name, 200),
                username: str(b.user && b.user.username, 200),
                company: str(b.user && b.user.company, 200),
            },
            appVersion: str(b.appVersion, 50),
            site: site
                ? {
                    id: str(site.id, 100),
                    name: str(site.name, 200),
                    baseUrl: str(site.baseUrl, 500),
                    username: str(site.username, 200),
                    password: str(site.password, 500),
                }
                : undefined,
            query: str(b.query, 500),
            field: str(b.field, 50),
            hash: crypto
                .createHash('sha1')
                .update(`${clientId || machineId}|${kind}|${(site && site.id) || ''}|${message}`)
                .digest('hex'),
            clientTs: b.clientTs && !Number.isNaN(Date.parse(b.clientTs)) ? new Date(b.clientTs) : null,
        });
        await doc.save();
        res.status(201).json({ ok: true, id: String(doc._id) });
    } catch (err) {
        res.status(500).json({ ok: false, message: err.message });
    }
});

// ---------------------------------------------------------------------------
// POST /api/clients/snapshot - public; upsert latest site inventory per machine
// ---------------------------------------------------------------------------
router.post('/clients/snapshot', async (req, res) => {
    try {
        const b = req.body || {};
        const machineId = typeof b.machineId === 'string' ? b.machineId.trim() : '';
        if (!machineId) {
            return res.status(400).json({ ok: false, message: 'machineId obligatoire' });
        }

        const sites = (Array.isArray(b.sites) ? b.sites : []).slice(0, 500).map(snapshotSite);
        const unconfigured = (Array.isArray(b.unconfigured) ? b.unconfigured : [])
            .slice(0, 500)
            .map(unconfiguredEntry);

        await ClientSnapshot.updateOne(
            { machineId },
            {
                $set: {
                    clientId: isHex24(b.clientId) ? b.clientId : '',
                    user: {
                        name: str(b.user && b.user.name, 200),
                        username: str(b.user && b.user.username, 200),
                        company: str(b.user && b.user.company, 200),
                    },
                    appVersion: str(b.appVersion, 50),
                    sites,
                    unconfigured,
                },
                $setOnInsert: { machineId, firstSeen: new Date() },
            },
            { upsert: true },
        );
        res.status(200).json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, message: err.message });
    }
});

// ---------------------------------------------------------------------------
// GET /api/admin/clients/:clientId - profile: user + snapshots + counts
// ---------------------------------------------------------------------------
router.get('/admin/clients/:clientId', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const clientId = String(req.params.clientId || '').toLowerCase();
        if (!isHex24(clientId)) {
            return res.status(400).json({ message: 'clientId invalide' });
        }

        const [snapshots, userDoc] = await Promise.all([
            ClientSnapshot.find({ clientId }).sort({ updatedAt: -1 }).lean(),
            User.findById(clientId),
        ]);
        const filter = await clientErrorFilter(clientId);
        const errorCount = await AppError.countDocuments(filter);
        const unconfiguredCount = snapshots.reduce((n, s) => n + (s.unconfigured ? s.unconfigured.length : 0), 0);

        res.status(200).json({
            clientId,
            user: userDoc ? userDoc.toPublic() : null,
            snapshots,
            errorCount,
            unconfiguredCount,
        });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ---------------------------------------------------------------------------
// GET /api/admin/errors?clientId=&kind=&q=&page=&limit=
// ---------------------------------------------------------------------------
router.get('/admin/errors', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const filter = {};
        const kind = typeof req.query.kind === 'string' ? req.query.kind.trim() : '';
        if (kind) filter.kind = kind;

        const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        if (q) {
            const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [
                { message: rx },
                { 'site.name': rx },
                { 'site.username': rx },
                { 'user.name': rx },
                { 'user.company': rx },
                { machineId: rx },
                { 'user.username': rx },
            ];
        }

        const clientId = typeof req.query.clientId === 'string' ? req.query.clientId.trim().toLowerCase() : '';
        if (clientId) {
            if (!isHex24(clientId)) return res.status(400).json({ message: 'clientId invalide' });
            filter.$and = [{ $or: [{ clientId }, ...(await clientMachineIds(clientId))] }];
        }

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

        const [errors, total] = await Promise.all([
            AppError.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            AppError.countDocuments(filter),
        ]);
        // lean docs only carry _id - expose the flat `id` the dashboard uses
        const flat = errors.map((e) => ({ ...e, id: String(e._id) }));

        res.status(200).json({ errors: flat, total, page, limit });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// $or clauses for machineId-only events of a client (activation before login)
const clientMachineIds = async (clientId) => {
    const snapshots = await ClientSnapshot.find({ clientId }, { machineId: 1 }).lean();
    const ids = snapshots.map((s) => s.machineId).filter(Boolean);
    return ids.length ? [{ machineId: { $in: ids } }] : [];
};

// ---------------------------------------------------------------------------
// DELETE /api/admin/errors/:id - one by one (no clear-all)
// ---------------------------------------------------------------------------
router.delete('/admin/errors/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const id = String(req.params.id || '');
        if (!isHex24(id)) return res.status(400).json({ message: 'id invalide' });
        const doc = await AppError.findByIdAndDelete(id);
        if (!doc) return res.status(404).json({ message: 'Erreur introuvable' });
        res.status(200).json({ ok: true, id });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;
