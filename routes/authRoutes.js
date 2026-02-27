const express = require("express");
const router = express.Router();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");

// ✅ IMPORTANT: Correct controller file name (singular)
const { registerUser, loginUser } = require("../controllers/authControllers");


/* =====================================================
   USER ROUTES
===================================================== */

// Register
router.post("/register", registerUser);

// Login
router.post("/login", loginUser);


/* =====================================================
   ADMIN LOGIN
===================================================== */

router.post("/admin-login", async (req, res) => {
  try {

    const { mobile, password } = req.body;

    if (!mobile || !password) {
      return res.status(400).json({
        message: "Mobile and password required"
      });
    }

    const user = await User.findOne({ mobile });

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
      {
        id: user._id,        // Use Mongo ObjectId
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


/* =====================================================
   TEMP: CREATE ADMIN (DELETE AFTER USE)
===================================================== */

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
      userId: 99999,
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