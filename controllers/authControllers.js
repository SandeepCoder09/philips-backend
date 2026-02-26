const User = require("../models/User");
const Counter = require("../models/Counter");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ======================
// REGISTER USER
// ======================
const registerUser = async (req, res) => {
  try {
    const { name, mobile, password, inviteCode } = req.body;


    if (!name || !mobile || !password) {
      return res.status(400).json({
        message: "Name, mobile and password are required"
      });
    }


    const existingUser = await User.findOne({ mobile });

    if (existingUser) {
      return res.status(400).json({
        message: "Mobile number already registered"
      });
    }


    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // ===============================
    // SAFE COUNTER INITIALIZATION
    // ===============================
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

    // ===============================
    // VALIDATE REFERRAL
    // ===============================
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

    // ===============================
    // CREATE USER
    // ===============================
    const newUser = new User({
      name,
      mobile,
      password: hashedPassword,
      userId: newUserId,
      referredById
    });

    await newUser.save();

    res.status(201).json({
      message: "User registered successfully",
      userId: newUser.userId
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

// ======================
// LOGIN USER
// ======================
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

    // ✅ USE userId INSTEAD OF _id
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
    res.status(500).json({
      error: error.message
    });
  }
};

module.exports = {
  registerUser,
  loginUser
};
