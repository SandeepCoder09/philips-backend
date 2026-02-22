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

    // Validate required fields
    if (!name || !mobile || !password) {
      return res.status(400).json({
        message: "Name, mobile and password are required"
      });
    }

    // Check if mobile already exists
    const existingUser = await User.findOne({ mobile });

    if (existingUser) {
      return res.status(400).json({
        message: "Mobile number already registered"
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // ===============================
    // SAFE COUNTER INITIALIZATION
    // ===============================
    let counter = await Counter.findOne({ name: "userId" });

    if (!counter) {
      counter = await Counter.create({
        name: "userId",
        value: 9999 // so first user becomes 10000
      });
    }

    // Atomic increment
    counter.value += 1;
    await counter.save();

    const newUserId = counter.value;

    // ===============================
    // VALIDATE REFERRAL (IF PROVIDED)
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
    // CREATE NEW USER
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

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        userId: user.userId,
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
