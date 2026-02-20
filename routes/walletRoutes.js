const express = require("express");
const router = express.Router();

const { Cashfree, CFEnvironment } = require("cashfree-pg");

// ✅ Correct initialization for your installed version
const cashfree = new Cashfree(
  process.env.CASHFREE_APP_ID,
  process.env.CASHFREE_SECRET_KEY,
  process.env.CASHFREE_ENV === "PRODUCTION"
    ? CFEnvironment.PRODUCTION
    : CFEnvironment.SANDBOX
);

router.post("/create-order", async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const orderRequest = {
      order_amount: amount,
      order_currency: "INR",
      order_id: "order_" + Date.now(),
      customer_details: {
        customer_id: "user_" + Date.now(),
        customer_phone: "9999999999"
      }
    };

    // ✅ Correct method for your version
    const response = await cashfree.PGCreateOrder(orderRequest);

    return res.json({
      payment_session_id: response.data.payment_session_id,
      order_id: orderRequest.order_id
    });

  } catch (error) {
    console.error("Cashfree error:", error.response?.data || error.message);

    return res.status(500).json({
      message: "Order creation failed",
      error: error.response?.data || error.message
    });
  }
});

module.exports = router;