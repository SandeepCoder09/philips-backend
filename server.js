const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const morgan = require("morgan");
const http = require("http");
const { Server } = require("socket.io");

const connectDB = require("./config/db");

dotenv.config();

const app = express();

/* =====================================================
   CONNECT DATABASE
===================================================== */
connectDB();

/* =====================================================
   CREATE HTTP SERVER
===================================================== */
const server = http.createServer(app);

/* =====================================================
   ALLOWED ORIGINS (VERY IMPORTANT)
===================================================== */
const allowedOrigins = [
  "https://philipsfuturelighting24.vercel.app",
  "http://localhost:3000",
  "http://localhost:5500"
];

/* =====================================================
   SOCKET.IO SETUP
===================================================== */

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Make io available in routes
app.set("io", io);

/* =====================================================
   SOCKET CONNECTION HANDLER
===================================================== */
io.on("connection", (socket) => {

  console.log("🟢 Socket Connected:", socket.id);

  /* ===============================
     USER ROOM JOIN (FOR LIVE WALLET)
  =============================== */
  socket.on("join_user_room", (userId) => {
    if (!userId) return;

    socket.join(userId.toString());
    console.log(`👤 User joined room: ${userId}`);
  });

  /* ===============================
     ADMIN ROOM (OPTIONAL)
  =============================== */
  socket.on("join_admin_room", () => {
    socket.join("admin_room");
    console.log("👑 Admin joined admin room");
  });

  socket.on("disconnect", () => {
    console.log("🔴 Socket Disconnected:", socket.id);
  });
});

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
   CORS CONFIGURATION (FIXED PROPERLY)
===================================================== */
/* =====================================================
   CORS CONFIGURATION (FINAL STABLE VERSION)
===================================================== */

app.use(
  cors({
    origin: function (origin, callback) {

      // Allow Postman / server-to-server / mobile
      if (!origin) return callback(null, true);

      // Allow any Vercel deployment
      if (origin.includes("vercel.app")) {
        return callback(null, true);
      }

      // Allow localhost
      if (
        origin.includes("localhost") ||
        origin.includes("127.0.0.1")
      ) {
        return callback(null, true);
      }

      // Otherwise block silently (NOT throw error)
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

/* =====================================================
   BODY PARSERS
===================================================== */
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
  console.error("❌ GLOBAL ERROR:", err.stack || err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

/* =====================================================
   START SERVER
===================================================== */
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("=======================================");
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log("=======================================");

  try {
    require("./cron/earningEngine");
    console.log("💰 Earning Engine Activated");
  } catch (error) {
    console.error("⚠ Earning Engine Failed:", error.message);
  }
});