require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const errorHandler = require("./middlewares/errorHandler");
const { generalLimiter, adminLimiter } = require("./middlewares/rateLimiter");
const idempotencyMiddleware = require("./middlewares/idempotency");
const { sanitizeInput } = require("./middlewares/validator");
const getGameEngine = require("./services/gameEngine");

// Import routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const walletRoutes = require("./routes/walletRoutes");
const gameRoutes = require("./routes/gameRoutes");
const historyRoutes = require("./routes/historyRoutes");
const referralRoutes = require("./routes/referralRoutes");
const redEnvelopeRoutes = require("./routes/redEnvelopeRoutes");
const rechargeRoutes = require("./routes/rechargeRoutes");
const adminPromotionRoutes = require("./routes/adminPromotionRoutes");
const adminRechargeRoutes = require("./routes/adminRechargeRoutes");
const adminRoutes = require("./routes/adminRoutes");
const configRoutes = require("./routes/configRoutes");
const vipRoutes = require("./routes/vipRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP for static files
  }),
);
app.use(cors());

// Logging
app.use(morgan("combined"));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Input sanitization (before routes)
app.use(sanitizeInput);

// Rate limiting (skip for admin routes and game polling endpoints)
app.use((req, res, next) => {
  if (req.path.startsWith("/api/admin")) {
    return next();
  }
  // Exempt game polling endpoints from rate limiting (needed for countdown)
  if (req.path === "/api/game/current-round" ||
    req.path === "/api/game/results" ||
    req.path === "/api/game/top-winners" ||
    req.path === "/api/game/recent-winners") {
    return next();
  }
  generalLimiter(req, res, next);
});

// Idempotency for critical operations (POST/PUT/PATCH)
app.use("/api/wallet", idempotencyMiddleware());
// REMOVED: app.use("/api/game/bet", idempotencyMiddleware); - This was causing route conflict
app.use("/api/red-envelope/claim", idempotencyMiddleware());

// Health check
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Luxwin Backend API is running",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/referral", referralRoutes);
app.use("/api/red-envelope", redEnvelopeRoutes);
app.use("/api/recharge", rechargeRoutes);
app.use("/api/config", configRoutes);
app.use("/api/vip", vipRoutes);
// Admin routes with separate rate limiter
app.use("/api/admin", adminLimiter);
app.use("/api/admin/promotions", adminPromotionRoutes);
app.use("/api/admin/recharge", adminRechargeRoutes);
app.use("/api/admin", adminRoutes);

// Serve static frontend files
app.use(express.static(path.join(__dirname, "../frontend")));

// Serve index.html for any non-API routes (SPA fallback)
app.get("*", (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith("/api/")) {
    return next();
  }
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// 404 handler for API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Initialize game engine
    const gameEngine = getGameEngine();
    await gameEngine.initialize();

    app.listen(PORT, () => {
      console.log("\n╔════════════════════════════════════════╗");
      console.log("║   🎮 LUXWIN BACKEND SERVER STARTED     ║");
      console.log("╚════════════════════════════════════════╝");
      console.log(`\n🚀 Server running on http://localhost:${PORT}`);
      console.log(`🌐 Frontend available at http://localhost:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`💾 Database: ${process.env.DB_NAME}`);
      console.log(`\n✅ Game engine initialized and running`);
      console.log("\n📡 Available endpoints:");
      console.log("   Auth:");
      console.log("   - POST   /api/auth/register");
      console.log("   - POST   /api/auth/login");
      console.log("   User:");
      console.log("   - GET    /api/user/me");
      console.log("   - GET    /api/user/balance");
      console.log("   - PUT    /api/user/avatar");
      console.log("   Wallet:");
      console.log("   - GET    /api/wallet/balance");
      console.log("   - POST   /api/wallet/add-funds");
      console.log("   - POST   /api/wallet/withdraw");
      console.log("   - GET    /api/wallet/withdrawals");
      console.log("   Game:");
      console.log("   - GET    /api/game/current-round");
      console.log("   - POST   /api/game/bet");
      console.log("   - GET    /api/game/results");
      console.log("   - GET    /api/game/current-bets");
      console.log("   History:");
      console.log("   - GET    /api/history/transactions");
      console.log("   - GET    /api/history/bets");
      console.log("   Referral:");
      console.log("   - GET    /api/referral/info");
      console.log("   - GET    /api/referral/stats");
      console.log("   - GET    /api/referral/commissions");
      console.log("   Red Envelope:");
      console.log("   - POST   /api/red-envelope/claim");
      console.log("   - GET    /api/red-envelope/my-claims");
      console.log("   Admin:");
      console.log("   - POST   /api/admin/promotions/red-envelopes");
      console.log("   - GET    /api/admin/promotions/red-envelopes");
      console.log("   - PUT    /api/admin/promotions/commission-rates");
      console.log("   - PUT    /api/admin/promotions/first-recharge-bonus");
      console.log("\n════════════════════════════════════════\n");
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
