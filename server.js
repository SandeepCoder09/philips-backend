const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const morgan = require("morgan");

const connectDB = require("./config/db");

dotenv.config();

const app = express();

/* =====================================================
   CONNECT DATABASE
===================================================== */
connectDB();

/* =====================================================
   BASIC SECURITY
===================================================== */
app.disable("x-powered-by");
app.use(helmet());

/* =====================================================
   REQUEST LOGGER
===================================================== */
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

/* =====================================================
   CORS CONFIGURATION
===================================================== */
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* =====================================================
   BODY PARSERS
===================================================== */

// For normal routes
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

/* =====================================================
   HEALTH CHECK
===================================================== */
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "SERVER IS WORKING 🚀",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date(),
  });
});

/* =====================================================
   API ROUTES
===================================================== */

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/referral", require("./routes/referralRoutes"));
app.use("/api/wallet", require("./routes/walletRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/products", require("./routes/products"));
app.use("/api/webhook", require("./routes/webhookRoutes"));
app.use("/api/gift", require("./routes/gift"));

/* =====================================================
   404 HANDLER
===================================================== */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route Not Found",
    path: req.originalUrl,
  });
});

/* =====================================================
   GLOBAL ERROR HANDLER
===================================================== */
app.use((err, req, res, next) => {
  console.error("❌ GLOBAL ERROR:", err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

/* =====================================================
   START SERVER
===================================================== */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("=======================================");
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log("=======================================");

  // Start earning engine safely
  try {
    require("./cron/earningEngine");
    console.log("💰 Earning Engine Activated");
  } catch (error) {
    console.error("⚠ Earning Engine Failed:", error.message);
  }
});