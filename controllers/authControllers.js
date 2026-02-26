const User = require("../models/User");
const Counter = require("../models/Counter");
const Transaction = require("../models/Transaction");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

/* =====================================================
   REGISTER USER
===================================================== */
const registerUser = async (req, res) => {
  try {
    const { name, mobile, password, inviteCode } = req.body;


    if (!name || !mobile || !password) {
      return res.status(400).json({
        message: "Name, mobile and password are required"
      });
    }

    // Check existing mobile
    const existingUser = await User.findOne({ mobile });

    if (existingUser) {
      return res.status(400).json({
        message: "Mobile number already registered"
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    /* ===============================
       SAFE USER ID COUNTER
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
          message: "Invalid invite code"
        });
      }

      referredById = refUser.userId;
    }

    /* ===============================
       CREATE USER
    ================================ */
    const newUser = new User({
      name,
      mobile,
      password: hashedPassword,
      userId: newUserId,
      referredById
    });

    await newUser.save();

    /* ===============================
       ₹30 REGISTRATION BONUS
       (Only if invite used)
    ================================ */
    if (referredById) {

      newUser.walletBalance += 30;
      await newUser.save();

      await Transaction.create({
        userId: newUser.userId,
        orderId: "REG30-" + Date.now(),
        amount: 30,
        type: "registration_bonus",
        status: "success",
        description: "Registration bonus for using invite code"
      });
    }

    res.status(201).json({
      message: "User registered successfully",
      userId: newUser.userId
    });

  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({
      error: error.message
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
        message: "Mobile and password are required"
      });
    }

    const user = await User.findOne({ mobile });

    if (!user) {
      return res.status(400).json({
        message: "Invalid credentials"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid credentials"
      });
    }

    // JWT uses numeric userId
    const token = jwt.sign(
      { userId: user.userId },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
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
      error: error.message
    });
  }
};


module.exports = {
  registerUser,
  loginUser
};

