#!/usr/bin/env node
// Cree (ou met a jour) un compte admin dans MongoDB.
//
// Usage :
//   npm run create-admin -- <email> <mot de passe> [nom]
//   npm run create-admin -- admin@exemple.tn "Str0ng&Pass1" "Ahmed"

require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

const [email, password, name] = process.argv.slice(2);

const usage = () => {
    console.log('Usage : npm run create-admin -- <email> <mot de passe> [nom]');
    console.log('Exemple : npm run create-admin -- admin@exemple.tn "Str0ng&Pass1" "Ahmed"');
};

const validatePassword = (pw) => {
    if (!pw || pw.length < 8) return 'au moins 8 caracteres';
    if (!/[A-Z]/.test(pw)) return 'au moins une majuscule';
    if (!/[a-z]/.test(pw)) return 'au moins une minuscule';
    if (!/[0-9]/.test(pw)) return 'au moins un chiffre';
    if (!/[!@#$%^&*]/.test(pw)) return 'au moins un caractere special (!@#$%^&*)';
    return null;
};

const main = async () => {
    if (!email || !password) {
        usage();
        process.exit(1);
    }

    const pwError = validatePassword(password);
    if (pwError) {
        console.error('Mot de passe invalide : ' + pwError);
        process.exit(1);
    }

    // Connexion a la base (MONGODB_URI ou fallback local)
    const url =
        process.env.MONGODB_URI ||
        'mongodb://localhost:27017/' + (process.env.DB_NAME || 'subscriber_db');
    await mongoose.connect(url);

    try {
        const existing = await Admin.findOne({ email: email.toLowerCase() });
        if (existing) {
            // Deja cree : on ne reecrit rien (pas de doublon, pas de reset force)
            console.log('Admin deja existant — rien fait :');
            console.log('  email = ' + existing.email);
            console.log('  nom   = ' + existing.name);
            console.log('DB     = ' + mongoose.connection.db.databaseName + ' (collection admins)');
            return;
        }

        const admin = new Admin({ email, password, name: name || 'Admin' });
        // pre('save') hash le mot de passe
        await admin.save();

        console.log('Admin cree :');
        console.log('  email = ' + admin.email);
        console.log('  nom   = ' + admin.name);
        console.log('DB     = ' + mongoose.connection.db.databaseName + ' (collection admins)');
    } finally {
        await mongoose.disconnect();
    }
};

main().catch((err) => {
    console.error('Erreur : ' + err.message);
    process.exit(1);
});
