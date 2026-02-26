const jwt = require("jsonwebtoken");
const processEarnings = require("../utils/processEarnings");

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "No token provided"
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload"
      });
    }

    // Attach userId to request
    req.user = {
      userId: decoded.userId,
      isAdmin: decoded.isAdmin || false
    };

    // 💰 Safe earning processor
    try {
      await processEarnings(decoded.userId);
    } catch (earningError) {
      console.error("Earning Engine Error:", earningError);
    }

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid token"
    });
  }
};

module.exports = authMiddleware;