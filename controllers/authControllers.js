const User = require("../models/User");
const Counter = require("../models/Counter");
const Transaction = require("../models/Transaction");
const UserDevice = require("../models/UserDevice");
const BankAccount = require("../models/BankAccount");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const generateTransactionId = require("../utils/generateTransactionId");


/* =====================================================
   REGISTER USER (REAL-TIME ENABLED)
===================================================== */
const registerUser = async (req, res) => {
  try {
    let { name, mobile, password, inviteCode } = req.body;

    if (!name || !mobile || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, mobile and password are required"
      });
    }

    // Normalize mobile
    mobile = mobile.replace("+91", "");
    mobile = "+91" + mobile;

    const existingUser = await User.findOne({ mobile });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Mobile number already registered"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    /* ================= GENERATE USER ID ================= */
    let counter = await Counter.findOne({ name: "userId" });

    if (!counter) {
      counter = await Counter.create({
        name: "userId",
        value: 9999
      });
    }

    counter.value += 1;
    await counter.save();

    const newUserId = counter.value;

    /* ================= VALIDATE INVITE ================= */
    let referredById = null;

    if (inviteCode) {
      const refUser = await User.findOne({
        userId: Number(inviteCode)
      });

      if (!refUser) {
        return res.status(400).json({
          success: false,
          message: "Invalid invite code"
        });
      }

      referredById = refUser.userId;
    }

    /* ================= CREATE USER ================= */
    const newUser = await User.create({
      name,
      mobile,
      password: hashedPassword,
      userId: newUserId,
      referredById,
      walletBalance: 0,
      isBanned: false
    });

    /* ================= REGISTRATION BONUS ================= */
    if (referredById) {
      await User.updateOne(
        { userId: newUser.userId },
        { $inc: { walletBalance: 30 } }
      );

      await Transaction.create({
        userId: newUser.userId,
        orderId: generateTransactionId("registration_bonus"),
        amount: 30,
        type: "registration_bonus",
        status: "success",
        description: `Registration bonus for invite code ${referredById}`
      });
    }

    /* =====================================================
       🔥 REAL-TIME EVENT FOR ADMIN
    ===================================================== */
    const io = req.app.get("io");
    if (io) {
      io.to("admin_room").emit("user_registered");
    }

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      userId: newUser.userId
    });

  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};


/* =====================================================
   LOGIN USER
===================================================== */
const loginUser = async (req, res) => {
  try {
    let { mobile, password } = req.body;

    if (!mobile || !password) {
      return res.status(400).json({
        success: false,
        message: "Mobile and password are required"
      });
    }

    const cleanMobile = mobile.replace("+91", "");


    const user = await User.findOne({
      $or: [
        { mobile },
        { mobile: cleanMobile },
        { mobile: "+91" + cleanMobile }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not registered"
      });
    }


    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);


    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Wrong password"
      });
    }


    if (!user.mobile.startsWith("+91")) {
      user.mobile = "+91" + cleanMobile;
    }

    user.lastLogin = new Date();
    await user.save();


    try {
      await UserDevice.create({
        userId: user._id,
        ipAddress:
          req.headers["x-forwarded-for"] ||
          req.socket.remoteAddress ||
          "Unknown",
        userAgent: req.headers["user-agent"] || "Unknown",
        deviceInfo: req.headers["sec-ch-ua"] || "Browser"
      });
    } catch (deviceError) {
      console.error("Device log failed:", deviceError.message);
    }


    const token = jwt.sign(
      {
        userId: user.userId,
        mongoId: user._id,
        isAdmin: user.isAdmin || false
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        userId: user.userId,
        name: user.name,
        mobile: user.mobile,
        walletBalance: user.walletBalance,
        isAdmin: user.isAdmin || false
      }
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};


/* =====================================================
   GET USER BANKS
===================================================== */
const getUserBanks = async (req, res) => {
  try {
    const { userId, mongoId } = req.user;


    const banks = await BankAccount.find({
      $or: [
        { userId: userId },
        { userId: mongoId }
      ]
    });

    res.status(200).json(banks);

  } catch (error) {
    console.error("Bank Fetch Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load bank accounts"
    });
  }
};


module.exports = {
  registerUser,
  loginUser,
  getUserBanks
};

