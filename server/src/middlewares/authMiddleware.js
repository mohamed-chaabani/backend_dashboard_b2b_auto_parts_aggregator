const jwt = require('jsonwebtoken');

// Verifie le token JWT et attache le payload a req.user
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(403).json({ message: 'Token manquant' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Token invalide' });
        }

        req.user = decoded;
        next();
    });
};

// Restreint l'acces aux routes admin
const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acces admin requis' });
    }
    next();
};

module.exports = authMiddleware;
module.exports.authMiddleware = authMiddleware;
module.exports.requireAdmin = requireAdmin;
