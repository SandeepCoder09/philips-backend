const express = require("express");
const router = express.Router();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");

// Import user controllers
const {
  registerUser,
  loginUser
} = require("../controllers/authControllers");


/* =====================================================
   USER ROUTES
===================================================== */

router.post("/register", registerUser);
router.post("/login", loginUser);


/* =====================================================
   ADMIN LOGIN (EMAIL + PASSWORD)
===================================================== */

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
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

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
    res.status(500).json({ message: "Server error" });
  }
});


/* =====================================================
   CREATE ADMIN (POSTMAN USE ONLY)
===================================================== */

router.post("/create-admin", async (req, res) => {
  try {

    const { name, email, password, mobile } = req.body;

    if (!name || !email || !password || !mobile) {
      return res.status(400).json({
        message: "Name, email, password and mobile required"
      });
    }

    // Check duplicate email
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        message: "Email already exists"
      });
    }

    // Check duplicate mobile
    const existingMobile = await User.findOne({ mobile });
    if (existingMobile) {
      return res.status(400).json({
        message: "Mobile already exists"
      });
    }

    // Auto-generate next userId
    const lastUser = await User.findOne().sort({ userId: -1 });
    const nextUserId = lastUser ? lastUser.userId + 1 : 1000;

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await User.create({
      name,
      email,
      mobile,
      userId: nextUserId,
      password: hashedPassword,
      walletBalance: 0,
      isAdmin: true
    });

    res.json({
      message: "Admin created successfully",
      admin
    });

  } catch (error) {
    console.error("Create admin error:", error);
    res.status(500).json({
  message: "Error creating admin",
  error: error.message
});
  }
});


module.exports = router;