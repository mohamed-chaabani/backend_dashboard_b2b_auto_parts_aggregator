const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middlewares/authMiddleware');

// Connexion utilisateur (app Tauri)
router.post('/auth/login', authController.login);

// Profil courant (porte d'abonnement)
router.get('/me', authMiddleware, authController.me);

module.exports = router;
