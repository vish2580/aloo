// ========================================
// PRODUCTION-GRADE AUTHENTICATION MANAGER
// ========================================
// Clean state machine for Login, Register, and Logout
// Ensures one user action = exactly one API request
// Zero race conditions, zero duplicate requests

const AuthState = {
  IDLE: 'idle',
  LOADING: 'loading',
  AUTHENTICATED: 'authenticated',
  UNAUTHENTICATED: 'unauthenticated',
  ERROR: 'error'
};

class AuthManager {
  constructor(apiBaseUrl) {
    this.apiBaseUrl = apiBaseUrl;

    // Single source of truth for auth state
    this.state = AuthState.UNAUTHENTICATED;

    // Action-specific locks to prevent double submissions
    this.actionLocks = {
      login: false,
      register: false,
      logout: false
    };

    // Current user and token
    this.currentUser = null;
    this.currentToken = null;

    // Active request controllers for cancellation
    this.abortControllers = new Map();

    // Event listeners for state changes
    this.listeners = {
      stateChange: [],
      login: [],
      logout: [],
      error: []
    };

    // Initialize from localStorage
    this._initializeFromStorage();
  }

  // ========================================
  // INITIALIZATION
  // ========================================

  _initializeFromStorage() {
    const token = localStorage.getItem('token');

    if (token && !this._isTokenExpired(token)) {
      this.currentToken = token;
      this.state = AuthState.AUTHENTICATED;
    } else {
      this._clearAuth();
    }
  }

  _isTokenExpired(token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch (e) {
      return true;
    }
  }

  // ========================================
  // STATE MANAGEMENT
  // ========================================

  getState() {
    return this.state;
  }

  isAuthenticated() {
    return this.state === AuthState.AUTHENTICATED &&
      this.currentToken &&
      !this._isTokenExpired(this.currentToken);
  }

  isLoading() {
    return this.state === AuthState.LOADING;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getToken() {
    return this.currentToken;
  }

  _setState(newState) {
    const oldState = this.state;
    this.state = newState;

    if (oldState !== newState) {
      this._notifyListeners('stateChange', { oldState, newState });
    }
  }

  // ========================================
  // EVENT SYSTEM
  // ========================================

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  _notifyListeners(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[AuthManager] Listener error for ${event}:`, error);
        }
      });
    }
  }

  // ========================================
  // REQUEST HANDLER
  // ========================================

  async _makeRequest(endpoint, options = {}, actionType = null) {
    // Create abort controller for this request
    const abortController = new AbortController();
    const requestId = actionType || `request_${Date.now()}`;

    this.abortControllers.set(requestId, abortController);

    // Set timeout based on request type
    // Auth requests get 60s, others get 30s
    const timeoutMs = (actionType === 'login' || actionType === 'register') ? 60000 : 30000;

    // Auto-abort after timeout
    const timeoutId = setTimeout(() => {
      console.warn(`[AuthManager] Request ${requestId} timed out after ${timeoutMs}ms`);
      abortController.abort();
    }, timeoutMs);

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };

      // Add auth token if available
      if (this.currentToken) {
        headers['Authorization'] = `Bearer ${this.currentToken}`;
      }

      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: abortController.signal
      });

      // Clear timeout on successful response
      clearTimeout(timeoutId);

      // Clean up abort controller
      this.abortControllers.delete(requestId);

      // Handle response
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        // Handle specific error codes
        if (response.status === 401) {
          // Token expired or invalid
          if (this.state === AuthState.AUTHENTICATED) {
            this._clearAuth();
            this._notifyListeners('error', {
              type: 'session_expired',
              message: 'Session expired. Please login again.'
            });
          }
          throw new Error('Unauthorized');
        }

        if (response.status === 429) {
          throw new Error(data.message || 'Too many requests. Please wait a moment.');
        }

        if (response.status === 409) {
          throw new Error(data.message || 'Conflict error');
        }

        throw new Error(data.message || data.error || `Request failed (${response.status})`);
      }

      return await response.json();
    } catch (error) {
      // Clear timeout on error
      clearTimeout(timeoutId);

      // Clean up abort controller
      this.abortControllers.delete(requestId);

      // Handle timeout/abort
      if (error.name === 'AbortError') {
        console.log(`[AuthManager] Request ${requestId} was cancelled or timed out`);
        throw new Error('Request timed out. Please check your connection and try again.');
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error. Please check your connection.');
      }

      throw error;
    }
  }

  _cancelAllRequests() {
    console.log('[AuthManager] Cancelling all active requests');
    this.abortControllers.forEach((controller, id) => {
      controller.abort();
    });
    this.abortControllers.clear();
  }

  // ========================================
  // REGISTER
  // ========================================

  async register({ email, password, withdrawalPassword, whatsapp, country = 'India', referralCode = null }) {
    // Guard: Check if already loading
    if (this.actionLocks.register) {
      console.log('[AuthManager] Register already in progress');
      return { success: false, error: 'Registration already in progress' };
    }

    // Validate inputs
    if (!email || !password || !withdrawalPassword || !whatsapp) {
      return { success: false, error: 'All fields are required' };
    }

    if (!email.includes('@')) {
      return { success: false, error: 'Invalid email address' };
    }

    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    if (withdrawalPassword.length !== 6 || isNaN(withdrawalPassword)) {
      return { success: false, error: 'Withdrawal PIN must be exactly 6 digits' };
    }

    // Set lock and state
    this.actionLocks.register = true;
    this._setState(AuthState.LOADING);

    try {
      const body = {
        email,
        password,
        withdrawal_password: withdrawalPassword,
        whatsapp,
        country
      };

      if (referralCode) {
        body.referral_code = referralCode;
      }

      const response = await this._makeRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(body)
      }, 'register');

      if (!response) {
        // Request was cancelled
        return { success: false, error: 'Request cancelled' };
      }

      // Store token
      this.currentToken = response.data.token;
      this.currentUser = response.data.user;
      localStorage.setItem('token', this.currentToken);

      // Update state
      this._setState(AuthState.AUTHENTICATED);

      // Notify listeners
      this._notifyListeners('login', { user: this.currentUser });

      console.log('[AuthManager] Registration successful');

      return {
        success: true,
        message: response.message || 'Registration successful',
        user: this.currentUser
      };

    } catch (error) {
      console.error('[AuthManager] Registration error:', error.message);

      this._setState(AuthState.UNAUTHENTICATED);
      this._notifyListeners('error', {
        type: 'register',
        message: error.message
      });

      return {
        success: false,
        error: error.message || 'Registration failed'
      };

    } finally {
      this.actionLocks.register = false;
    }
  }

  // ========================================
  // LOGIN
  // ========================================

  async login({ email, password }) {
    // Guard: Check if already loading
    if (this.actionLocks.login) {
      console.log('[AuthManager] Login already in progress');
      return { success: false, error: 'Login already in progress' };
    }

    // Validate inputs
    if (!email || !password) {
      return { success: false, error: 'Email and password are required' };
    }

    if (!email.includes('@')) {
      return { success: false, error: 'Invalid email address' };
    }

    // Set lock and state
    this.actionLocks.login = true;
    this._setState(AuthState.LOADING);

    try {
      const response = await this._makeRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      }, 'login');

      if (!response) {
        // Request was cancelled
        return { success: false, error: 'Request cancelled' };
      }

      // Store token
      this.currentToken = response.data.token;
      this.currentUser = response.data.user;
      localStorage.setItem('token', this.currentToken);

      // Update state
      this._setState(AuthState.AUTHENTICATED);

      // Notify listeners
      this._notifyListeners('login', { user: this.currentUser });

      console.log('[AuthManager] Login successful');

      return {
        success: true,
        message: response.message || 'Login successful',
        user: this.currentUser
      };

    } catch (error) {
      console.error('[AuthManager] Login error:', error.message);

      this._setState(AuthState.UNAUTHENTICATED);
      this._notifyListeners('error', {
        type: 'login',
        message: error.message
      });

      return {
        success: false,
        error: error.message || 'Login failed'
      };

    } finally {
      this.actionLocks.login = false;
    }
  }

  // ========================================
  // LOGOUT
  // ========================================

  logout(showMessage = true) {
    // Guard: Check if already logging out
    if (this.actionLocks.logout) {
      console.log('[AuthManager] Logout already in progress');
      return { success: false, error: 'Logout already in progress' };
    }

    // Set lock immediately
    this.actionLocks.logout = true;

    try {
      console.log('[AuthManager] Starting logout...');

      // Cancel all active requests
      this._cancelAllRequests();

      // Clear authentication
      this._clearAuth();

      // Notify listeners
      this._notifyListeners('logout', { showMessage });

      console.log('[AuthManager] Logout complete');

      return {
        success: true,
        message: showMessage ? 'Logged out successfully' : ''
      };

    } finally {
      // Always release the lock
      this.actionLocks.logout = false;
    }
  }

  _clearAuth() {
    // Clear storage
    localStorage.removeItem('token');
    sessionStorage.clear();

    // Clear state
    this.currentToken = null;
    this.currentUser = null;
    this._setState(AuthState.UNAUTHENTICATED);

    console.log('[AuthManager] Auth state cleared');
  }

  // ========================================
  // SESSION MANAGEMENT
  // ========================================

  checkSession() {
    if (!this.currentToken) {
      this._clearAuth();
      return false;
    }

    if (this._isTokenExpired(this.currentToken)) {
      console.log('[AuthManager] Token expired');
      this._clearAuth();
      this._notifyListeners('error', {
        type: 'session_expired',
        message: 'Session expired. Please login again.'
      });
      return false;
    }

    return true;
  }

  // ========================================
  // AUTHENTICATED REQUESTS
  // ========================================

  async makeAuthenticatedRequest(endpoint, options = {}) {
    // Check authentication
    if (!this.checkSession()) {
      throw new Error('Not authenticated');
    }

    // Make request with current token
    return this._makeRequest(endpoint, options);
  }
}

// Export singleton instance
// Will be initialized in app.js
let authManagerInstance = null;

function initAuthManager(apiBaseUrl) {
  if (!authManagerInstance) {
    authManagerInstance = new AuthManager(apiBaseUrl);
  }
  return authManagerInstance;
}

function getAuthManager() {
  if (!authManagerInstance) {
    throw new Error('AuthManager not initialized. Call initAuthManager() first.');
  }
  return authManagerInstance;
}

// Export to global scope for browser use
window.AuthManager = AuthManager;
window.initAuthManager = initAuthManager;
window.getAuthManager = getAuthManager;
