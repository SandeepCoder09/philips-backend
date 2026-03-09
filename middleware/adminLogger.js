const AdminLog = require("../models/AdminLog");

module.exports = function (action) {
  return async (req, res, next) => {
    try {

      const targetUser =
        req.body.userId ||
        req.body.targetUserId ||
        req.body.id ||
        null;

      const ip =
        req.headers["x-forwarded-for"] ||
        req.socket.remoteAddress ||
        req.ip;

      await AdminLog.create({
        adminId: req.user.id,
        adminRole: req.user.role,
        action,
        targetUserId: targetUser,
        metadata: req.body,
        ipAddress: ip
      });

    } catch (err) {
      console.log("Admin Log Error:", err.message);
    }

    next();
  };
};