const AdminLog = require("../models/AdminLog");

module.exports = function(action) {
  return async (req, res, next) => {
    try {
      await AdminLog.create({
        adminId: req.user.id,
        action,
        targetUserId: req.body.userId || null,
        metadata: req.body,
        ipAddress: req.ip
      });
    } catch (err) {
      console.log("Log Error:", err.message);
    }
    next();
  };
};