const errorHandler = (err, req, res, next) => {
  // Generate error ID for tracking
  const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2);

  // Log error internally but don't expose details to client in production
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${errorId}] Error:`, err);
    console.error('Stack:', err.stack);
  } else {
    // In production, log error ID for tracking
    console.error(`[${errorId}] ${err.name || 'Error'}:`, err.message);
    if (err.stack) {
      console.error('Stack trace:', err.stack);
    }
  }

  // Default error
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errorCode = err.errorCode || 'INTERNAL_ERROR';

  // Database errors
  if (err.code === '23505') { // Unique constraint violation
    statusCode = 409;
    message = 'Resource already exists';
    errorCode = 'DUPLICATE_RESOURCE';
  }

  if (err.code === '23503') { // Foreign key constraint violation
    statusCode = 400;
    message = 'Invalid reference - related resource not found';
    errorCode = 'INVALID_REFERENCE';
  }

  if (err.code === '23502') { // Not null violation
    statusCode = 400;
    message = 'Required field missing';
    errorCode = 'MISSING_REQUIRED_FIELD';
  }

  if (err.code === '23514') { // Check constraint violation
    statusCode = 400;
    message = 'Value does not meet requirements';
    errorCode = 'CONSTRAINT_VIOLATION';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    errorCode = 'INVALID_TOKEN';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    errorCode = 'TOKEN_EXPIRED';
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  }

  // Rate limit errors - provide helpful message
  if (statusCode === 429 || errorCode.includes('RATE_LIMIT')) {
    statusCode = 429;
    // Keep the specific rate limit message from the limiter
    if (!message.includes('wait') && !message.includes('try again')) {
      message = 'Too many requests. Please wait a moment before trying again.';
    }
  }

  // In production, don't expose internal error details
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'An unexpected error occurred. Please try again later.';
  }

  // Log the response being sent
  if (statusCode >= 400) {
    console.log(`[${errorId}] Responding with ${statusCode}: ${errorCode} - ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    error_code: errorCode,
    message,
    // Include error ID for support tracking
    ...(statusCode >= 500 && { error_id: errorId }),
    // Only include stack trace in development
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
