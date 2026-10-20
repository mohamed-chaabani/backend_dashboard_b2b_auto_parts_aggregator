const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { authMiddleware, requireAdmin } = require('../middlewares/authMiddleware');

// Machine ID format from the app (Rust get_machine_id):
// XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX (8 groups of 4 hex chars)
const MACHINE_ID = /^[0-9A-Fa-f]{4}(-[0-9A-Fa-f]{4}){7}$/;

// Port of the developer tool frontend.../tools/license/generate.cjs:
// sign the machine ID string with Ed25519 (seed from LICENSE_SEED_HEX env).
// The app verifies offline with the public key embedded in src-tauri/src/lib.rs.
router.post('/licenses/generate', authMiddleware, requireAdmin, (req, res) => {
    try {
        const machineId = String((req.body && req.body.machineId) || '').trim().toUpperCase();
        if (!MACHINE_ID.test(machineId)) {
            return res.status(400).json({
                ok: false,
                message: 'machineId invalide (format XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX)',
            });
        }

        const seedMatch = (process.env.LICENSE_SEED_HEX || '').match(/[0-9a-fA-F]{64}/);
        if (!seedMatch) {
            return res.status(500).json({
                ok: false,
                message: 'LICENSE_SEED_HEX manquant ou invalide sur le serveur',
            });
        }

        // Rebuild a PKCS#8 Ed25519 private key from the raw 32-byte seed.
        const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
        const privKey = crypto.createPrivateKey({
            key: Buffer.concat([PKCS8_PREFIX, Buffer.from(seedMatch[0], 'hex')]),
            format: 'der',
            type: 'pkcs8',
        });

        // Ed25519: algorithm must be null. Signs UTF-8 bytes of the machine ID.
        const sig = crypto.sign(null, Buffer.from(machineId, 'utf8'), privKey);
        res.status(200).json({ ok: true, machineId, key: sig.toString('base64') });
    } catch (err) {
        res.status(500).json({ ok: false, message: err.message });
    }
});

module.exports = router;
