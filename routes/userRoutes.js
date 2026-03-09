const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");

const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");

/* =====================================================
   TEST ROUTE
===================================================== */
router.get("/", (req, res) => {
  res.json({ message: "User route working" });
});

/* =====================================================
   🔐 GET PROFILE (Protected)
===================================================== */
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.user.userId })
      .select("-password -withdrawPin");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      message: "Profile fetched successfully",
      user
    });

  } catch (error) {
    console.error("Profile Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});


/* =====================================================
   🔎 CHECK IF PIN IS SET
===================================================== */
router.get("/has-withdraw-pin", authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.user.userId })
      .select("withdrawPin");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      hasPin: !!user.withdrawPin
    });

  } catch (error) {
    console.error("Check PIN Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

/* =====================================================
   🔐 SET WITHDRAW PIN
===================================================== */
router.post("/set-withdraw-pin", authMiddleware, async (req, res) => {
  try {

    const { pin } = req.body;

    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        message: "PIN must be 4 digits"
      });
    }

    const user = await User.findOne({ userId: req.user.userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (user.withdrawPin) {
      return res.status(400).json({
        success: false,
        message: "Withdraw PIN already set"
      });
    }

    const hashedPin = await bcrypt.hash(pin, 10);

    user.withdrawPin = hashedPin;
    await user.save();

    res.json({
      success: true,
      message: "Withdraw PIN set successfully"
    });

  } catch (error) {
    console.error("Set PIN Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

module.exports = router;