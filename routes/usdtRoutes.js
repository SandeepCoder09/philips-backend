const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");
const UsdtConversion = require("../models/UsdtConversion");

/* =========================================
   USDT → INR CONVERT
========================================= */

router.post("/convert", authMiddleware, async (req, res) => {
    try {
  
      const FIXED_RATE = 80;
      const MIN_CONVERT = 5;
  
      const amount = Number(req.body.amount);
  
      if (!Number.isFinite(amount) || amount < MIN_CONVERT) {
        return res.status(400).json({
          success: false,
          message: "Minimum conversion is 5 USDT"
        });
      }
  
      const user = await User.findOne({ userId: req.user.userId });
  
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
  
      const inrAmount = amount * FIXED_RATE;
  
      // 🔥 ATOMIC BALANCE UPDATE
      const updateResult = await User.updateOne(
        {
          _id: user._id,
          usdtBalance: { $gte: amount } // 🔐 Prevent negative
        },
        {
          $inc: {
            usdtBalance: -amount,
            walletBalance: inrAmount
          }
        }
      );
  
      // If no document updated → insufficient balance
      if (updateResult.modifiedCount === 0) {
        return res.status(400).json({
          success: false,
          message: "Insufficient USDT balance"
        });
      }
  
      // Log conversion AFTER successful update
      await UsdtConversion.create({
        user: user._id,
        usdtAmount: amount,
        inrAmount: inrAmount,
        rate: FIXED_RATE
      });
  
      res.json({
        success: true,
        message: "Conversion successful"
      });
  
    } catch (error) {
      console.error("Convert Error:", error);
      res.status(500).json({
        success: false,
        message: "Server error"
      });
    }
  });

/* =========================================
   GET USER CONVERSION HISTORY
========================================= */

router.get("/history", authMiddleware, async (req, res) => {
    try {

        // 🔥 Get full user first
        const user = await User.findOne({ userId: req.user.userId });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const totalRecords = await UsdtConversion.countDocuments({
            user: user._id   // ✅ CORRECT
        });

        const history = await UsdtConversion
            .find({ user: user._id })   // ✅ CORRECT
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            success: true,
            currentPage: page,
            totalPages: Math.ceil(totalRecords / limit),
            totalRecords,
            data: history
        });

    } catch (error) {
        console.error("History Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

module.exports = router;