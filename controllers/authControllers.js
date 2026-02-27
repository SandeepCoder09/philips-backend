const User = require("../models/User");
const Counter = require("../models/Counter");
const Transaction = require("../models/Transaction");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const generateTransactionId = require("../utils/generateTransactionId");

/* =====================================================
   REGISTER USER
===================================================== */
const registerUser = async (req, res) => {
  try {
    const { name, mobile, password, inviteCode } = req.body;

    /* ===============================
       VALIDATION
    ================================ */
    if (!name || !mobile || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, mobile and password are required"
      });
    }

    /* ===============================
       CHECK EXISTING USER
    ================================ */
    const existingUser = await User.findOne({ mobile });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Mobile number already registered"
      });
    }

    /* ===============================
       HASH PASSWORD
    ================================ */
    const hashedPassword = await bcrypt.hash(password, 10);

    /* ===============================
       GENERATE SAFE USER ID
    ================================ */
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

    /* ===============================
       VALIDATE INVITE CODE
    ================================ */
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

    /* ===============================
       CREATE NEW USER
    ================================ */
    const newUser = await User.create({
      name,
      mobile,
      password: hashedPassword,
      userId: newUserId,
      referredById,
      walletBalance: 0
    });

    /* ===============================
       REGISTRATION BONUS (₹30)
       Only if invite used
    ================================ */
    if (referredById) {

      // Atomic wallet increment
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
        description: `Registration bonus for using invite code ${referredById}`
      });
    }

    /* ===============================
       SUCCESS RESPONSE
    ================================ */
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
    const { mobile, password } = req.body;

    if (!mobile || !password) {
      return res.status(400).json({
        success: false,
        message: "Mobile and password are required"
      });
    }

    const user = await User.findOne({ mobile });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials"
      });
    }


    const token = jwt.sign(
      { userId: user.userId },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        userId: user.userId,
        name: user.name,
        mobile: user.mobile,
        walletBalance: user.walletBalance
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


module.exports = {
  registerUser,
  loginUser
};

