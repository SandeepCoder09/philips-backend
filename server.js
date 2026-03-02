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
   CONNECT DATABASE
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
   🔥 CSP DISABLED FOR DEV (Live Server on 5500)
===================================================== */
app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // 🔥 IMPORTANT
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: [
          "'self'",
          "data:",
          "https://philips-backend.onrender.com",
          "https://philipsfuturelighting24.vercel.app"
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
    origin: true,
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
   SERVE FRONTEND (IMPORTANT 🔥)
===================================================== */

app.use(
  express.static(path.join(__dirname, "../philips"))
);

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
app.use("/api/usdt", require("./routes/usdtRoutes"));

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