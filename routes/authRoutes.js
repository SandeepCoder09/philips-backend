const express = require("express");
const router = express.Router();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");

// Import user controllers
const { registerUser, loginUser } = require("../controllers/authControllers");


/* =====================================================
   USER ROUTES
===================================================== */

// Register user
router.post("/register", registerUser);

// Login user
router.post("/login", loginUser);


/* =====================================================
   ADMIN LOGIN (EMAIL + PASSWORD)
===================================================== */

router.post("/admin-login", async (req, res) => {
  try {

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const user = await User.findOne({ email });

    if (!user || !["manager_admin", "super_admin"].includes(user.role)) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        isAdmin: true
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      success: true,
      message: "Admin login successful",
      token,
      role: user.role
    });

  } catch (error) {
    console.error("Admin login error:", error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});


/* =====================================================
   CREATE ADMIN (FOR INITIAL SETUP / POSTMAN)
===================================================== */

const { adminMiddleware, superAdminOnly } = require("../middleware/adminMiddleware");

router.post(
  "/create-admin",
  adminMiddleware,
  superAdminOnly,
  async (req, res) => {

    try {

      const { name, email, password, mobile, role } = req.body;

      if (!name || !email || !password || !mobile || !role) {
        return res.status(400).json({
          success: false,
          message: "Name, email, password, mobile and role are required"
        });
      }

      if (!["manager_admin", "super_admin"].includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Role must be manager_admin or super_admin"
        });
      }

      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: "Email already exists"
        });
      }

      const mobileExists = await User.findOne({ mobile });
      if (mobileExists) {
        return res.status(400).json({
          success: false,
          message: "Mobile already exists"
        });
      }



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
        role,
        isAdmin: true
      });

      res.json({
        success: true,
        message: "Admin created successfully",
        admin
      });

    } catch (error) {
      console.error("Create admin error:", error);

      res.status(500).json({
        success: false,
        message: "Error creating admin",
        error: error.message
      });
    }
  });


module.exports = router;
