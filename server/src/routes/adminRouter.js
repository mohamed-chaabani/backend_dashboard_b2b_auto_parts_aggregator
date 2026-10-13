const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authMiddleware, requireAdmin } = require('../middlewares/authMiddleware');

// Connexion admin (identifiants dans .env)
router.post('/admin/login', adminController.login);

// Catalogue des plans (public pour le drawer/dashboard)
router.get('/admin/plans', adminController.plans);

// Routes protegees admin
router.get('/admin/users', authMiddleware, requireAdmin, adminController.listUsers);
router.post('/admin/users', authMiddleware, requireAdmin, adminController.createUser);
router.put('/admin/users/:id', authMiddleware, requireAdmin, adminController.updateUser);
router.delete('/admin/users/:id', authMiddleware, requireAdmin, adminController.deleteUser);
router.get('/admin/stats', authMiddleware, requireAdmin, adminController.stats);

module.exports = router;
