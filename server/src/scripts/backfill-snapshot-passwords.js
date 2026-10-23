#!/usr/bin/env node
// One-shot backfill: ensure every stored snapshot site carries a password
// key (old docs were written by a sanitizer that dropped the field, so the
// dashboard could not render the credential row). Existing values are kept;
// missing ones become '' until the next app snapshot repopulates them.
//
// Usage (from server/): npm run backfill-passwords

require('dotenv').config();
const mongoose = require('mongoose');

const main = async () => {
    const url =
        process.env.MONGODB_URI ||
        'mongodb://localhost:27017/' + (process.env.DB_NAME || 'subscriber_db');
    await mongoose.connect(url);

    try {
        const col = mongoose.connection.collection('clientsnapshots');
        const pipeline = [
            {
                $set: {
                    sites: {
                        $map: {
                            input: { $ifNull: ['$sites', []] },
                            as: 's',
                            in: {
                                $mergeObjects: [
                                    '$$s',
                                    { password: { $ifNull: ['$$s.password', ''] } },
                                ],
                            },
                        },
                    },
                    unconfigured: {
                        $map: {
                            input: { $ifNull: ['$unconfigured', []] },
                            as: 's',
                            in: {
                                $mergeObjects: [
                                    '$$s',
                                    { password: { $ifNull: ['$$s.password', ''] } },
                                ],
                            },
                        },
                    },
                },
            },
        ];
        const result = await col.updateMany({}, pipeline);
        console.log('DB     = ' + mongoose.connection.db.databaseName);
        console.log('docs examines : ' + result.matchedCount);
        console.log('docs modifies : ' + result.modifiedCount);

        const sample = await col.findOne({}, { projection: { sites: 1, unconfigured: 1 } });
        if (sample) {
            const s0 = (sample.sites || [])[0] || {};
            const u0 = (sample.unconfigured || [])[0] || {};
            console.log('sample sites[0] keys        : ' + Object.keys(s0).sort().join(', '));
            console.log('sample unconfigured[0] keys : ' + Object.keys(u0).sort().join(', '));
        }
    } finally {
        await mongoose.disconnect();
    }
};

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
