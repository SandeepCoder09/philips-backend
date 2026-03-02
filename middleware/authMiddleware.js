const jwt = require("jsonwebtoken");
const User = require("../models/User");

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

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: "Invalid token"
      });
    }

    // ✅ CASE 1: Normal User Token
    if (decoded.userId) {

      const user = await User.findOne({ userId: decoded.userId });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found"
        });
      }

      if (user.isBanned) {
        return res.status(403).json({
          success: false,
          message: "Your account has been suspended"
        });
      }

      req.user = {
        _id: user._id,
        userId: user.userId,
        isAdmin: user.isAdmin || false
      };

      return next();
    }

    // ✅ CASE 2: Admin Token
    if (decoded.isAdmin) {

      req.user = {
        isAdmin: true
      };

      return next();
    }

    return res.status(401).json({
      success: false,
      message: "Invalid token payload"
    });

  } catch (err) {
    console.error("Auth Middleware Error:", err);
    return res.status(401).json({
      success: false,
      message: "Invalid token"
    });
  }
};

module.exports = authMiddleware;