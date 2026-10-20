const mongoose = require('mongoose');

// Latest site inventory reported by one machine (PC) of a client.
// Upserted by machineId on every app start / Integrations load / site change.
const siteSchema = new mongoose.Schema({
    id: { type: String, default: '', maxlength: 100 },
    name: { type: String, default: '', maxlength: 200 },
    baseUrl: { type: String, default: '', maxlength: 500 },
    enabled: { type: Boolean, default: false },
    deleted: { type: Boolean, default: false },
    builtin: { type: Boolean, default: false },
    builtinParser: { type: Boolean, default: false },
    searchReady: { type: Boolean, default: false },
    username: { type: String, default: '', maxlength: 200 },
}, { _id: false });

// Same rule as SearchPage computeUnconfigured(): enabled custom site without
// a search config (the amber "NON CONFIGURE" strip).
const unconfiguredSchema = new mongoose.Schema({
    id: { type: String, default: '', maxlength: 100 },
    name: { type: String, default: '', maxlength: 200 },
    baseUrl: { type: String, default: '', maxlength: 500 },
    username: { type: String, default: '', maxlength: 200 },
}, { _id: false });

const clientSnapshotSchema = new mongoose.Schema({
    machineId: { type: String, required: true, unique: true, maxlength: 100 },
    clientId: { type: String, default: '', maxlength: 50, index: true },
    user: {
        name: { type: String, default: '', maxlength: 200 },
        username: { type: String, default: '', maxlength: 200 },
        company: { type: String, default: '', maxlength: 200 },
    },
    appVersion: { type: String, default: '', maxlength: 50 },
    sites: { type: [siteSchema], default: [] },
    unconfigured: { type: [unconfiguredSchema], default: [] },
    firstSeen: { type: Date, default: null },
}, { timestamps: true }); // updatedAt = last sync from the app

const ClientSnapshot = mongoose.model('ClientSnapshot', clientSnapshotSchema);

module.exports = ClientSnapshot;
