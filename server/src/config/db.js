const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB Atlas via MONGODB_URI, sinon fallback local
const url = process.env.MONGODB_URI || 'mongodb://localhost:27017/' + (process.env.DB_NAME || 'subscriber_db');

// Serverless (Vercel) : cache la promesse de connexion sur l'instance
// pour eviter un reconnect a chaque invocation et le race cold-start.
// Sans ca, la 1re requete arrive avant mongoose.connect() -> operations
// bufferisees 10s (bufferCommands default) -> "buffering timed out".
let cached = global._mongooseConn;
if (!cached) {
    cached = global._mongooseConn = { conn: null, promise: null };
}

async function connectDB() {
    if (cached.conn) return cached.conn;
    if (!cached.promise) {
        // Echec rapide si pas connecte au lieu d'attendre 10s (buffer)
        mongoose.set('bufferCommands', false);
        cached.promise = mongoose.connect(url, {
            serverSelectionTimeoutMS: 8000,
            connectTimeoutMS: 8000,
        }).then(m => {
            console.log('Connecte a MongoDB');
            return m;
        }).catch(err => {
            console.error('Erreur de connexion a MongoDB: ', err.message);
            // Reset pour reessayer a la requete suivante
            cached.promise = null;
            // Sur Vercel (serverless) on ne tue pas le process
            if (!process.env.VERCEL) process.exit(1);
            throw err;
        });
    }
    cached.conn = await cached.promise;
    return cached.conn;
}

// Demarrage eager (non bloquant) ; les routes attendent via connectDB()
connectDB().catch(() => { /* middleware reessaie */ });

module.exports = mongoose;
module.exports.connectDB = connectDB;
