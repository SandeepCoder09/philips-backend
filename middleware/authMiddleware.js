const jwt = require("jsonwebtoken");
const processEarnings = require("../utils/processEarnings");

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // 🔒 Check token existence
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "No token provided"
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    // ✅ Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload"
      });
    }

    req.user = decoded;

    /*
      💰 SAFE EARNING ENGINE
      Runs earning processor when authenticated request happens.
      If it fails, it will not block API.
    */
    try {
      await processEarnings(decoded.id);
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