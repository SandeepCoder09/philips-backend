const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

dotenv.config();

const app = express();

/* ============================
   CONNECT DATABASE
============================ */
connectDB();

/* ============================
   CORS CONFIGURATION
============================ */
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* ============================
   WEBHOOK RAW BODY SUPPORT
   (Must be before express.json)
============================ */
app.use(
  "/api/webhook",
  express.raw({ type: "*/*" })
);

/* ============================
   JSON PARSER
============================ */
app.use(express.json());

/* ============================
   HEALTH CHECK
============================ */
app.get("/", (req, res) => {
  res.status(200).json({ message: "SERVER IS WORKING 🚀" });
});

/* ============================
   API ROUTES
============================ */
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/referral", require("./routes/referralRoutes"));
app.use("/api/wallet", require("./routes/walletRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/products", require("./routes/products"));

// 🔐 Webhook Route (Cashfree)
app.use("/api/webhook", require("./routes/webhookRoutes"));

/* ============================
   404 HANDLER
============================ */
app.use((req, res) => {
  res.status(404).json({ message: "Route Not Found" });
});

/* ============================
   GLOBAL ERROR HANDLER
============================ */
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  res.status(500).json({ message: "Internal Server Error" });
});

/* ============================
   START SERVER
============================ */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // Activate earning engine safely
  require("./cron/earningEngine");

  console.log("💰 Earning Engine Activated");
});