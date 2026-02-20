const express = require("express");
const path = require("path");
const connectDB = require("./config/db");
const cors = require("cors");
require("dotenv").config();

const app = express();

// ============================
// Connect Database
// ============================
connectDB();

// ============================
// Middleware
// ============================
app.use(express.json());

app.use(
  cors({
    origin: "*", // allow all origins (can restrict later)
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// ============================
// Health Check Route
// ============================
app.get("/", (req, res) => {
  res.send("SERVER IS WORKING");
});

// ============================
// API Routes
// ============================
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/referral", require("./routes/referralRoutes"));
app.use("/api/wallet", require("./routes/walletRoutes")); // ✅ THIS WAS MISSING

// ============================
// Serve Frontend (Optional)
// ============================
app.use(express.static(path.join(__dirname, "../")));

// ============================
// Start Server
// ============================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});