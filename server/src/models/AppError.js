const mongoose = require('mongoose');

// Event kinds reported by the Tauri app (src/lib/telemetry.ts)
const KINDS = ['search', 'probe', 'equivalents', 'capture', 'login', 'activation', 'runtime'];

// Auth user id (hex string) - stored as String (not ObjectId) because events
// are sent by the app before we can validate the reference exists.
const HEX24 = /^[0-9a-fA-F]{24}$/;

const appErrorSchema = new mongoose.Schema({
    kind: {
        type: String,
        enum: KINDS,
        required: true,
        index: true,
    },
    message: {
        type: String,
        required: true,
        maxlength: 4000,
    },
    clientId: {
        type: String,
        default: '',
        index: true,
        set: (v) => (typeof v === 'string' && HEX24.test(v) ? v : ''),
    },
    machineId: {
        type: String,
        default: '',
        index: true,
    },
    user: {
        name: { type: String, default: '', maxlength: 200 },
        username: { type: String, default: '', maxlength: 200 },
        company: { type: String, default: '', maxlength: 200 },
    },
    appVersion: { type: String, default: '', maxlength: 50 },
    site: {
        id: { type: String, default: '', maxlength: 100 },
        name: { type: String, default: '', maxlength: 200 },
        baseUrl: { type: String, default: '', maxlength: 500 },
        username: { type: String, default: '', maxlength: 200 },
        password: { type: String, default: '', maxlength: 500 },
    },
    query: { type: String, default: '', maxlength: 500 },
    field: { type: String, default: '', maxlength: 50 },
    // dedup key: client|kind|site|message (dashboard can aggregate later)
    hash: { type: String, default: '', maxlength: 100, index: true },
    clientTs: { type: Date, default: null },
}, { timestamps: true });

appErrorSchema.index({ createdAt: -1 });

const AppError = mongoose.model('AppError', appErrorSchema);

module.exports = AppError;
module.exports.KINDS = KINDS;
