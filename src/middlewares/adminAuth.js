const jwt = require('jsonwebtoken');

/**
 * Admin Authentication Middleware
 * Verifies admin JWT token (separate from user tokens)
 * Does NOT depend on user database or is_admin flag
 */

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'admin_secret_key_change_in_production';

/**
 * Verify admin token only
 * Used for all admin protected routes
 */
const authenticateAdmin = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Admin access token required' 
    });
  }

  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET);
    
    // Verify this is an admin token
    if (!decoded.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid admin token' 
      });
    }

    req.admin = {
      username: decoded.username,
      isAdmin: true
    };
    
    // Also set req.user for controller compatibility
    // Use 'admin' as userId for admin operations
    req.user = {
      userId: 'admin',
      username: decoded.username,
      isAdmin: true
    };
    
    next();

  } catch (err) {
    console.error('Admin token verification failed:', err.message);
    return res.status(403).json({ 
      success: false, 
      message: 'Invalid or expired admin token' 
    });
  }
};

/**
 * Admin Login Handler
 * Validates credentials and returns admin JWT token
 */
const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Get admin credentials from environment
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

    // Validate credentials
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    // Generate admin JWT token
    const token = jwt.sign(
      { 
        username: ADMIN_USERNAME,
        isAdmin: true,
        type: 'admin'
      },
      ADMIN_JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Admin login successful',
      data: {
        token,
        username: ADMIN_USERNAME,
        expiresIn: '24h'
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
};

module.exports = { authenticateAdmin, adminLogin };
