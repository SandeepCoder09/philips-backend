const express = require("express");
const path = require("path");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");

const app = express();

/* ============================
   CONNECT DATABASE
============================ */
connectDB();

/* ============================
   MIDDLEWARE
============================ */

// Parse JSON
app.use(express.json());

// CORS Configuration
app.use(
  cors({
    origin: "*", // 🔒 change to frontend URL in production
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

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
app.use("/api/products", require("./routes/products")); // ✅ NEW

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
});