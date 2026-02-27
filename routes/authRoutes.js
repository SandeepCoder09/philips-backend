const express = require("express");
const router = express.Router();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const { registerUser, loginUser } = require("../controllers/authControllers");


// ================= USER ROUTES =================
router.post("/register", registerUser);
router.post("/login", loginUser);


// ================= ADMIN LOGIN =================
router.post("/admin-login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password required"
      });
    }

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

    // ✅ IMPORTANT: Use Mongo _id (NOT userId)
    const token = jwt.sign(
      {
        id: user._id,
        isAdmin: true
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Admin login successful",
      token
    });

  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({
      message: "Server error"
    });
  }
});


// ================= TEMP: CREATE ADMIN (DELETE AFTER USE) =================
router.post("/create-admin", async (req, res) => {
  try {

    const existing = await User.findOne({ isAdmin: true });

    if (existing) {
      return res.json({ message: "Admin already exists" });
    }

    const hashedPassword = await bcrypt.hash("123456", 10);

    const admin = await User.create({
      name: "Super Admin",
      mobile: "0000000000",
      userId: 99999,        // IMPORTANT
      password: hashedPassword,
      walletBalance: 0,
      isAdmin: true
    });

    res.json({
      message: "Admin created successfully",
      admin
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating admin" });
  }
});


module.exports = router;