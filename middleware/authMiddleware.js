const jwt = require("jsonwebtoken");
const User = require("../models/User");
const processEarnings = require("../utils/processEarnings");

const authMiddleware = async (req, res, next) => {
  try {

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided"
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload"
      });
    }

    // 🔥 Fetch user using numeric userId
    const user = await User.findOne({ userId: decoded.userId });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    // 🚫 BLOCK BANNED USERS
    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended"
      });
    }

    // Attach full user object safely
    req.user = {
      _id: user._id,
      userId: user.userId,
      isAdmin: user.isAdmin || false
    };

    // 💰 Safe earning processor (optional)
    // try {
    //   await processEarnings(user.userId);
    // } catch (earningError) {
    //   console.error("Earning Engine Error:", earningError);
    // }

    next();

  } catch (err) {
    console.error("Auth Middleware Error:", err);
    return res.status(401).json({
      success: false,
      message: "Invalid token"
    });
  }
};

module.exports = authMiddleware;