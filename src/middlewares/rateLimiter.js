const rateLimit = require('express-rate-limit');

// Key generator: Use both IP and user ID for authenticated requests
const keyGenerator = (req) => {
  const ip = req.ip || req.connection.remoteAddress;
  const userId = req.user?.userId || 'anonymous';
  return `${ip}-${userId}`;
};

// General API rate limiter (increased for normal usage patterns)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Increased from 100 to 300 to allow normal app usage without hitting limits
  keyGenerator,
  message: {
    success: false,
    error_code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

// Auth endpoints rate limiter (balanced for security and UX)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Increased from 10 to 15 to allow for legitimate usage
  keyGenerator: (req) => req.ip || req.connection.remoteAddress, // IP only for auth
  message: {
    success: false,
    error_code: 'AUTH_RATE_LIMIT',
    message: 'Too many login attempts. Please wait 15 minutes before trying again.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed requests to prevent legitimate use from being blocked
  skipFailedRequests: false, // Count failed requests too (prevents brute force)
});

// Registration rate limiter (prevents spam signups)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Increased from 5 to 10 to allow for form errors and typos
  keyGenerator: (req) => req.ip || req.connection.remoteAddress,
  message: {
    success: false,
    error_code: 'REGISTER_RATE_LIMIT',
    message: 'Too many registration attempts. Please wait 1 hour before trying again.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed/duplicate attempts
  skipFailedRequests: false,
});

// Betting rate limiter (prevent spam betting)
const betLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Increased from 15 to 20 for better UX
  keyGenerator,
  message: {
    success: false,
    error_code: 'BET_RATE_LIMIT',
    message: 'Too many bet requests. Please wait a moment before placing another bet.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

// Withdrawal rate limiter
const withdrawalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  keyGenerator,
  message: {
    success: false,
    error_code: 'WITHDRAWAL_RATE_LIMIT',
    message: 'Too many withdrawal requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Red envelope rate limiter
const redEnvelopeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  keyGenerator,
  message: {
    success: false,
    error_code: 'RED_ENVELOPE_RATE_LIMIT',
    message: 'Too many red envelope claims, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin login rate limiter (more lenient for admin panel)
const adminLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50, // Increased to 50 requests per minute for admin operations
  keyGenerator: (req) => req.ip || req.connection.remoteAddress,
  message: {
    success: false,
    error_code: 'ADMIN_RATE_LIMIT',
    message: 'Too many admin requests, please try again in a minute.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skip: (req) => {
    // Skip rate limiting in development
    return process.env.NODE_ENV === 'development';
  }
});

module.exports = {
  generalLimiter,
  authLimiter,
  registerLimiter,
  betLimiter,
  withdrawalLimiter,
  redEnvelopeLimiter,
  adminLimiter,
};
