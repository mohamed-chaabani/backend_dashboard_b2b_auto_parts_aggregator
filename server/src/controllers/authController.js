const userService = require('../services/userService');

// POST /api/auth/login
const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await userService.login(username, password);
        res.status(200).json(result);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// GET /api/me (JWT utilisateur)
const me = async (req, res) => {
    try {
        const user = await userService.me(req.user.sub);
        res.status(200).json({ user });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

module.exports = { login, me };
