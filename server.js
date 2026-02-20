const express = require("express");
const path = require("path");
const connectDB = require("./config/db");
const cors = require("cors");   // ✅ ADD THIS
require("dotenv").config();

const app = express();

// Connect Database
connectDB();

// ✅ CORS FIX
app.use(cors({
  origin: "*",   // allow all origins (for now)
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

// Middleware
app.use(express.json());

app.get("/", (req, res) => {
  res.send("SERVER IS WORKING");
});

// API Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/referral", require("./routes/referralRoutes"));

// Serve Frontend
app.use(express.static(path.join(__dirname, "../")));

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));