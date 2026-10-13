const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { PLAN_IDS, statusFor } = require('../plans');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Le nom est obligatoire'],
        trim: true,
    },
    username: {
        type: String,
        required: [true, "Le nom d'utilisateur est obligatoire"],
        unique: true,
        lowercase: true,
        trim: true,
    },
    phone: {
        type: String,
        required: [true, 'Le telephone est obligatoire'],
        trim: true,
    },
    company: {
        type: String,
        trim: true,
        default: '',
    },
    plan: {
        type: String,
        enum: PLAN_IDS,
        required: [true, 'Le plan est obligatoire'],
    },
    expiryDate: {
        type: Date,
        required: [true, "La date d'expiration est obligatoire"],
    },
    password: {
        type: String,
        required: true,
        minlength: [8, 'Le mot de passe doit contenir au moins 8 caracteres'],
        validate: {
            validator: function (value) {
                // Hash bcrypt : on ne revalide que lors de la creation / reset
                if (value && value.startsWith('$2')) return true;
                return /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value) && /[!@#$%^&*]/.test(value);
            },
            message: 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractere special (!@#$%^&*)',
        },
    },
}, { timestamps: true });

// Hash du mot de passe avant sauvegarde (creation ou reset)
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    if (this.password && this.password.startsWith('$2')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.isPasswordValid = async function (password) {
    return await bcrypt.compare(password, this.password);
};

// Representation publique : statut derive, jamais de hash
userSchema.methods.toPublic = function () {
    return {
        id: this._id,
        name: this.name,
        username: this.username,
        phone: this.phone,
        company: this.company,
        plan: this.plan,
        expiryDate: this.expiryDate,
        status: statusFor(this.expiryDate),
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
    };
};

const User = mongoose.model('User', userSchema);

module.exports = User;
