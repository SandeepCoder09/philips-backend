const express = require("express");
const router = express.Router();
const axios = require("axios");

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

    const response = await axios.post(
      "https://api.cashfree.com/pg/orders",
      orderRequest,
      {
        headers: {
          "x-client-id": process.env.CASHFREE_APP_ID,
          "x-client-secret": process.env.CASHFREE_SECRET_KEY,
          "x-api-version": "2023-08-01",
          "Content-Type": "application/json"
        }
      }
    );

    return res.json({
      payment_session_id: response.data.payment_session_id,
      order_id: response.data.order_id
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