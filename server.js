const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const morgan = require("morgan");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const connectDB = require("./config/db");

dotenv.config();

const app = express();

/* =====================================================
   CONNECT DATA
===================================================== */
connectDB();

/* =====================================================
   CREATE HTTP SERVER
===================================================== */
const server = http.createServer(app);

/* =====================================================
   GLOBAL CORS
===================================================== */
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);



/* =====================================================
   BASIC SECURITY (Helmet)
===================================================== */
app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: [
          "'self'",
          "http://10.194.154.223:*",
          "http://localhost:*"
        ],
        connectSrc: [
          "'self'",
          "http://10.194.154.223:*",
          "http://localhost:*",
          "https://philips-backend.onrender.com"
        ],
        imgSrc: [
          "'self'",
          "data:",
          "http://localhost:5001",
          "https://philips-backend.onrender.com",
          "https://philipsfuturelighting24.vercel.app",
          "https://bright24futurelighting.com"
        ],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"]
      }
    }
  })
);

/* =====================================================
   SERVE UPLOADS FOLDER
===================================================== */
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

/* =====================================================
   SOCKET.IO SETUP
===================================================== */
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5500",
      "http://10.194.154.223",
      "http://10.194.154.223:5500",
      "https://philipsfuturelighting24.vercel.app",
      "https://bright24futurelighting.com"
    ],
    credentials: true
  },
  transports: ["websocket", "polling"]
});


app.set("io", io);

/* =====================================================
   SOCKET CONNECTION HANDLER
===================================================== */
io.on("connection", (socket) => {

  console.log("🟢 Socket Connected:", socket.id);


  socket.on("join_user_room", (userId) => {
    if (!userId) return;
    socket.join(userId.toString());
  });


  socket.on("join_admin_room", () => {
    socket.join("admin_room");
  });

  socket.on("disconnect", () => {
    console.log("🔴 Socket Disconnected:", socket.id);
  });
});



/* =====================================================
   REQUEST LOGGER
===================================================== */
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

/* =====================================================
   CASHFREE WEBHOOK (RAW BODY FIRST)
===================================================== */
const webhookRoutes = require("./routes/webhookRoutes");

app.use(
  "/api/webhook",
  express.raw({ type: "application/json" }),
  webhookRoutes
);

/* =====================================================
   BODY PARSERS (AFTER WEBHOOK)
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
   PING ROUTE
===================================================== */

app.get("/ping", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server awake",
    uptime: process.uptime(),
    timestamp: new Date()
  });
});

app.get("/health", async (req, res) => {
  try {
    const mongoose = require("mongoose");

    res.json({
      status: "ok",
      uptime: process.uptime(),
      database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      memory: process.memoryUsage(),
      timestamp: new Date()
    });
  } catch (err) {
    res.status(500).json({ status: "error" });
  }
});

/* =====================================================
   SERVE FRONTEND
===================================================== */

const frontendPath = path.join(__dirname, "../philips");

if (require("fs").existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
}

/* =====================================================
   RATE LIMITER
===================================================== */
const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500
});

app.use("/api", limiter);

/* =====================================================
   API ROUTES
===================================================== */
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/referral", require("./routes/referralRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/products", require("./routes/products"));
app.use("/api/gift", require("./routes/gift"));
app.use("/api/wallet", require("./routes/walletRoutes"));
app.use("/api/usdt", require("./routes/usdtRoutes"));
app.use("/api/upload", require("./routes/uploadRoutes"));

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
const PORT = process.env.PORT || 5001;

server.listen(PORT, "0.0.0.0", () => {
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

process.on("SIGINT", () => {
  console.log("🛑 Shutting down server...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("🛑 Server terminated");
  process.exit(0);
});