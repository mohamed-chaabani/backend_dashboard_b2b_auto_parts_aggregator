require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { connectDB } = require('./config/db');
const mongoose = require('mongoose');

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

// Route de sante (uptime / debug) - expose l'etat mongoose sans bloquer
app.get('/api/health', (req, res) => {
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    res.json({
        ok: true,
        db: states[mongoose.connection.readyState] || mongoose.connection.readyState,
    });
});

// Attendre MongoDB avant les routes (evite buffering timeout au cold-start)
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        res.status(503).json({ message: 'Database indisponible', error: err.message });
    }
});

// Lire toutes les routes depuis le dossier 'routes'
const fs = require('fs');
const routesDir = path.join(__dirname, 'routes');
fs.readdirSync(routesDir).forEach(file => {
    const routePath = path.join(routesDir, file);
    const route = require(routePath);
    app.use('/api', route); // Toutes les routes seront precedees de /api
});

module.exports = app;
