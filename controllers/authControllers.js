const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const generateInviteCode = require("../utils/generateInviteCode");

// ======================
// REGISTER USER
// ======================
const registerUser = async (req, res) => {
  try {
    const { name, email, mobile, password } = req.body;

    // Check required fields
    if (!name || !email || !mobile || !password) {
      return res.status(400).json({
        message: "All fields (name, email, mobile, password) are required"
      });
    }

    // Check if user already exists (by mobile OR email)
    const existingUser = await User.findOne({
      $or: [{ mobile }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists"
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate invite code
    const inviteCode = generateInviteCode();

    // Create new user
    const newUser = new User({
      name,
      email,
      mobile,
      password: hashedPassword,
      inviteCode
    });

    await newUser.save();

    res.status(201).json({
      message: "User registered successfully",
      inviteCode
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
        email: user.email,
        mobile: user.mobile,
        inviteCode: user.inviteCode
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