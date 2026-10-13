require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const db = require('./config/db');

const app = express();

app.use(cors());
app.use(bodyParser.json());

// Lire toutes les routes depuis le dossier 'routes'
const fs = require('fs');
const routesDir = path.join(__dirname, 'routes');
fs.readdirSync(routesDir).forEach(file => {
    const routePath = path.join(routesDir, file);
    const route = require(routePath);
    app.use('/api', route); // Toutes les routes seront precedees de /api
});

module.exports = app;
