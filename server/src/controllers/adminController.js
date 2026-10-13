const adminService = require('../services/adminService');

// POST /api/admin/login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await adminService.login(email, password);
        res.status(200).json(result);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// GET /api/admin/plans
const plans = async (req, res) => {
    try {
        res.status(200).json({ plans: adminService.plans() });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// GET /api/admin/users?status=&plan=&q=
const listUsers = async (req, res) => {
    try {
        const { status, plan, q } = req.query;
        const users = await adminService.listUsers({ status, plan, q });
        res.status(200).json({ users });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// POST /api/admin/users
const createUser = async (req, res) => {
    try {
        const user = await adminService.createUser(req.body);
        res.status(201).json({ user });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// PUT /api/admin/users/:id
const updateUser = async (req, res) => {
    try {
        const user = await adminService.updateUser(req.params.id, req.body);
        res.status(200).json({ user });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// DELETE /api/admin/users/:id
const deleteUser = async (req, res) => {
    try {
        const result = await adminService.deleteUser(req.params.id);
        res.status(200).json(result);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// GET /api/admin/stats
const stats = async (req, res) => {
    try {
        const data = await adminService.stats();
        res.status(200).json(data);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

module.exports = {
    login,
    plans,
    listUsers,
    createUser,
    updateUser,
    deleteUser,
    stats,
};
