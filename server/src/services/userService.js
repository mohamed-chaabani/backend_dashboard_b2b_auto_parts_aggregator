const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { statusFor } = require("../plans");

const signUserToken = (user) => {
  return jwt.sign(
    { sub: user._id.toString(), role: "user" },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );
};

const userService = {
  // Connexion utilisateur (app Tauri) : username + mot de passe
  login: async (username, password) => {
    if (!username || !password) {
      throw new Error("Username et mot de passe sont obligatoires");
    }

    // find() retourne un tableau : on destructure le premier resultat
    const [user] = await User.find({ username: username.trim().toLowerCase() });
    if (!user) {
      throw new Error("Utilisateur non trouve");
    }

    const isValidPassword = await user.isPasswordValid(password);
    if (!isValidPassword) {
      throw new Error("Mot de passe incorrect");
    }

    // Verifie l'abonnement AVANT d'emettre le token (apres le password,
    // pour ne pas reveler le statut sans mot de passe valide).
    if (statusFor(user.expiryDate) === "expired") {
      throw new Error("Abonnement expire. Contactez l'administrateur.");
    }

    return { token: signUserToken(user), user: user.toPublic() };
  },

  // Profil courant (porte d'abonnement cote Tauri)
  me: async (userId) => {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Utilisateur non trouve");
    }
    return user.toPublic();
  },
};

module.exports = userService;
