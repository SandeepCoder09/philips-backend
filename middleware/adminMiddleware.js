const jwt = require("jsonwebtoken");
const User = require("../models/User");

/* =========================================
   VERIFY ADMIN TOKEN
========================================= */

const adminMiddleware = async (req, res, next) => {
  try {

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing"
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload"
      });
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (!user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admin access required"
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: "Admin account suspended"
      });
    }

    // Attach minimal admin data
    req.user = {
      id: user._id,
      role: user.role,
      isAdmin: user.isAdmin
    };

    next();

  } catch (error) {

    console.error("Admin Middleware Error:", error);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    });

  }
};


/* =========================================
   SUPER ADMIN ONLY
========================================= */

const superAdminOnly = (req, res, next) => {

  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "User not authenticated"
    });
  }

  if (req.user.role !== "super_admin") {
    return res.status(403).json({
      success: false,
      message: "Super Admin access required"
    });
  }

  next();
};


/* =========================================
   MANAGER OR SUPER ADMIN
========================================= */

const managerOrSuperAdmin = (req, res, next) => {

  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "User not authenticated"
    });
  }

  const allowedRoles = ["manager_admin", "super_admin"];

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Manager or Super Admin required"
    });
  }

  next();
};


module.exports = {
  adminMiddleware,
  superAdminOnly,
  managerOrSuperAdmin
};