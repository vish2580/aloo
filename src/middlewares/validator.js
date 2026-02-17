const { validationResult, body } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => err.msg);
    return res.status(400).json({
      success: false,
      error_code: 'VALIDATION_FAILED',
      message: 'Validation failed',
      errors: errorMessages,
    });
  }
  
  next();
};

// Sanitize input to prevent XSS and injection attacks
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      // Remove potential XSS patterns
      return obj
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    }
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        obj[key] = sanitize(obj[key]);
      }
    }
    return obj;
  };

  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);
  next();
};

// Validation rules
const validators = {
  // Amount validation (positive number)
  positiveAmount: body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number greater than 0'),

  // Email validation
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email address'),

  // Password validation
  password: body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),

  // Withdrawal password validation
  withdrawalPassword: body('withdrawal_password')
    .isLength({ min: 6 })
    .withMessage('Withdrawal password must be at least 6 characters long'),

  // UUID validation
  uuid: (field) => body(field)
    .isUUID()
    .withMessage(`${field} must be a valid UUID`),

  // Wallet address validation (basic check for crypto addresses)
  walletAddress: body('wallet_address')
    .matches(/^[a-zA-Z0-9]{26,42}$/)
    .withMessage('Invalid wallet address format'),

  // Bet choice validation
  betChoice: body('choice')
    .isIn(['green', 'violet', 'red', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])
    .withMessage('Invalid bet choice'),

  // Red envelope code validation
  redEnvelopeCode: body('code')
    .isLength({ min: 6, max: 20 })
    .withMessage('Red envelope code must be between 6 and 20 characters'),
};

module.exports = {
  validate,
  sanitizeInput,
  validators,
};
