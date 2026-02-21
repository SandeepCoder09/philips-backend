const express = require("express");
const router = express.Router();

const { registerUser, loginUser } = require("../controllers/authControllers");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ================= USER ROUTES =================
router.post("/register", registerUser);
router.post("/login", loginUser);

// ================= ADMIN LOGIN =================
router.post("/admin-login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user || !user.isAdmin) {
      return res.status(403).json({
        message: "Not authorized as admin"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials"
      });
    }

    const token = jwt.sign(
      { id: user._id, isAdmin: true },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Admin login successful",
      token
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error"
    });
  }
});

// ================= HASH GENERATOR (TEMP - REMOVE LATER) =================
router.post("/generate-hash", async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Password required" });
    }

    const bcrypt = require("bcryptjs");
    const hash = await bcrypt.hash(password, 10);

    res.json({ hash });

  } catch (error) {
    res.status(500).json({ message: "Error generating hash" });
  }
});

module.exports = router;
