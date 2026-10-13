const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB Atlas via MONGODB_URI, sinon fallback local
const url = process.env.MONGODB_URI || 'mongodb://localhost:27017/' + (process.env.DB_NAME || 'subscriber_db');

mongoose.connect(url)
    .then(() => {
        console.log('Connecte a MongoDB');
    })
    .catch(err => {
        console.error('Erreur de connexion a MongoDB: ', err.message);
        // Sur Vercel (serverless) on ne tue pas le process, sinon la function crash
        if (!process.env.VERCEL) process.exit(1);
    });

module.exports = mongoose;
