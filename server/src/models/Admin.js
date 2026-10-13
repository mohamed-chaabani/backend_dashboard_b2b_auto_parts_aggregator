const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const validator = require('validator');

// Comptes administrateur du dashboard (collection "admins")
const adminSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: (value) => validator.isEmail(value),
            message: (props) => props.value + " n'est pas un email valide!",
        },
    },
    name: {
        type: String,
        trim: true,
        default: 'Admin',
    },
    password: {
        type: String,
        required: true,
        minlength: [8, 'Le mot de passe doit contenir au moins 8 caracteres'],
    },
}, { timestamps: true });

// Hash avant sauvegarde (creation ou reset)
adminSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    if (this.password && this.password.startsWith('$2')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

adminSchema.methods.isPasswordValid = async function (password) {
    return await bcrypt.compare(password, this.password);
};

adminSchema.methods.toPublic = function () {
    return { id: this._id, email: this.email, name: this.name };
};

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;
