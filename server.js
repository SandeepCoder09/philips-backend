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
   SECURITY HEADERS (Basic Hardening)
============================ */
app.disable("x-powered-by");

/* ============================
   CORS CONFIGURATION
============================ */
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);

/* ============================
   WEBHOOK RAW BODY SUPPORT
   IMPORTANT: Must come BEFORE express.json()
   Only apply to specific route
============================ */
app.use(
  "/api/webhook/cashfree",
  express.raw({ type: "*/*" })
);

/* ============================
   JSON BODY PARSER
============================ */
app.use(express.json({ limit: "1mb" }));

/* ============================
   HEALTH CHECK
============================ */
app.get("/", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "SERVER IS WORKING 🚀",
    timestamp: new Date()
  });
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
app.use("/api/webhook", require("./routes/webhookRoutes"));

/* ============================
   404 HANDLER
============================ */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route Not Found"
  });
});

/* ============================
   GLOBAL ERROR HANDLER
============================ */
app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err);

  res.status(err.status || 500).json({
    success: false,
    message: "Internal Server Error"
  });
});

/* ============================
   START SERVER
============================ */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // Activate earning engine after server starts
  require("./cron/earningEngine");

  console.log("💰 Earning Engine Activated");
});