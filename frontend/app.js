// ========== API CONFIGURATION ==========
const API_BASE_URL = "http://localhost:5000/api";

// Initialize AuthManager (production-grade authentication)
let authManager = null;

// Game state
let currentUser = null;
let currentBalance = 0;
let currentRound = null;
let selectedBetType = null;
let selectedBetValue = null;
let requestInProgress = false;
let betPlacedThisRound = false;
let countdownInterval = null;
let liveWinnersInterval = null;
let topEarnersInterval = null;
let betModalOpen = false;

// ========== MINI RESULT HISTORY STATE ==========
let miniResultCurrentPage = 1;
let miniResultPerPage = 10;
let miniResultTotalData = [];

// ========== UTILITY FUNCTIONS ==========
function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ========== CHECK IF LOGGED IN ==========
function isLoggedIn() {
  return authManager && authManager.isAuthenticated();
}

// ========== BOTTOM NAV HANDLER ==========
function handleNavClick(tab) {
  // Update active state on bottom nav
  const navItems = document.querySelectorAll("#global-bottom-nav .nav-item");
  navItems.forEach((item) => item.classList.remove("active"));

  if (tab === "home") {
    // Home ALWAYS shows game - no login required to VIEW
    navItems[1].classList.add("active");
    navigateTo("home-screen");
  } else if (tab === "account") {
    navItems[2].classList.add("active");
    if (isLoggedIn()) {
      navigateTo("account-screen");
    } else {
      // Show login for Account tab only
      navigateTo("login-screen");
    }
  } else if (tab === "fun") {
    // Fun page ALWAYS visible - no login required to VIEW
    navItems[0].classList.add("active");
    navigateTo("fun-screen");
  }
}

// ========== PENDING REDIRECT FOR AUTH ==========
let pendingRedirect = null;

// ========== FUN CARD CLICK HANDLER ==========
function handleFunCardClick(targetScreen, actionName) {
  // Leaderboard is read-only - no login required
  if (targetScreen === "leaderboard-screen") {
    navigateTo(targetScreen);
    return;
  }

  // Home screen is always accessible
  if (targetScreen === "home-screen") {
    navigateTo(targetScreen);
    return;
  }

  // All other cards require login
  if (isLoggedIn()) {
    navigateTo(targetScreen);
  } else {
    // Store pending redirect and show login modal
    pendingRedirect = targetScreen;
    showLoginModal(actionName);
  }
}

// ========== LOGIN FROM MODAL (with redirect) ==========
function handleLoginFromModal() {
  // Preserve pendingRedirect - don't call closeLoginModal which clears it
  const modal = document.getElementById("login-modal");
  if (modal) {
    modal.classList.remove("active");
  }
  navigateTo("login-screen");
}

function handleSignupFromModal() {
  // Preserve pendingRedirect - don't call closeLoginModal which clears it
  const modal = document.getElementById("login-modal");
  if (modal) {
    modal.classList.remove("active");
  }
  navigateTo("register-screen");
}

// ========== UPDATE BOTTOM NAV STATE ==========
function updateBottomNavState(screenId) {
  const navItems = document.querySelectorAll("#global-bottom-nav .nav-item");
  if (!navItems.length) return;

  navItems.forEach((item) => item.classList.remove("active"));

  if (screenId === "home-screen") {
    navItems[1].classList.add("active");
  } else if (
    screenId === "account-screen" ||
    screenId === "wallet-screen" ||
    screenId === "add-funds-screen" ||
    screenId === "withdraw-screen" ||
    screenId === "transactions-screen" ||
    screenId === "bet-history-screen" ||
    screenId === "security-screen" ||
    screenId === "support-screen" ||
    screenId === "login-screen" ||
    screenId === "register-screen" ||
    screenId === "forgot-password-screen"
  ) {
    navItems[2].classList.add("active");
  } else if (
    screenId === "fun-screen" ||
    screenId === "promotions-screen" ||
    screenId === "red-envelope-screen" ||
    screenId === "vip-screen" ||
    screenId === "offers-screen" ||
    screenId === "leaderboard-screen"
  ) {
    navItems[0].classList.add("active");
  } else {
    navItems[1].classList.add("active");
  }
}

// ========== AUTH GUARD ==========
// Only checks if user is logged in, does NOT redirect
function checkAuth() {
  if (!authManager) {
    return false;
  }

  return authManager.checkSession();
}

// ========== REQUIRE AUTH FOR ACTION ==========
// Shows login modal when action requires authentication
function requireAuthForAction(actionName) {
  if (isLoggedIn()) {
    return true;
  }
  showLoginModal(actionName);
  return false;
}

// ========== SHOW LOGIN MODAL ==========
function showLoginModal(actionName) {
  const modal = document.getElementById("login-modal");
  if (modal) {
    const actionText = modal.querySelector(".modal-action-text");
    if (actionText) {
      actionText.textContent = actionName || "continue";
    }
    modal.classList.add("active");
  } else {
    // Fallback if modal doesn't exist
    showNotification(
      "Please Login or Sign Up to " + (actionName || "continue"),
    );
  }
}

function closeLoginModal() {
  const modal = document.getElementById("login-modal");
  if (modal) {
    modal.classList.remove("active");
  }
  // Clear pending redirect when modal is closed without action
  pendingRedirect = null;
}

// Token expiration check moved to AuthManager

// ========== API WRAPPER ==========
async function apiRequest(endpoint, options = {}) {
  console.log("[API REQUEST] Called with endpoint:", endpoint);
  console.log("[API REQUEST] Options:", options);
  console.log("[API REQUEST] Is authenticated:", authManager && authManager.isAuthenticated());

  // Use AuthManager for authenticated requests
  if (authManager && authManager.isAuthenticated()) {
    try {
      console.log("[API REQUEST] Using AuthManager for authenticated request");
      const result = await authManager.makeAuthenticatedRequest(endpoint, options);
      console.log("[API REQUEST] AuthManager request completed successfully");
      return result;
    } catch (error) {
      console.error("[API REQUEST] AuthManager request failed:", error);
      if (error.message !== "Unauthorized") {
        showNotification(error.message || "Request failed. Please try again.");
      }
      throw error;
    }
  }

  // Unauthenticated request
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 429) {
        const data = await response.json().catch(() => ({}));
        const message = data.message || "Too many requests. Please wait a moment and try again.";
        showNotification(message);
        throw new Error("Rate limited");
      }

      const data = await response.json().catch(() => ({}));
      const errorMessage = data.message || data.error || "Request failed";
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    if (error.message !== "Rate limited") {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        showNotification("Network error. Please check your connection.");
      } else {
        showNotification(error.message || "Request failed. Please try again.");
      }
    }
    throw error;
  }
}

// ========== AUTHENTICATION ==========
async function handleRegister(event) {
  // Prevent default form submission
  if (event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  const form = document.querySelector("#register-screen form");
  const email = form.querySelector('input[type="email"]').value.trim();
  const password = form.querySelector('input[type="password"]').value;
  const withdrawalPassword = form.querySelector(
    'input[placeholder="Withdrawal Password"]',
  ).value;
  const whatsapp = form.querySelector('input[type="tel"]').value.trim();
  const privacyCheckbox = form.querySelector('input[type="checkbox"]');
  const country = form.querySelector('input[name="country"]')?.value || "India";

  // Validate privacy checkbox
  if (!privacyCheckbox || !privacyCheckbox.checked) {
    showNotification("Please agree to the Privacy Policy");
    return;
  }

  // Disable form
  const submitBtn = form.querySelector('button[type="submit"]');
  const inputs = form.querySelectorAll('input, select, button');

  if (submitBtn) submitBtn.disabled = true;
  inputs.forEach(input => input.disabled = true);

  showLoading();

  try {
    // Use AuthManager for registration
    const result = await authManager.register({
      email,
      password,
      withdrawalPassword,
      whatsapp,
      country
    });

    if (result.success) {
      showNotification(result.message || "Registration successful!");
      form.reset();

      // Load user data ONCE
      await loadUserData();

      // Navigate to home (won't load data again due to guard)
      const redirect = pendingRedirect;
      pendingRedirect = null;
      navigateTo(redirect || "home-screen");
    } else {
      showNotification(result.error || "Registration failed");
    }
  } catch (error) {
    console.error("Registration error:", error);
    showNotification(error.message || "Registration failed");
  } finally {
    hideLoading();

    // Re-enable form
    if (submitBtn) submitBtn.disabled = false;
    inputs.forEach(input => input.disabled = false);
  }
}

async function handleLogin(event) {
  // Prevent default form submission
  if (event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  const form = document.querySelector("#login-screen form");
  const email = form.querySelector('input[type="email"]').value.trim();
  const password = form.querySelector('input[type="password"]').value;

  // Disable form
  const submitBtn = form.querySelector('button[type="submit"]');
  const inputs = form.querySelectorAll('input, button');

  if (submitBtn) submitBtn.disabled = true;
  inputs.forEach(input => input.disabled = true);

  showLoading();

  try {
    // Use AuthManager for login
    const result = await authManager.login({ email, password });

    if (result.success) {
      showNotification(result.message || "Login successful!");
      form.reset();

      // Load user data ONCE
      await loadUserData();

      // Navigate to home (won't load data again due to guard)
      const redirect = pendingRedirect;
      pendingRedirect = null;
      navigateTo(redirect || "home-screen");
    } else {
      showNotification(result.error || "Login failed");
    }
  } catch (error) {
    console.error("Login error:", error);
    showNotification(error.message || "Login failed");
  } finally {
    hideLoading();

    // Re-enable form
    if (submitBtn) submitBtn.disabled = false;
    inputs.forEach(input => input.disabled = false);
  }
}

function handleLogout(showMessage = true) {
  console.log("[APP] Logout requested");

  // Clear all intervals
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  if (liveWinnersInterval) {
    clearInterval(liveWinnersInterval);
    liveWinnersInterval = null;
  }
  if (topEarnersInterval) {
    clearInterval(topEarnersInterval);
    topEarnersInterval = null;
  }

  // Reset game state
  currentUser = null;
  currentBalance = 0;
  currentRound = null;
  selectedBetType = null;
  selectedBetValue = null;
  betPlacedThisRound = false;
  requestInProgress = false;
  pendingRedirect = null;

  // Use AuthManager for logout
  const result = authManager.logout(showMessage);

  if (result.success && result.message) {
    showNotification(result.message);
  }

  // Navigate to login screen
  navigateTo("login-screen");

  console.log("[APP] Logout complete");
}

// ========== FORGOT PASSWORD ==========
async function handleForgotPassword(event) {
  // Prevent default form submission
  if (event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  const form = document.querySelector("#forgot-password-screen form");
  const email = form.querySelector('input[type="email"]').value.trim();

  // Basic validation
  if (!email) {
    showNotification("Please enter your email address");
    return;
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showNotification("Please enter a valid email address");
    return;
  }

  // Disable form
  const submitBtn = form.querySelector('button[type="submit"]');
  const inputs = form.querySelectorAll('input, button');

  if (submitBtn) submitBtn.disabled = true;
  inputs.forEach(input => input.disabled = true);

  showLoading();

  try {
    // Call forgot password API
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Show clear success message
      showNotification("✅ Reset link sent! Check your email inbox.");

      // Clear form
      form.reset();

      // Navigate back to login after 2 seconds
      setTimeout(() => {
        navigateTo('login-screen');
      }, 2000);
    } else {
      // Even on error, show same message for security
      showNotification("✅ Reset link sent! Check your email inbox.");
    }
  } catch (error) {
    console.error("Forgot password error:", error);
    // Show friendly message even on error for security
    showNotification("✅ Reset link sent! Check your email inbox.");
  } finally {
    hideLoading();

    // Re-enable form
    if (submitBtn) submitBtn.disabled = false;
    inputs.forEach(input => input.disabled = false);
  }
}

// ========== USER DATA ==========
let userDataLoading = false;
let lastUserDataLoad = 0;

async function loadUserData() {
  if (!checkAuth()) return;

  // Prevent duplicate calls within 2 seconds
  const now = Date.now();
  if (userDataLoading || (now - lastUserDataLoad < 2000)) {
    console.log("[USER DATA] Skipping duplicate load request");
    return;
  }

  userDataLoading = true;
  lastUserDataLoad = now;

  try {
    const userData = await apiRequest("/user/me");
    currentUser = userData.data;

    // Balance comes from /user/balance which reads from users.main_balance (single source of truth)
    const balanceData = await apiRequest("/user/balance");
    const newBalance = parseFloat(balanceData.data.main_balance) || 0;

    console.log("[BALANCE] API returned:", newBalance);
    currentBalance = newBalance;

    // Update all UI elements
    updateUIWithUserData();
    updateAllBalanceDisplays();

    console.log("[BALANCE] Synced to:", currentBalance);
  } catch (error) {
    console.error("Failed to load user data:", error);
    if (error.message !== "Unauthorized") {
      showNotification("Failed to load user data");
    }
  } finally {
    userDataLoading = false;
  }
}

function updateUIWithUserData() {
  if (!currentUser) {
    console.warn("updateUIWithUserData: currentUser is null");
    return;
  }

  console.log("Updating UI with balance:", currentBalance);

  const emailElements = document.querySelectorAll(".email");
  emailElements.forEach((el) => {
    const email = currentUser.email;
    el.textContent =
      email.substring(0, 4) + "***" + email.substring(email.indexOf("@"));
  });

  // Update UID display
  const uidElement = document.getElementById("userUid");
  if (uidElement && currentUser.uid) {
    uidElement.textContent = `UID: ${currentUser.uid}`;
  }

  const balanceElements = document.querySelectorAll(".balance-amount");
  console.log("Found", balanceElements.length, ".balance-amount elements");
  balanceElements.forEach((el) => {
    el.textContent = `$${currentBalance.toFixed(2)}`;
    console.log("Updated .balance-amount to:", el.textContent);
  });

  const walletBalanceElements = document.querySelectorAll(".wallet-balance");
  console.log(
    "Found",
    walletBalanceElements.length,
    ".wallet-balance elements",
  );
  walletBalanceElements.forEach((el) => {
    el.textContent = `$${currentBalance.toFixed(2)}`;
    console.log("Updated .wallet-balance to:", el.textContent);
  });

  // Update home page balance card
  const balanceValueElements = document.querySelectorAll(".balance-value");
  console.log("Found", balanceValueElements.length, ".balance-value elements");
  balanceValueElements.forEach((el) => {
    const newValue = `$${Math.floor(currentBalance).toLocaleString()}`;
    el.textContent = newValue;
    console.log("Updated .balance-value to:", newValue);
  });

  // Country is now handled by updateAccountCountry() with proper flag+code display
}

// ========== INSTANT BALANCE UPDATE (from backend response) ==========
function updateAllBalanceDisplays() {
  // Update ALL balance elements on ALL pages with current balance value
  // This uses the single source of truth: currentBalance (from backend)
  console.log("[BALANCE SYNC] Updating all displays to:", currentBalance);

  const formattedBalance = `$${currentBalance.toFixed(2)}`;
  const formattedBalanceWhole = `$${Math.floor(currentBalance).toLocaleString()}`;

  // Game page balance
  document.querySelectorAll(".balance-amount").forEach((el) => {
    el.textContent = formattedBalance;
  });

  // Wallet page balance (Total Balance)
  document.querySelectorAll(".wallet-balance-amount").forEach((el) => {
    el.textContent = formattedBalance;
  });

  // Home page balance card
  document.querySelectorAll(".balance-value").forEach((el) => {
    el.textContent = formattedBalanceWhole;
  });

  // Account page balance (if exists)
  document.querySelectorAll(".account-balance").forEach((el) => {
    el.textContent = formattedBalance;
  });

  // Withdraw screen available balance
  document.querySelectorAll(".withdraw-balance-amount").forEach((el) => {
    el.textContent = formattedBalance;
  });

  console.log("[BALANCE SYNC] All displays updated");
}

// ========== FULL GAME STATE SYNC ==========
let gameRefreshInProgress = false;

async function refreshGameState() {
  // Require login to refresh game state
  if (!isLoggedIn()) {
    showNotification("Please login to sync game data");
    return;
  }

  // Prevent duplicate refresh calls
  if (gameRefreshInProgress) {
    console.log("[GAME SYNC] Already in progress, skipping");
    return;
  }

  const refreshIcon = document.getElementById("balanceRefreshIcon");

  try {
    gameRefreshInProgress = true;

    // Add loading animation and disable button
    if (refreshIcon) {
      refreshIcon.classList.add("refreshing");
    }

    console.log("[GAME SYNC] Starting full game state synchronization...");

    // 1. Fetch latest user balance
    try {
      console.log("[GAME SYNC] Fetching balance...");
      const balanceData = await apiRequest("/user/balance");
      const newBalance = parseFloat(balanceData.data.main_balance) || 0;
      currentBalance = newBalance;
      updateAllBalanceDisplays();
      console.log("[GAME SYNC] Balance updated:", currentBalance);
    } catch (error) {
      console.error("[GAME SYNC] Balance fetch failed:", error);
    }

    // 2. Fetch latest game round data
    try {
      console.log("[GAME SYNC] Fetching current round...");
      const response = await apiRequest("/game/current-round");
      const newRound = response.data;

      if (newRound) {
        // Check if this is a new round
        const isNewRound = !currentRound ||
          currentRound.round_id !== newRound.round_id ||
          currentRound.round_number !== newRound.round_number;

        // Reset bet flag if new round
        if (isNewRound) {
          console.log("[GAME SYNC] New round detected, resetting bet flag");
          betPlacedThisRound = false;
        }

        currentRound = newRound;
        updateGameUI();

        // Restart countdown if new round or countdown isn't running
        if (isNewRound || !countdownInterval) {
          startCountdown(currentRound.timeRemaining || 0);
        }
        console.log("[GAME SYNC] Round data updated");
      }
    } catch (error) {
      console.error("[GAME SYNC] Round fetch failed:", error);
    }

    // 3. Fetch latest game results
    try {
      console.log("[GAME SYNC] Fetching game results...");
      const response = await apiRequest("/game/results?limit=100");

      let resultsData = null;
      if (response.success) {
        resultsData = response.data || response;
        if (resultsData && typeof resultsData === 'object' && resultsData.data && Array.isArray(resultsData.data)) {
          resultsData = resultsData.data;
        }
      }

      if (resultsData && Array.isArray(resultsData) && resultsData.length > 0) {
        miniResultTotalData = resultsData;

        // Reset to page 1 if current page exceeds total pages
        const totalPages = Math.ceil(miniResultTotalData.length / miniResultPerPage);
        if (miniResultCurrentPage > totalPages && totalPages > 0) {
          miniResultCurrentPage = 1;
        }

        renderMiniResultPage();
        console.log("[GAME SYNC] Game results updated");
      }
    } catch (error) {
      console.error("[GAME SYNC] Results fetch failed:", error);
    }

    // 4. Fetch latest bet history
    try {
      console.log("[GAME SYNC] Fetching bet history...");
      const data = await apiRequest(`/game/current-bets?page=1&limit=5`);

      if (data) {
        betHistoryCurrentPage = data.page || 1;
        betHistoryTotalPages = data.totalPages || 1;
        betHistoryTotal = data.total || 0;
        renderBetHistory(data.data || []);
        updateBetHistoryPagination();
        console.log("[GAME SYNC] Bet history updated");
      }
    } catch (error) {
      console.error("[GAME SYNC] Bet history fetch failed:", error);
    }

    // 5. Clear any pending result states (already handled by round update)
    console.log("[GAME SYNC] Full synchronization complete");
    showNotification("Game state refreshed successfully");

  } catch (error) {
    console.error("[GAME SYNC] Failed to sync game state:", error);
    if (error.message !== "Unauthorized") {
      showNotification("Failed to refresh game state. Please try again.");
    }
  } finally {
    gameRefreshInProgress = false;

    // Remove loading animation and re-enable button
    if (refreshIcon) {
      refreshIcon.classList.remove("refreshing");
    }
  }
}

// Legacy function name for backward compatibility
async function refreshBalance() {
  return refreshGameState();
}


// ========== GAME FUNCTIONS ==========
async function loadCurrentRound() {
  try {
    const response = await apiRequest("/game/current-round");
    const newRound = response.data;

    // If no active round, keep polling until one exists
    if (!newRound) {
      console.log("No active round. Waiting for new round...");
      currentRound = null;
      const timerElement = document.querySelector(".timer-text");
      if (timerElement) {
        timerElement.textContent = "00:00";
      }
      // Poll every 2 seconds when no round exists (reduced from 500ms)
      setTimeout(() => loadCurrentRound(), 2000);
      return;
    }

    // Check if this is a new round (different round_id or round_number)
    const isNewRound = !currentRound ||
      currentRound.round_id !== newRound.round_id ||
      currentRound.round_number !== newRound.round_number;

    // CRITICAL FIX: Reset betPlacedThisRound when new round starts
    if (isNewRound) {
      console.log("🆕 New round detected, resetting bet flag");
      betPlacedThisRound = false;
    }

    currentRound = newRound;
    updateGameUI();

    // Only restart countdown if it's a new round or countdown isn't running
    if (isNewRound || !countdownInterval) {
      startCountdown(currentRound.timeRemaining || 0);
    }
  } catch (error) {
    console.error("Failed to load round:", error);
    // Retry on error with 3 second delay
    setTimeout(() => loadCurrentRound(), 3000);
  }
}

function updateGameUI() {
  if (!currentRound) return;

  const roundIdElements = document.querySelectorAll(".round-id");
  roundIdElements.forEach((el) => {
    // Display round_number only (no # prefix) as per Period UI requirement
    el.textContent = currentRound.round_number;
  });
}

function startCountdown(seconds) {
  const timerElement = document.querySelector(".timer-text");
  if (!timerElement) return;

  // Clear existing countdown
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  // Handle invalid or zero seconds - enter polling mode
  if (!seconds || seconds <= 0) {
    timerElement.textContent = "00:00";
    betPlacedThisRound = false;
    resetBetSelection();
    disableBetButtons();

    // Poll for next round with reasonable delay
    const pollForNextRound = () => {
      loadCurrentRound().then(() => {
        // If still no valid round, keep polling
        if (!currentRound || !currentRound.timeRemaining || currentRound.timeRemaining <= 0) {
          setTimeout(pollForNextRound, 2000);
        }
      });
    };
    pollForNextRound();
    return;
  }

  // Enable bet buttons for new round
  enableBetButtons();

  // Use timestamp-based countdown to avoid drift
  const endTime = Date.now() + seconds * 1000;
  let lastRemaining = seconds;

  function updateTimer() {
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));

    const minutes = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const formattedTime = `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

    timerElement.textContent = formattedTime;

    // Detect when countdown reaches 0
    if (remaining === 0 && lastRemaining > 0) {
      console.log("⏰ Countdown reached 0 - Round ending");
      clearInterval(countdownInterval);
      countdownInterval = null;
      betPlacedThisRound = false;
      resetBetSelection();
      disableBetButtons();

      // Poll for next round with controlled frequency
      let pollAttempts = 0;
      const maxPollAttempts = 5; // Poll 5 times max

      const pollForNextRound = () => {
        pollAttempts++;
        loadCurrentRound().then(() => {
          // Check if we got a new round with valid time
          if (currentRound && currentRound.timeRemaining > 0) {
            console.log("✅ New round loaded successfully");
            // Refresh mini result history
            setTimeout(() => loadMiniResultHistory(), 1000);
          } else if (pollAttempts < maxPollAttempts) {
            // Keep polling every 2 seconds
            setTimeout(pollForNextRound, 2000);
          } else {
            console.log("⚠️ Max poll attempts reached. Will retry in 3s");
            setTimeout(pollForNextRound, 3000);
          }
        });
      };

      // Start polling after 1 second delay
      setTimeout(pollForNextRound, 1000);
      return;
    }

    lastRemaining = remaining;
  }

  // Initial update immediately
  updateTimer();

  // Update every 1000ms (1 second) for countdown
  countdownInterval = setInterval(updateTimer, 1000);
}

async function placeBet() {
  // REQUIRE LOGIN TO PLACE BET
  if (!isLoggedIn()) {
    showLoginModal("place a bet");
    resetBetSelection();
    return;
  }

  if (requestInProgress) return;
  if (betPlacedThisRound) {
    showNotification("You already placed a bet this round");
    resetBetSelection();
    return;
  }
  if (!selectedBetType || selectedBetValue === null) {
    showNotification("Please select a bet option");
    return;
  }
  if (!currentRound || !currentRound.round_number) {
    showNotification("Please wait for next round");
    return;
  }

  const amount = 10;
  // Tax is INSIDE the bet amount (not added on top)
  // User bets $10 -> Wallet deducts $10 -> Tax=$1 -> Stake=$9

  // Check balance (only bet amount required, tax is deducted from within)
  if (currentBalance < amount) {
    showNotification(`Insufficient balance. Required: $${amount.toFixed(2)}`);
    resetBetSelection();
    return;
  }

  // Determine choice for backend
  let choice = selectedBetValue;
  if (selectedBetType === "number") {
    // For number bets, determine color from number
    const num = parseInt(selectedBetValue);
    if (num === 0) {
      choice = "purple"; // 0 can be purple
    } else if (num % 2 === 0) {
      choice = "red";
    } else {
      choice = "green";
    }
  }

  requestInProgress = true;
  betPlacedThisRound = true;
  disableBetButtons();
  showLoading();

  try {
    const response = await apiRequest("/game/bet", {
      method: "POST",
      body: JSON.stringify({
        choice: choice,
        amount: amount,
      }),
    });

    // Show success with tax info
    const taxInfo = response.data?.tax_amount
      ? ` (Tax: $${response.data.tax_amount.toFixed(2)})`
      : "";
    showNotification(`Bet placed successfully!${taxInfo}`);

    // INSTANT UPDATE: Use new_balance from backend response (single source of truth)
    if (response.data?.new_balance !== undefined) {
      currentBalance = parseFloat(response.data.new_balance);
      console.log("Balance updated from backend response:", currentBalance);
    }

    // Update ALL balance displays immediately
    updateAllBalanceDisplays();

    // Reload bet history AND transaction history (async, non-blocking)
    // Reset to page 1 when new bet is placed
    betHistoryCurrentPage = 1;
    loadBetHistory(1);
    loadTransactions();

    selectedBetType = null;
    selectedBetValue = null;
    resetBetSelection();
  } catch (error) {
    console.error("Bet error:", error);
    betPlacedThisRound = false;
    enableBetButtons();
    resetBetSelection();
  } finally {
    requestInProgress = false;
    hideLoading();
  }
}

function disableBetButtons() {
  document.querySelectorAll(".color-btn, .number-btn").forEach((btn) => {
    btn.style.opacity = "0.5";
    btn.style.pointerEvents = "none";
  });
}

function enableBetButtons() {
  document.querySelectorAll(".color-btn, .number-btn").forEach((btn) => {
    btn.style.opacity = "1";
    btn.style.pointerEvents = "auto";
  });
}

function resetBetSelection() {
  document.querySelectorAll(".color-btn").forEach((btn) => {
    btn.style.borderColor = "transparent";
  });
  document.querySelectorAll(".number-btn").forEach((btn) => {
    btn.style.background = "var(--glass-bg)";
    btn.style.borderColor = "var(--border-glow)";
  });
}

// ========== BET HISTORY ==========
let betHistoryLoading = false;
let lastBetHistoryLoad = 0;
let betHistoryCurrentPage = 1;
let betHistoryTotalPages = 1;
let betHistoryTotal = 0;

// Bet History Screen (Account Page) state
let betHistoryFullCurrentPage = 1;
let betHistoryFullTotalPages = 1;
let betHistoryFullTotal = 0;
let betHistoryFullCurrentFilter = 'all'; // 'all', 'win', 'loss'

async function loadBetHistory(page = 1) {
  // Only load if user is logged in
  if (!isLoggedIn()) {
    const previewContainer = document.querySelector(".bet-history-preview");
    if (previewContainer) {
      previewContainer.innerHTML =
        '<p style="text-align: center; color: rgba(148, 163, 184, 0.5); padding: 20px; font-size: 13px;">Login to view your bets</p>';
    }
    return;
  }

  // Prevent duplicate calls within 1 second
  const now = Date.now();
  if (betHistoryLoading || (now - lastBetHistoryLoad < 1000)) {
    console.log("[BET HISTORY] Skipping duplicate load request");
    return;
  }

  betHistoryLoading = true;
  lastBetHistoryLoad = now;

  try {
    // Fetch with pagination parameters
    const data = await apiRequest(`/game/current-bets?page=${page}&limit=5`);
    console.log("Bet history response:", data);

    // Update pagination state
    betHistoryCurrentPage = data.page || 1;
    betHistoryTotalPages = data.totalPages || 1;
    betHistoryTotal = data.total || 0;

    // Render bets
    renderBetHistory(data.data || []);

    // Update pagination UI
    updateBetHistoryPagination();
  } catch (error) {
    console.error("Failed to load bet history:", error);
    // Clear preview on error
    const previewContainer = document.querySelector(".bet-history-preview");
    if (previewContainer) {
      previewContainer.innerHTML =
        '<p style="text-align: center; color: rgba(148, 163, 184, 0.5); padding: 20px; font-size: 13px;">Failed to load bet history</p>';
    }
  } finally {
    betHistoryLoading = false;
  }
}

function renderBetHistory(bets) {
  console.log("renderBetHistory called with:", bets);
  const container = document.querySelector(".bet-list");
  if (!container) {
    console.error("renderBetHistory: .bet-list container not found!");
    return;
  }

  console.log("Found .bet-list container");

  // Always clear existing content (including placeholder cards)
  if (!bets || bets.length === 0) {
    console.log("No bets to display, showing empty state");
    container.innerHTML =
      '<p style="text-align: center; color: var(--text-secondary); padding: 20px; font-size: 14px;">No bet history yet. Place your first bet!</p>';

    // Also clear preview
    const previewContainer = document.querySelector(".bet-history-preview");
    if (previewContainer) {
      console.log("Clearing .bet-history-preview");
      previewContainer.innerHTML =
        '<p style="text-align: center; color: rgba(148, 163, 184, 0.5); padding: 20px; font-size: 13px;">No recent bets</p>';
    }
    return;
  }

  console.log(`Rendering ${bets.length} bets`);
  container.innerHTML = bets
    .slice(0, 20)
    .map((bet) => {
      const isPending = !bet.result || bet.result === "pending";
      const isWin = bet.result === "win";
      const statusClass = isPending ? "pending" : isWin ? "win" : "loss";
      const statusText = isPending ? "PENDING" : bet.result.toUpperCase();
      const taxAmount = bet.tax_amount || bet.amount * 0.1;
      // Map backend fields: round_number, choice, round_result_number
      const roundDisplay = bet.round_number || "----";
      const selectionDisplay = (bet.choice || "red").toUpperCase();
      const resultNumber = bet.round_result_number;

      return `
        <div class="bet-card" data-round-id="${roundDisplay}">
            <div class="bet-header">
                <span class="bet-round-id">#${roundDisplay}</span>
                <span class="bet-result ${statusClass}">${statusText}</span>
            </div>
            <div class="bet-details">
                <div class="bet-detail-row">
                    <span class="detail-label">Type:</span>
                    <span class="detail-value">COLOR</span>
                </div>
                <div class="bet-detail-row">
                    <span class="detail-label">Selection:</span>
                    <span class="detail-value">${selectionDisplay}</span>
                </div>
                <div class="bet-detail-row">
                    <span class="detail-label">Bet Amount:</span>
                    <span class="detail-value">$${parseFloat(bet.amount).toFixed(2)}</span>
                </div>
                <div class="bet-detail-row">
                    <span class="detail-label">Tax (10%):</span>
                    <span class="detail-value">$${parseFloat(taxAmount).toFixed(2)}</span>
                </div>
                <div class="bet-detail-row">
                    <span class="detail-label">Result:</span>
                    <span class="detail-value">${resultNumber !== null && resultNumber !== undefined ? resultNumber : isPending ? "Waiting..." : "-"}</span>
                </div>
                <div class="bet-detail-row">
                    <span class="detail-label">Payout:</span>
                    <span class="detail-value ${isWin ? "green" : isPending ? "" : "red"}">${isPending ? "-" : isWin ? "+$" + parseFloat(bet.payout || 0).toFixed(2) : "-$" + parseFloat(bet.amount).toFixed(2)}</span>
                </div>
            </div>
            <div class="bet-footer">
                <span class="bet-date">${new Date(bet.created_at).toLocaleString()}</span>
            </div>
        </div>
    `;
    })
    .join("");

  const previewContainer = document.querySelector(".bet-history-preview");
  if (previewContainer && bets.length > 0) {
    previewContainer.innerHTML = bets
      .slice(0, 5)
      .map((bet) => {
        const isPending = !bet.result || bet.result === "pending";
        const isWin = bet.result === "win";
        // Map backend field: choice instead of bet_value
        const selectionColor = (bet.choice || "red").toLowerCase();
        const roundDisplay = bet.round_number || "----";
        return `
            <div class="bet-row">
                <span class="bet-round">
                    <span class="round-dot ${isPending ? "yellow" : isWin ? "green" : "red"}"></span>
                    #${roundDisplay.toString().slice(-4)}
                </span>
                <span class="bet-selection">
                    <span class="sel-dot ${selectionColor === "green" ? "green" : selectionColor === "purple" ? "purple" : "red"}"></span>
                    ${(bet.choice || "RED").toUpperCase()}
                </span>
                <span class="bet-result ${isPending ? "pending" : isWin ? "won" : "lost"}">${isPending ? "Pending" : isWin ? "Won" : "Lost"}</span>
                <span class="bet-amount ${isWin ? "green" : isPending ? "yellow" : "red"}">${isPending ? "..." : (isWin ? "+" : "-") + "$" + Math.abs(bet.payout || bet.amount).toFixed(2)}</span>
            </div>
        `;
      })
      .join("");
  }
}

// ========== BET HISTORY SCREEN (ACCOUNT PAGE) ==========
async function loadBetHistoryScreen(page = 1, filter = 'all') {
  if (!checkAuth()) return;

  try {
    betHistoryFullCurrentFilter = filter;

    // Fetch all bets from /history/bets endpoint (same as Transaction Page)
    const data = await apiRequest('/history/bets?limit=100');
    const allBets = data.data || [];

    console.log(`[BET HISTORY SCREEN] Loaded ${allBets.length} bets, filter: ${filter}`);

    // Filter based on tab
    let filteredBets = allBets;
    if (filter === 'win') {
      filteredBets = allBets.filter(bet => bet.result === 'win');
    } else if (filter === 'loss') {
      filteredBets = allBets.filter(bet => bet.result === 'loss');
    }

    console.log(`[BET HISTORY SCREEN] Filtered to ${filteredBets.length} bets`);

    // Calculate pagination
    const limit = 10; // Show 10 bets per page
    betHistoryFullTotal = filteredBets.length;
    betHistoryFullTotalPages = Math.ceil(betHistoryFullTotal / limit) || 1;
    betHistoryFullCurrentPage = Math.min(page, Math.max(1, betHistoryFullTotalPages));

    // Get bets for current page
    const startIdx = (betHistoryFullCurrentPage - 1) * limit;
    const endIdx = startIdx + limit;
    const pageBets = filteredBets.slice(startIdx, endIdx);

    console.log(`[BET HISTORY SCREEN] Page ${betHistoryFullCurrentPage}/${betHistoryFullTotalPages}, showing ${pageBets.length} bets`);

    // Render bets
    renderBetHistoryScreen(pageBets);

    // Update pagination UI
    updateBetHistoryFullPagination();

  } catch (error) {
    console.error('[BET HISTORY SCREEN] Failed to load:', error);
    const container = document.querySelector('.bet-list');
    if (container) {
      container.innerHTML = '<p style="text-align: center; color: rgba(148, 163, 184, 0.5); padding: 30px 20px; font-size: 14px;">Failed to load bet history</p>';
    }
  }
}

function renderBetHistoryScreen(bets) {
  const container = document.querySelector('.bet-list');
  if (!container) {
    console.error('[BET HISTORY SCREEN] .bet-list container not found');
    return;
  }

  if (!bets || bets.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: rgba(148, 163, 184, 0.5); padding: 30px 20px; font-size: 14px;">No bets found</p>';
    return;
  }

  // Render bet cards using same format as Game Page
  container.innerHTML = bets.map((bet) => {
    const isPending = !bet.result || bet.result === 'pending';
    const isWin = bet.result === 'win';
    const statusClass = isPending ? 'pending' : isWin ? 'win' : 'loss';
    const statusText = isPending ? 'PENDING' : bet.result.toUpperCase();
    const taxAmount = bet.tax_amount || bet.amount * 0.1;
    const roundDisplay = bet.round_number || '----';
    const selectionDisplay = (bet.choice || 'red').toUpperCase();
    const resultNumber = bet.round_result_number;

    return `
      <div class="bet-card" data-round-id="${roundDisplay}">
        <div class="bet-header">
          <span class="bet-round-id">#${roundDisplay}</span>
          <span class="bet-result ${statusClass}">${statusText}</span>
        </div>
        <div class="bet-details">
          <div class="bet-detail-row">
            <span class="detail-label">Type:</span>
            <span class="detail-value">COLOR</span>
          </div>
          <div class="bet-detail-row">
            <span class="detail-label">Selection:</span>
            <span class="detail-value">${selectionDisplay}</span>
          </div>
          <div class="bet-detail-row">
            <span class="detail-label">Bet Amount:</span>
            <span class="detail-value">$${parseFloat(bet.amount).toFixed(2)}</span>
          </div>
          <div class="bet-detail-row">
            <span class="detail-label">Tax (10%):</span>
            <span class="detail-value">$${parseFloat(taxAmount).toFixed(2)}</span>
          </div>
          <div class="bet-detail-row">
            <span class="detail-label">Result:</span>
            <span class="detail-value">${resultNumber !== null && resultNumber !== undefined ? resultNumber : isPending ? 'Waiting...' : '-'}</span>
          </div>
          <div class="bet-detail-row">
            <span class="detail-label">Payout:</span>
            <span class="detail-value ${isWin ? 'green' : isPending ? '' : 'red'}">${isPending ? '-' : isWin ? '+$' + parseFloat(bet.payout || 0).toFixed(2) : '-$' + parseFloat(bet.amount).toFixed(2)}</span>
          </div>
        </div>
        <div class="bet-footer">
          <span class="bet-date">${new Date(bet.created_at).toLocaleString()}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ========== TRANSACTIONS ==========
let transactionsLoading = false;
let lastTransactionsLoad = 0;

async function loadTransactions(type = "all") {
  if (!checkAuth()) return;

  // Prevent duplicate calls within 1 second
  const now = Date.now();
  if (transactionsLoading || (now - lastTransactionsLoad < 1000)) {
    console.log("[TRANSACTIONS] Skipping duplicate load request");
    return;
  }

  transactionsLoading = true;
  lastTransactionsLoad = now;

  try {
    let allTransactions = [];

    console.log('[TRANSACTIONS] Loading type:', type);

    // Handle different transaction types
    if (type === "win" || type === "loss") {
      // For win/loss, fetch from bet history
      try {
        const betsData = await apiRequest('/history/bets?limit=100');
        const bets = betsData.data || [];

        console.log('[TRANSACTIONS] Fetched bets:', bets.length);
        console.log('[TRANSACTIONS] Sample bet:', bets[0]);

        // Filter bets by result
        const filteredBets = bets.filter(bet => {
          if (type === "win") {
            return bet.result === 'win';
          } else if (type === "loss") {
            return bet.result === 'loss';
          }
          return false;
        });

        console.log(`[TRANSACTIONS] Filtered ${type} bets:`, filteredBets.length);

        // Convert bets to transaction format
        allTransactions = filteredBets.map(bet => ({
          id: `bet_${bet.id}`,
          type: 'game_bet',
          amount: type === "win" ? parseFloat(bet.payout || 0) : -parseFloat(bet.amount),
          status: 'completed',
          description: `Bet - Round #${bet.round_number} - ${bet.choice.toUpperCase()}`,
          created_at: bet.created_at,
          round_number: bet.round_number,
          choice: bet.choice,
          result: bet.result
        }));

      } catch (betError) {
        console.error('[TRANSACTIONS] Failed to fetch bet history:', betError);
      }

    } else if (type === "deposit") {
      // For deposit, fetch ALL recharge requests (pending, rejected, completed)
      try {
        const data = await apiRequest('/wallet/recharge-history?limit=100');
        const recharges = data.data || [];

        // Convert to transaction format
        allTransactions = recharges.map(r => ({
          id: `recharge_${r.id}`,
          type: 'recharge',
          amount: parseFloat(r.amount),
          status: r.status, // pending, rejected, or completed
          description: `Recharge Request - ${r.payment_method || 'USDT'}`,
          created_at: r.created_at
        }));

        console.log('[TRANSACTIONS] Fetched recharge transactions:', allTransactions.length);

      } catch (error) {
        console.error('[TRANSACTIONS] Failed to fetch recharge transactions:', error);
      }

    } else if (type === "withdraw") {
      // For withdraw, fetch withdrawal_request transactions
      try {
        const data = await apiRequest('/history/transactions?type=withdrawal_request');
        allTransactions = data.data || [];

        console.log('[TRANSACTIONS] Fetched withdrawals:', allTransactions.length);

      } catch (withdrawError) {
        console.error('[TRANSACTIONS] Failed to fetch withdrawals:', withdrawError);
      }

    } else {
      // For "all", fetch everything and merge
      try {
        // Fetch regular transactions
        const data = await apiRequest('/history/transactions');
        allTransactions = data.data || [];

        // Fetch and merge recharge requests
        try {
          const rechargeData = await apiRequest('/wallet/recharge-history?limit=100');
          const recharges = rechargeData.data || [];

          const rechargeTransactions = recharges.map(r => ({
            id: `recharge_${r.id}`,
            type: 'recharge',
            amount: parseFloat(r.amount),
            status: r.status,
            description: `Recharge Request - ${r.payment_method || 'USDT'}`,
            created_at: r.created_at
          }));

          allTransactions = [...allTransactions, ...rechargeTransactions];
          console.log('[TRANSACTIONS] Merged with recharge requests:', rechargeTransactions.length);
        } catch (rechargeError) {
          console.error('[TRANSACTIONS] Failed to fetch recharge history:', rechargeError);
        }

        // Sort by date
        allTransactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      } catch (error) {
        console.error('[TRANSACTIONS] Failed to fetch all transactions:', error);
      }
    }

    // Console logging for debugging
    console.log('[TRANSACTIONS] Total count:', allTransactions.length);
    console.log('[TRANSACTIONS] Sample data:', allTransactions.slice(0, 3));

    renderTransactions(allTransactions);
  } catch (error) {
    console.error("Failed to load transactions:", error);
    renderTransactions([]);
  } finally {
    transactionsLoading = false;
  }
}

function renderTransactions(transactions) {
  // CRITICAL FIX: Use the actual container ID from HTML
  const container = document.getElementById("walletTxPreview");
  if (!container) {
    console.error("[TRANSACTIONS] Container #walletTxPreview not found in DOM!");
    return;
  }

  if (transactions.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No transactions yet</p>';
    return;
  }

  // Helper to format transaction type for display
  const formatType = (type) => {
    const typeMap = {
      game_bet: "Bet",
      game_win: "Win",
      admin_credit: "Credit",
      admin_debit: "Debit",
      red_envelope: "Red Envelope",
      withdrawal_refund: "Refund",
      recharge: "Recharge",
      withdrawal_request: "Withdrawal",
    };
    return (
      typeMap[type] ||
      type.charAt(0).toUpperCase() + type.slice(1).replace("_", " ")
    );
  };

  // Use amount sign to determine credit/debit (backend sends negative for debits)
  container.innerHTML = transactions
    .slice(0, 20)
    .map((tx) => {
      const isDebit = tx.amount < 0;
      const displayAmount = Math.abs(tx.amount).toFixed(2);

      // For bet transactions, show "My Bet History" as type and description with color
      const displayType = (tx.type === 'game_bet' || tx.type === 'game_win')
        ? 'My Bet History'
        : formatType(tx.type);

      // Show description if it exists (contains bet color info)
      const descriptionHtml = tx.description
        ? `<div style="font-size: 12px; color: rgba(148, 163, 184, 0.8); margin-top: 4px;">${tx.description}</div>`
        : '';

      // Map status display text
      const statusDisplayText = tx.status === 'cancelled' ? 'REJECTED' : tx.status.charAt(0).toUpperCase() + tx.status.slice(1);

      return `
        <div class="transaction-card">
            <div class="transaction-header">
                <span class="transaction-type">${displayType}</span>
                <span class="transaction-status ${tx.status}">${statusDisplayText}</span>
            </div>
            <div class="transaction-body">
                <span class="transaction-amount ${isDebit ? "red" : "green"}">${isDebit ? "-" : "+"}$${displayAmount}</span>
                <span class="transaction-date">${new Date(tx.created_at).toLocaleString()}</span>
            </div>
            ${descriptionHtml}
        </div>
    `;
    })
    .join("");

  const previewContainer = document.querySelector(".transactions-preview");
  if (previewContainer && transactions.length > 0) {
    const previewList =
      previewContainer.querySelector(".transaction-item")?.parentElement;
    if (previewList) {
      previewList.innerHTML = transactions
        .slice(0, 3)
        .map((tx) => {
          const isDebit = tx.amount < 0;
          const displayAmount = Math.abs(tx.amount).toFixed(2);
          return `
                <div class="transaction-item">
                    <div class="transaction-info">
                        <span class="transaction-type">${formatType(tx.type)}</span>
                        <span class="transaction-date">${new Date(tx.created_at).toLocaleDateString()}</span>
                    </div>
                    <span class="transaction-amount ${isDebit ? "red" : "green"}">${isDebit ? "-" : "+"}$${displayAmount}</span>
                </div>
            `;
        })
        .join("");
    }
  }
}

// ========== WALLET RECENT TRANSACTIONS ==========
function renderWalletRecentTransactions(transactions) {
  const container = document.getElementById("walletRecentTxList");
  if (!container) {
    console.error("[WALLET] Container #walletRecentTxList not found!");
    return;
  }

  console.log('[WALLET] Rendering recent transactions:', transactions.length);

  if (transactions.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; color: rgba(148, 163, 184, 0.5); padding: 20px; font-size: 13px;">No recent transactions</p>';
    return;
  }

  // Helper to format transaction type for display
  const formatType = (type) => {
    const typeMap = {
      game_bet: "Bet",
      game_win: "Win",
      admin_credit: "Credit",
      admin_debit: "Debit",
      red_envelope: "Red Envelope",
      withdrawal_refund: "Refund",
      recharge: "Recharge",
      withdrawal_request: "Withdrawal",
    };
    return (
      typeMap[type] ||
      type.charAt(0).toUpperCase() + type.slice(1).replace("_", " ")
    );
  };

  // Sort by created_at DESC and take latest 5
  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  container.innerHTML = sortedTransactions
    .slice(0, 5)
    .map((tx) => {
      const isDebit = tx.amount < 0;
      const displayAmount = Math.abs(tx.amount).toFixed(2);
      return `
        <div class="transaction-item" style="padding: 12px; border-bottom: 1px solid rgba(148, 163, 184, 0.1);">
          <div class="transaction-info" style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span class="transaction-type" style="font-weight: 500; color: var(--text-primary);">${formatType(tx.type)}</span>
              <br>
              <span class="transaction-date" style="font-size: 11px; color: var(--text-secondary);">${new Date(tx.created_at).toLocaleString()}</span>
            </div>
            <span class="transaction-amount" style="font-weight: 600; color: ${isDebit ? "var(--red)" : "var(--green)"};">${isDebit ? "-" : "+"}$${displayAmount}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

// ========== WITHDRAWAL HISTORY ==========
async function loadWithdrawalHistory() {
  if (!checkAuth()) return;

  const container = document.getElementById("withdrawHistoryList");
  if (!container) {
    console.error("[WITHDRAWAL] Container #withdrawHistoryList not found!");
    return;
  }

  try {
    // Fetch from dedicated withdrawals endpoint
    const data = await apiRequest('/wallet/withdrawals');
    console.log('[WITHDRAWAL] Withdrawals data:', data);

    renderWithdrawalHistory(data.data || []);
  } catch (error) {
    console.error('[WITHDRAWAL] Failed to load withdrawal history:', error);
    container.innerHTML =
      '<p style="text-align: center; color: rgba(148, 163, 184, 0.5); padding: 20px; font-size: 13px;">Failed to load withdrawal history</p>';
  }
}

function renderWithdrawalHistory(withdrawals) {
  const container = document.getElementById("withdrawHistoryList");
  if (!container) {
    console.error("[WITHDRAWAL] Container #withdrawHistoryList not found!");
    return;
  }

  console.log('[WITHDRAWAL] Rendering withdrawals:', withdrawals.length);

  if (withdrawals.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; color: rgba(148, 163, 184, 0.5); padding: 20px; font-size: 13px;">No withdrawal history yet</p>';
    return;
  }

  container.innerHTML = withdrawals
    .slice(0, 10)
    .map((w) => {
      const statusClass = w.status === "approved" || w.status === "completed" ? "green" : w.status === "pending" ? "yellow" : "red";
      const statusText = w.status.charAt(0).toUpperCase() + w.status.slice(1);

      return `
        <div class="withdrawal-item" style="padding: 12px; border-bottom: 1px solid rgba(148, 163, 184, 0.1); margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path>
              </svg>
              <div>
                <span style="font-weight: 500; color: var(--text-primary);">Withdrawal Request</span>
                <br>
                <span style="font-size: 11px; color: var(--text-secondary);">${new Date(w.created_at).toLocaleString()}</span>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 600; color: var(--red);">-$${parseFloat(w.amount).toFixed(2)}</div>
              <div style="font-size: 10px; color: var(--text-secondary);">Fee: $${parseFloat(w.fee).toFixed(2)} | Net: $${parseFloat(w.net_amount).toFixed(2)}</div>
              <div style="font-size: 11px; color: var(--${statusClass});">${statusText}</div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

// ========== WITHDRAWAL ==========
async function handleWithdraw() {
  if (requestInProgress) return;

  const amountInput = document.getElementById("withdraw-amount");
  const addressInput = document.getElementById("walletAddress");
  const passwordInput = document.getElementById("withdrawalPassword");

  const amount = parseFloat(amountInput.value);
  const address = addressInput.value.trim();
  const withdrawalPassword = passwordInput.value;

  if (!amount || !address || !withdrawalPassword) {
    showNotification("Please fill all fields");
    return;
  }

  if (isNaN(amount) || amount <= 0) {
    showNotification("Please enter a valid amount");
    return;
  }

  if (amount < 20) {
    showNotification("Minimum withdrawal is $20");
    return;
  }

  if (amount > 5000) {
    showNotification("Maximum withdrawal is $5,000");
    return;
  }

  if (amount > currentBalance) {
    showNotification("Insufficient balance");
    return;
  }

  if (address.length < 20) {
    showNotification("Please enter a valid wallet address");
    return;
  }

  requestInProgress = true;
  const submitBtn = document.querySelector(".withdraw-confirm-btn");
  submitBtn.disabled = true;
  submitBtn.style.opacity = "0.6";
  showLoading();

  try {
    await apiRequest("/wallet/withdraw", {
      method: "POST",
      body: JSON.stringify({
        amount,
        wallet_address: address,
        withdrawal_password: withdrawalPassword,
      }),
    });

    showNotification("Withdrawal request submitted successfully!");
    amountInput.value = "";
    addressInput.value = "";
    passwordInput.value = "";
    await loadUserData();
    await loadTransactions();

    // Refresh withdrawal history on current screen
    await loadWithdrawalHistory();

    setTimeout(() => navigateTo("wallet-screen"), 1500);
  } catch (error) {
    console.error("Withdrawal error:", error);
    if (error.message.includes("password")) {
      showNotification("Invalid withdrawal password");
    }
  } finally {
    requestInProgress = false;
    submitBtn.disabled = false;
    submitBtn.style.opacity = "1";
    hideLoading();
  }
}

// ========== RECHARGE REQUEST ==========
async function handleRechargeRequest() {
  if (requestInProgress) return;

  const uidInput = document.getElementById("recharge-uid");
  const amountInput = document.getElementById("recharge-amount");
  const submitBtn = document.getElementById("recharge-confirm-btn");

  const uid = uidInput.value.trim();
  const amount = parseFloat(amountInput.value);

  // Validation
  if (!uid || uid === "") {
    showNotification("Please enter your UID");
    return;
  }

  if (!amount || isNaN(amount) || amount <= 0) {
    showNotification("Please enter a valid recharge amount");
    return;
  }

  // Disable button to prevent duplicate submissions
  requestInProgress = true;
  submitBtn.disabled = true;
  submitBtn.style.opacity = "0.5";
  showLoading();

  try {
    const response = await apiRequest("/recharge/request", {
      method: "POST",
      body: JSON.stringify({
        uid: parseInt(uid),
        amount: amount,
      }),
    });

    // Clear inputs
    uidInput.value = "";
    amountInput.value = "";

    // Show success popup
    showNotification("⏳ Waiting for approval...");

    // Refresh transaction history immediately
    await loadTransactions();

    // Also refresh wallet recent transactions if on wallet screen
    const walletScreen = document.getElementById('wallet-screen');
    if (walletScreen && walletScreen.classList.contains('active')) {
      const data = await apiRequest('/history/transactions');
      renderWalletRecentTransactions(data.data || []);
    }

    // Keep button disabled after successful submission
    setTimeout(() => {
      submitBtn.disabled = false;
      submitBtn.style.opacity = "1";
    }, 3000);
  } catch (error) {
    console.error("Recharge request error:", error);
    showNotification(error.message || "Failed to submit recharge request");

    // Re-enable button on error
    submitBtn.disabled = false;
    submitBtn.style.opacity = "1";
  } finally {
    requestInProgress = false;
    hideLoading();
  }
}

// ========== PROMOTIONS ==========
async function loadPromotions() {
  if (!checkAuth()) return;

  try {
    // Fetch referral info (code & link)
    const referralInfo = await apiRequest("/referral/info");

    // Fetch promotion stats
    const statsData = await apiRequest("/referral/stats");

    // Update UI with both
    updatePromotionsUI(statsData, referralInfo);
  } catch (error) {
    console.error("Failed to load promotions:", error);
  }
}

function updatePromotionsUI(data, referralInfo) {
  // Update main commission amount
  const commissionAmount = document.querySelector(".commission-amount");
  if (commissionAmount) {
    commissionAmount.textContent = `$${(data.actual_commission || 0).toFixed(2)}`;
  }

  // Update total invited count
  const invitedCount = document.querySelector(".promo-invited-count");
  if (invitedCount) {
    invitedCount.textContent = `${data.total_people_invited || 0}`;
  }

  // Update total contribution
  const contributionValue = document.querySelector(".promo-contribution-value");
  if (contributionValue) {
    contributionValue.textContent = `$${(data.total_contribution || 0).toFixed(2)}`;
  }

  // Get referral code and link from API response
  const referralCode = referralInfo?.referral_code || "LUX123456";
  const referralLink =
    referralInfo?.referral_link ||
    `https://luxwin.app/register?ref=${referralCode}`;

  // Update promo code
  const codeTexts = document.querySelectorAll(".promo-code-section .code-text");
  if (codeTexts.length >= 1) {
    codeTexts[0].textContent = referralCode;
  }

  // Update promo link
  if (codeTexts.length >= 2) {
    codeTexts[1].textContent = referralLink;
  }

  // Update level tab counts
  const levelTabs = document.querySelectorAll(".level-tab .level-count");
  if (levelTabs.length >= 3 && data.level_counts) {
    levelTabs[0].textContent = `(${data.level_counts.level_1 || 0})`;
    levelTabs[1].textContent = `(${data.level_counts.level_2 || 0})`;
    levelTabs[2].textContent = `(${data.level_counts.level_3 || 0})`;
  }

  // Legacy support for old UI elements
  const stats = document.querySelectorAll(".promo-stat-card .stat-value");
  if (stats.length >= 3) {
    stats[0].textContent = `$${(data.actual_commission || 0).toFixed(2)}`;
    stats[1].textContent = `${data.total_people_invited || 0} Users`;
    stats[2].textContent = `$${(data.total_contribution || 0).toFixed(2)}`;
  }

  const codeText = document.querySelector(".code-display .code-text");
  if (codeText) {
    codeText.textContent = referralCode;
  }

  const linkTexts = document.querySelectorAll(".code-display .code-text");
  if (linkTexts.length >= 2) {
    linkTexts[1].textContent = referralLink;
  }
}

async function loadCommissions(level = 1) {
  if (!checkAuth()) return;

  try {
    const data = await apiRequest(`/referral/users/${level}`);
    renderCommissions(data.users || [], level);
  } catch (error) {
    console.error("Failed to load commissions:", error);
  }
}

function renderCommissions(users, level) {
  const tableBody = document.querySelector(".commission-table");
  if (!tableBody) return;

  const header = `
        <div class="commission-row header">
            <span>ID</span>
            <span>Phone</span>
            <span>Water reward</span>
            <span>First reward</span>
        </div>
    `;

  if (users.length === 0) {
    tableBody.innerHTML =
      header +
      `
            <div class="commission-empty-state">
                <p>No data available</p>
            </div>
        `;
    updatePaginationInfo(0, 0, 0);
    return;
  }

  const rows = users
    .map(
      (user) => `
        <div class="commission-row">
            <span>${user.uid || "---"}</span>
            <span>${user.phone ? "***" + user.phone.slice(-4) : "---"}</span>
            <span class="green">$${(user.water_reward || 0).toFixed(2)}</span>
            <span class="green">$${(user.first_reward || 0).toFixed(2)}</span>
        </div>
    `,
    )
    .join("");

  tableBody.innerHTML = header + rows;
  updatePaginationInfo(1, Math.min(users.length, 10), users.length);
}

function updatePaginationInfo(start, end, total) {
  const paginationInfo = document.querySelector(".pagination-info");
  if (paginationInfo) {
    if (total === 0) {
      paginationInfo.textContent = "0-0 of 0";
    } else {
      paginationInfo.textContent = `${start}-${end} of ${total}`;
    }
  }
}

function prevPage() {
  // Pagination logic - placeholder for backend pagination
  showNotification("Previous page");
}

function nextPage() {
  // Pagination logic - placeholder for backend pagination
  showNotification("Next page");
}

// ========== SECURITY ==========
async function handleChangePassword(type) {
  if (requestInProgress) return;

  const currentPassword = prompt("Enter current password:");
  if (!currentPassword) return;

  const newPassword = prompt("Enter new password:");
  if (!newPassword) return;

  const confirmPassword = prompt("Confirm new password:");
  if (!confirmPassword) return;

  if (newPassword !== confirmPassword) {
    showNotification("Passwords do not match");
    return;
  }

  if (newPassword.length < 6) {
    showNotification("New password must be at least 6 characters");
    return;
  }

  requestInProgress = true;
  showLoading();

  try {
    const endpoint =
      type === "login"
        ? "/user/change-password"
        : "/user/change-withdrawal-password";
    await apiRequest(endpoint, {
      method: "POST",
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });

    showNotification("Password changed successfully!");
  } catch (error) {
    console.error("Password change error:", error);
    if (error.message.includes("password")) {
      showNotification("Current password is incorrect");
    }
  } finally {
    requestInProgress = false;
    hideLoading();
  }
}

// ========== NAVIGATION SYSTEM ==========
function navigateTo(screenId) {
  const screens = document.querySelectorAll(".screen");
  screens.forEach((screen) => {
    screen.classList.remove("active");
  });

  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add("active");

    // Home screen - ALWAYS accessible, load game UI
    if (screenId === "home-screen") {
      betPlacedThisRound = false;
      enableBetButtons();
      loadCurrentRound();
      loadMiniResultHistory();

      if (isLoggedIn()) {
        // loadUserData handled by caller to avoid duplicates
        // Only load bet history if not recently loaded
        if (Date.now() - lastBetHistoryLoad > 1000) {
          loadBetHistory();
        }
      } else {
        updateGuestUI();
      }
    }

    // These screens require login
    if (screenId === "promotions-screen" && isLoggedIn()) {
      setTimeout(() => {
        showPromoModal();
        loadPromotions();
        loadCommissions(1);
      }, 300);
    }

    if (screenId === "account-screen" && isLoggedIn()) {
      // Only load if not recently loaded
      if (Date.now() - lastUserDataLoad > 2000) {
        loadUserData();
      }
    }

    if (screenId === "wallet-screen" && isLoggedIn()) {
      // Only load if not recently loaded
      if (Date.now() - lastUserDataLoad > 2000) {
        loadUserData();
      }
      // Load transactions and render wallet recent transactions
      if (Date.now() - lastTransactionsLoad > 1000) {
        loadTransactions().then(() => {
          // Fetch both regular transactions AND recharge requests
          Promise.all([
            apiRequest('/history/transactions'),
            apiRequest('/wallet/recharge-history?limit=20')
          ]).then(([txData, rechargeData]) => {
            const transactions = txData.data || [];
            const recharges = rechargeData.data || [];

            // Convert recharges to transaction format
            const rechargeTransactions = recharges.map(r => ({
              id: `recharge_${r.id}`,
              type: 'recharge',
              amount: parseFloat(r.amount),
              status: r.status,
              description: `Recharge Request - ${r.payment_method || 'USDT'}`,
              created_at: r.created_at
            }));

            // Merge and sort by date
            const allTransactions = [...transactions, ...rechargeTransactions];
            allTransactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            renderWalletRecentTransactions(allTransactions);
          }).catch(err => {
            console.error('[WALLET] Failed to load recent transactions:', err);
          });
        });

        // Load withdrawal history from dedicated endpoint
        loadWithdrawalHistory();
      }
    }

    if (screenId === "withdraw-screen" && isLoggedIn()) {
      // Load withdrawal history from dedicated endpoint
      if (Date.now() - lastTransactionsLoad > 1000) {
        loadWithdrawalHistory();
      }
    }

    if (screenId === "transactions-screen" && isLoggedIn()) {
      // Only load if not recently loaded
      if (Date.now() - lastTransactionsLoad > 1000) {
        loadTransactions();
      }
    }

    if (screenId === "bet-history-screen") {
      if (isLoggedIn()) {
        // Load bet history screen with pagination
        loadBetHistoryScreen(1, 'all');
      }
    }

    if (screenId === "red-envelope-screen") {
      loadActiveEnvelope();
    }

    if (screenId === "leaderboard-screen") {
      loadLeaderboard();
    }
  }

  // Update global bottom nav state
  updateBottomNavState(screenId);
}

// ========== LEADERBOARD - REAL DATA FROM DATABASE ==========
async function loadLeaderboard() {
  const podiumContainer = document.getElementById("leaderboardPodium");
  const listContainer = document.getElementById("leaderboardList");

  try {
    // Fetch top 10 winners from database
    const response = await fetch(`${API_BASE_URL}/game/top-winners?limit=10`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data && data.data.length > 0) {
        const winners = data.data;

        // Update podium (top 3)
        if (podiumContainer) {
          const podiumItems = podiumContainer.querySelectorAll(".podium-item");
          // First place (middle)
          if (winners[0] && podiumItems[1]) {
            podiumItems[1].querySelector(".podium-name").textContent =
              maskEmail(winners[0].email);
            podiumItems[1].querySelector(".podium-amount").textContent =
              "$" + parseFloat(winners[0].total_winnings || 0).toLocaleString();
          }
          // Second place (left)
          if (winners[1] && podiumItems[0]) {
            podiumItems[0].querySelector(".podium-name").textContent =
              maskEmail(winners[1].email);
            podiumItems[0].querySelector(".podium-amount").textContent =
              "$" + parseFloat(winners[1].total_winnings || 0).toLocaleString();
          }
          // Third place (right)
          if (winners[2] && podiumItems[2]) {
            podiumItems[2].querySelector(".podium-name").textContent =
              maskEmail(winners[2].email);
            podiumItems[2].querySelector(".podium-amount").textContent =
              "$" + parseFloat(winners[2].total_winnings || 0).toLocaleString();
          }
        }

        // Update list (positions 4-10)
        if (listContainer && winners.length > 3) {
          listContainer.innerHTML = winners
            .slice(3, 10)
            .map(
              (winner, index) => `
              <div class="leaderboard-item">
                <span class="rank">${index + 4}</span>
                <span class="name">${maskEmail(winner.email)}</span>
                <span class="amount green">$${parseFloat(winner.total_winnings || 0).toLocaleString()}</span>
              </div>
            `,
            )
            .join("");
        } else if (listContainer) {
          listContainer.innerHTML = `
            <p style="text-align: center; color: rgba(148, 163, 184, 0.5); padding: 20px; font-size: 13px;">
              No more winners to display
            </p>
          `;
        }
        return;
      }
    }
  } catch (error) {
    console.log("Leaderboard API not available:", error);
  }

  // Show placeholder if no real data
  if (listContainer) {
    listContainer.innerHTML = `
      <p style="text-align: center; color: rgba(148, 163, 184, 0.5); padding: 20px; font-size: 13px;">
        No leaderboard data yet. Start playing to appear here!
      </p>
    `;
  }
}

// ========== UPDATE GUEST UI ==========
function updateGuestUI() {
  // Show $0 balance for guests
  const balanceElements = document.querySelectorAll(".balance-amount");
  balanceElements.forEach((el) => {
    el.textContent = "$0.00";
  });

  const walletBalanceElements = document.querySelectorAll(".wallet-balance");
  walletBalanceElements.forEach((el) => {
    el.textContent = "$0.00";
  });

  // Update home page balance card for guests
  const balanceValueElements = document.querySelectorAll(".balance-value");
  balanceValueElements.forEach((el) => {
    el.textContent = "$0";
  });

  // Bet history is handled by loadBetHistory() for guests
}

// ========== TAB SWITCHING ==========
function switchTab(event, tabName) {
  const tabButtons = event.target.parentElement.querySelectorAll(".tab-btn");
  tabButtons.forEach((btn) => {
    btn.classList.remove("active");
  });

  event.target.classList.add("active");
  loadTransactions(tabName);
}

function switchLevelTab(event, level) {
  const levelTabs = event.target.parentElement.querySelectorAll(".level-tab");
  levelTabs.forEach((tab) => {
    tab.classList.remove("active");
  });

  event.target.classList.add("active");
  const levelNum = parseInt(level.replace("level", ""));
  loadCommissions(levelNum);
}

// ========== MODAL MANAGEMENT ==========
function showPromoModal() {
  const modal = document.getElementById("promo-modal");
  const hasShown = sessionStorage.getItem(
    `promoModalShown_${currentUser?.user_id || "guest"}`,
  );

  if (modal && !hasShown) {
    modal.classList.add("active");
    sessionStorage.setItem(
      `promoModalShown_${currentUser?.user_id || "guest"}`,
      "true",
    );
  }
}

function closePromoModal() {
  const modal = document.getElementById("promo-modal");
  if (modal) {
    modal.classList.remove("active");
  }
}

window.onclick = function (event) {
  const modal = document.getElementById("promo-modal");
  if (event.target === modal) {
    closePromoModal();
  }
};

// ========== COPY FUNCTIONS ==========
function copyAddress() {
  const addressField = document.querySelector(".address-field");
  if (addressField) {
    addressField.select();
    document.execCommand("copy");
    showNotification("Address copied to clipboard!");
  }
}

function copyPromoCode() {
  // Try new UI structure first, then fall back to old structure
  const codeTexts = document.querySelectorAll(".promo-code-section .code-text");
  let codeText = codeTexts.length > 0 ? codeTexts[0].textContent?.trim() : null;

  // Fallback to old structure
  if (!codeText) {
    codeText =
      document.querySelector(".code-display .code-text")?.textContent?.trim() ||
      "LUX123456";
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(codeText)
      .then(() => {
        showNotification("Promo code copied!");
      })
      .catch(() => {
        fallbackCopy(codeText);
      });
  } else {
    fallbackCopy(codeText);
  }
}

function copyPromoLink() {
  // Try new UI structure first
  const codeTexts = document.querySelectorAll(".promo-code-section .code-text");
  let linkText =
    codeTexts.length >= 2 ? codeTexts[1].textContent?.trim() : null;

  // Fallback to old structure
  if (!linkText) {
    const linkTexts = document.querySelectorAll(".code-display .code-text");
    linkText = (
      linkTexts.length >= 2
        ? linkTexts[1].textContent
        : "luxwin.com/ref/LUX123456"
    ).trim();
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(linkText)
      .then(() => {
        showNotification("Promo link copied!");
      })
      .catch(() => {
        fallbackCopy(linkText);
      });
  } else {
    fallbackCopy(linkText);
  }
}

function copyEmail() {
  const email = "support@luxwin.com";
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(email)
      .then(() => {
        showNotification("Email copied!");
      })
      .catch(() => {
        fallbackCopy(email);
      });
  } else {
    fallbackCopy(email);
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand("copy");
    showNotification("Copied to clipboard!");
  } catch (err) {
    showNotification("Failed to copy");
  }

  document.body.removeChild(textarea);
}

function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  if (input) {
    input.type = input.type === "password" ? "text" : "password";
  }
}

function setWithdrawPercent(percent) {
  const balanceElement = document.querySelector(".withdraw-balance-amount");
  const amountInput = document.getElementById("withdraw-amount");
  if (balanceElement && amountInput) {
    const balanceText = balanceElement.textContent.replace(/[$,]/g, "");
    const balance = parseFloat(balanceText) || 0;
    const amount = ((balance * percent) / 100).toFixed(2);
    amountInput.value = amount;
    // Trigger summary update
    updateWithdrawalSummary();
  }
}

// ========== WITHDRAWAL SUMMARY UPDATE ==========
async function updateWithdrawalSummary() {
  const amountInput = document.getElementById("withdraw-amount");
  const summaryAmount = document.getElementById("withdrawSummaryAmount");
  const summaryFee = document.getElementById("withdrawSummaryFee");
  const summaryReceive = document.getElementById("withdrawSummaryReceive");

  if (!amountInput || !summaryAmount || !summaryFee || !summaryReceive) {
    return;
  }

  const amount = parseFloat(amountInput.value);

  // If no amount or invalid, show dashes
  if (!amount || isNaN(amount) || amount <= 0) {
    summaryAmount.textContent = "—";
    summaryFee.textContent = "—";
    summaryReceive.textContent = "—";
    return;
  }

  // Fetch VIP-based fee from backend
  try {
    const response = await apiRequest(`/wallet/withdrawal-fee-preview?amount=${amount}`);

    if (response.success && response.data) {
      const { fee, net_amount, fee_percent } = response.data;

      // Update display with backend-calculated values
      summaryAmount.textContent = `$${amount.toFixed(2)}`;
      summaryFee.textContent = `$${fee.toFixed(2)} (${fee_percent}%)`;
      summaryReceive.textContent = `$${net_amount.toFixed(2)}`;
    } else {
      // Fallback to default 10% if API fails
      const feePercent = 10;
      const fee = parseFloat(((amount * feePercent) / 100).toFixed(2));
      const netAmount = parseFloat((amount - fee).toFixed(2));

      summaryAmount.textContent = `$${amount.toFixed(2)}`;
      summaryFee.textContent = `$${fee.toFixed(2)}`;
      summaryReceive.textContent = `$${netAmount.toFixed(2)}`;
    }
  } catch (error) {
    console.error('[WITHDRAWAL] Failed to fetch fee preview:', error);

    // Fallback to default 10% if API fails
    const feePercent = 10;
    const fee = parseFloat(((amount * feePercent) / 100).toFixed(2));
    const netAmount = parseFloat((amount - fee).toFixed(2));

    summaryAmount.textContent = `$${amount.toFixed(2)}`;
    summaryFee.textContent = `$${fee.toFixed(2)}`;
    summaryReceive.textContent = `$${netAmount.toFixed(2)}`;
  }
}




// ========== TRANSACTION TAB SWITCHING ==========
function switchTab(event, tabId) {
  // Update active tab styling
  const tabs = document.querySelectorAll('.tx-filter-btn');
  tabs.forEach(tab => tab.classList.remove('active'));
  event.target.classList.add('active');

  console.log('[TRANSACTIONS] Switching to tab:', tabId);

  // Load transactions based on selected tab
  loadTransactions(tabId);
}

function switchBetTab(event, tabId) {
  const tabs = document.querySelectorAll(".bet-filter-btn");
  tabs.forEach((tab) => tab.classList.remove("active"));
  event.target.classList.add("active");

  // Load bet history with filter
  loadBetHistoryScreen(1, tabId);
}


// ========== NOTIFICATION SYSTEM ==========
function showNotification(message) {
  const existingNotification = document.querySelector(".notification");
  if (existingNotification) {
    existingNotification.remove();
  }

  const notification = document.createElement("div");
  notification.className = "notification";
  notification.textContent = message;
  notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #8b5cf6, #6d28d9);
        color: white;
        padding: 15px 25px;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(139, 92, 246, 0.5);
        z-index: 9999;
        font-size: 14px;
        font-weight: 600;
        animation: slideDown 0.3s ease;
        max-width: 90%;
    `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideUp 0.3s ease";
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 2000);
}

const style = document.createElement("style");
style.textContent = `
    @keyframes slideDown {
        from {
            transform: translate(-50%, -100%);
            opacity: 0;
        }
        to {
            transform: translate(-50%, 0);
            opacity: 1;
        }
    }

    @keyframes slideUp {
        from {
            transform: translate(-50%, 0);
            opacity: 1;
        }
        to {
            transform: translate(-50%, -100%);
            opacity: 0;
        }
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// ========== LOADING ANIMATION ==========
function showLoading() {
  if (document.querySelector(".loader")) return;

  const loader = document.createElement("div");
  loader.className = "loader";
  loader.innerHTML = '<div class="spinner"></div>';
  loader.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(5px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    `;

  const spinner = loader.querySelector(".spinner");
  spinner.style.cssText = `
        width: 50px;
        height: 50px;
        border: 4px solid rgba(139, 92, 246, 0.3);
        border-top: 4px solid var(--primary-purple);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    `;

  document.body.appendChild(loader);
}

function hideLoading() {
  // Remove all loaders to prevent duplicates
  document.querySelectorAll(".loader").forEach((loader) => loader.remove());
}

// ========== BUTTON INTERACTIONS ==========
// Removed old initialization - replaced with unified version below

// ========== SCROLL EFFECTS ==========
window.addEventListener("scroll", function () {
  const header = document.querySelector(".header");
  if (header) {
    if (window.scrollY > 50) {
      header.style.boxShadow = "0 4px 20px rgba(139, 92, 246, 0.3)";
    } else {
      header.style.boxShadow = "none";
    }
  }
});

console.log(
  "%c🎮 LuxWin Connected",
  "color: #8b5cf6; font-size: 24px; font-weight: bold;",
);
console.log(
  "%cFrontend connected to backend APIs",
  "color: #10b981; font-size: 14px;",
);

// ========== RED ENVELOPE FUNCTIONS ==========
let currentEnvelope = null;

async function loadActiveEnvelope() {
  const potliAmount = document.getElementById("potliAmount");
  const claimBtn = document.getElementById("claimEnvelopeBtn");
  const potliStatus = document.getElementById("potliStatus");
  const potliWrapper = document.querySelector(".potli-wrapper");

  // Reset UI
  potliAmount.textContent = "$0";
  claimBtn.disabled = true;
  claimBtn.textContent = "Claim";
  potliStatus.textContent = "";
  potliStatus.className = "potli-status";
  potliWrapper.classList.remove("claimed");

  // Check if logged in
  if (!isLoggedIn()) {
    potliStatus.textContent = "Login to claim rewards";
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/red-envelope/active`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    const data = await response.json();

    if (!data.success || !data.data) {
      potliStatus.textContent = "No active rewards available";
      return;
    }

    currentEnvelope = data.data;

    // Display amount
    potliAmount.textContent = `$${parseFloat(currentEnvelope.amount).toFixed(0)}`;

    // Check claim status
    if (currentEnvelope.isClaimed) {
      claimBtn.disabled = true;
      claimBtn.textContent = "Claimed";
      potliStatus.textContent = "Already claimed";
      potliStatus.className = "potli-status";
      potliWrapper.classList.add("claimed");
    } else if (!currentEnvelope.isEligible) {
      claimBtn.disabled = true;
      potliStatus.textContent =
        currentEnvelope.eligibilityMessage || "Not eligible";
    } else {
      claimBtn.disabled = false;
      potliStatus.textContent = "Tap to claim your reward!";
    }
  } catch (error) {
    console.error("Error loading envelope:", error);
    potliStatus.textContent = "Failed to load rewards";
    potliStatus.className = "potli-status error";
  }
}

async function claimRedEnvelope() {
  const claimBtn = document.getElementById("claimEnvelopeBtn");
  const potliStatus = document.getElementById("potliStatus");
  const potliWrapper = document.querySelector(".potli-wrapper");

  if (!currentEnvelope || !currentEnvelope.code) {
    showNotification("No envelope to claim", "error");
    return;
  }

  if (!isLoggedIn()) {
    showNotification("Please login to claim", "error");
    navigateTo("login-screen");
    return;
  }

  // Prevent double-click
  if (claimBtn.disabled) return;
  claimBtn.disabled = true;
  claimBtn.textContent = "Claiming...";

  try {
    const response = await fetch(`${API_BASE_URL}/red-envelope/claim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ code: currentEnvelope.code }),
    });

    const data = await response.json();

    if (data.success) {
      // Success animation
      potliWrapper.classList.add("claimed");
      claimBtn.textContent = "Claimed";
      potliStatus.textContent = `+$${data.data.amount.toFixed(2)} added to wallet!`;
      potliStatus.className = "potli-status success";

      // Update balance
      if (data.data.new_balance !== undefined) {
        currentBalance = data.data.new_balance;
        updateBalanceDisplay();
      }

      showNotification(
        `🧧 Red Envelope Reward +$${data.data.amount.toFixed(2)}`,
        "success",
      );

      // Mark as claimed locally
      currentEnvelope.isClaimed = true;
    } else {
      claimBtn.disabled = false;
      claimBtn.textContent = "Claim";
      potliStatus.textContent = data.message || "Claim failed";
      potliStatus.className = "potli-status error";
      showNotification(data.message || "Failed to claim", "error");
    }
  } catch (error) {
    console.error("Error claiming envelope:", error);
    claimBtn.disabled = false;
    claimBtn.textContent = "Claim";
    potliStatus.textContent = "Network error. Try again.";
    potliStatus.className = "potli-status error";
    showNotification("Network error", "error");
  }
}

window.addEventListener("beforeunload", () => {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
});

window.addEventListener("error", (e) => {
  console.error("Global error:", e.error);
  if (!e.error?.message?.includes("Unauthorized")) {
    showNotification("An error occurred. Please try again.");
  }
});

// ========== INFO TOOLTIP FUNCTIONS ==========
function toggleInfoTooltip(event, tooltipId) {
  event.stopPropagation();

  // Close all other tooltips first
  document.querySelectorAll(".info-tooltip.active").forEach((tooltip) => {
    if (tooltip.id !== tooltipId) {
      tooltip.classList.remove("active");
    }
  });

  const tooltip = document.getElementById(tooltipId);
  if (tooltip) {
    tooltip.classList.toggle("active");
  }
}

// Close tooltips when clicking outside
document.addEventListener("click", (e) => {
  if (!e.target.closest(".info-tooltip-wrapper")) {
    document.querySelectorAll(".info-tooltip.active").forEach((tooltip) => {
      tooltip.classList.remove("active");
    });
  }
});

// Close tooltips on scroll
document.addEventListener(
  "scroll",
  () => {
    document.querySelectorAll(".info-tooltip.active").forEach((tooltip) => {
      tooltip.classList.remove("active");
    });
  },
  true,
);

// ========== TOP EARNERS - REAL DATA FROM DATABASE ==========
function startTopEarnersFeed() {
  const container = document.getElementById("topEarnersFeed");
  if (!container) return;

  // Load real data from database
  loadTopEarners(container);

  // Refresh every 30 seconds with real data
  if (topEarnersInterval) clearInterval(topEarnersInterval);
  topEarnersInterval = setInterval(() => {
    loadTopEarners(container);
  }, 30000);
}

async function loadTopEarners(container) {
  // Static fake top 5 earners data (descending order)
  const fakeTopEarners = [
    { rank: 1, email: "aar****@gmail.com", amount: 9845320, medal: "🥇" },
    { rank: 2, email: "vik****@gmail.com", amount: 7412890, medal: "🥈" },
    { rank: 3, email: "roy****@gmail.com", amount: 5978450, medal: "🥉" },
    { rank: 4, email: "sam****@gmail.com", amount: 3664210, medal: "" },
    { rank: 5, email: "leo****@gmail.com", amount: 1892775, medal: "" }
  ];

  container.innerHTML = fakeTopEarners
    .map(
      (earner) => `
      <div class="earner-row">
          <span class="earner-rank">${earner.rank}</span>
          <span class="earner-name">${earner.email}${earner.medal ? ' ' + earner.medal : ''}</span>
          <span class="earner-amount">$${earner.amount.toLocaleString()}</span>
      </div>
  `,
    )
    .join("");
}

function maskEmail(email) {
  if (!email || email.length < 4) return "****";
  return email.substring(0, 4) + "****";
}

// ========== LIVE WINNERS - REAL DATA FROM DATABASE ==========
function startLiveWinnersFeed() {
  const container = document.getElementById("liveWinnersFeed");
  if (!container) return;

  // Load real recent winners
  loadLiveWinners(container);

  // Refresh every 15 seconds with real data
  if (liveWinnersInterval) clearInterval(liveWinnersInterval);
  liveWinnersInterval = setInterval(() => {
    loadLiveWinners(container);
  }, 15000);
}

async function loadLiveWinners(container) {
  try {
    // Try to fetch real recent winners from API
    const response = await fetch(`${API_BASE_URL}/game/recent-winners?limit=5`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data && data.data.length > 0) {
        container.innerHTML = data.data
          .map(
            (winner) => `
            <div class="winner-item">
                <span class="winner-dot ${winner.choice || "green"}"></span>
                <span class="winner-name">${maskEmail(winner.email || "user")}</span>
                <span class="winner-text">won</span>
                <span class="winner-amount">$${parseFloat(winner.payout || 0).toFixed(0)}</span>
                <span class="winner-time">${formatWinTime(winner.created_at)}</span>
            </div>
        `,
          )
          .join("");
        return;
      }
    }
  } catch (error) {
    console.log("Live winners API not available");
  }

  // Show placeholder if no real data
  container.innerHTML = `
    <p style="text-align: center; color: rgba(148, 163, 184, 0.5); padding: 10px; font-size: 12px;">
      No recent winners yet
    </p>
  `;
}

function formatWinTime(timestamp) {
  if (!timestamp) return getCurrentTime();
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ========== TASK 8: BET AMOUNT SELECTION MODAL ==========
let selectedBetAmount = 10; // Default bet amount

function showBetModal(betType, betValue, displayText) {
  if (betModalOpen) return;
  if (!isLoggedIn()) {
    showLoginModal("place a bet");
    return;
  }
  if (betPlacedThisRound) {
    showNotification("You already placed a bet this round");
    return;
  }

  betModalOpen = true;
  selectedBetType = betType;
  selectedBetValue = betValue;
  selectedBetAmount = 10;

  // Update the modal display
  const selectionText = document.getElementById("bet-modal-selection-text");
  if (selectionText) {
    selectionText.textContent = displayText;
  }

  // Reset chips and custom input
  document
    .querySelectorAll(".bet-chip")
    .forEach((c) => c.classList.remove("selected"));
  const firstChip = document.querySelector(".bet-chip");
  if (firstChip) firstChip.classList.add("selected");

  const customInput = document.getElementById("bet-custom-amount");
  if (customInput) customInput.value = "";

  // Show the modal
  const overlay = document.getElementById("bet-modal-overlay");
  if (overlay) {
    overlay.classList.add("active");
  }
}

function selectBetChip(amount) {
  selectedBetAmount = amount;
  document
    .querySelectorAll(".bet-chip")
    .forEach((c) => c.classList.remove("selected"));
  event.target.classList.add("selected");
  const customInput = document.getElementById("bet-custom-amount");
  if (customInput) customInput.value = "";
}

function closeBetModal() {
  const overlay = document.getElementById("bet-modal-overlay");
  if (overlay) {
    overlay.classList.remove("active");
  }
  betModalOpen = false;
  selectedBetType = null;
  selectedBetValue = null;
}



// ========================================
// INITIALIZE APP ON DOM READY
// ========================================
document.addEventListener("DOMContentLoaded", function () {
  console.log("[APP] Initializing LuxWin application...");

  // Initialize AuthManager (production-grade authentication)
  authManager = initAuthManager(API_BASE_URL);

  // Set up AuthManager event listeners
  authManager.on('stateChange', ({ oldState, newState }) => {
    console.log(`[AUTH] State changed: ${oldState} -> ${newState}`);
  });

  authManager.on('login', ({ user }) => {
    console.log('[AUTH] User logged in:', user.email);
    currentUser = user;
  });

  authManager.on('logout', ({ showMessage }) => {
    console.log('[AUTH] User logged out');
    currentUser = null;
    currentBalance = 0;
  });

  authManager.on('error', ({ type, message }) => {
    console.error(`[AUTH] Error (${type}):`, message);
    if (type === 'session_expired') {
      showNotification(message);
      navigateTo('login-screen');
    }
  });

  // Initialize UI based on auth state
  if (authManager.isAuthenticated()) {
    console.log('[APP] User is authenticated, loading data...');
    // Load user data ONCE, then navigate
    loadUserData().then(() => {
      navigateTo('home-screen');
    }).catch((error) => {
      console.error('[APP] Failed to load user data:', error);
      // If data load fails, still show home screen but as guest
      navigateTo('login-screen');
    });
  } else {
    console.log('[APP] User not authenticated, showing login...');
    navigateTo('login-screen');
  }

  // Set up game button event handlers
  const colorButtons = document.querySelectorAll(".color-btn");
  colorButtons.forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      if (betPlacedThisRound) {
        showNotification("You already placed a bet this round");
        return;
      }
      const betType = "color";
      const betValue =
        this.dataset.color || this.textContent.toLowerCase().trim();
      showBetModal(betType, betValue, this.textContent.trim());
    });
  });

  const numberButtons = document.querySelectorAll(".number-btn");
  numberButtons.forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      if (betPlacedThisRound) {
        showNotification("You already placed a bet this round");
        return;
      }
      const betType = "number";
      const betValue = parseInt(this.dataset.num || this.textContent);
      showBetModal(betType, betValue, `Number ${betValue}`);
    });
  });

  // Set up auth form event handlers
  const loginForm = document.querySelector("#login-screen form");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin, { passive: false });
    console.log("[APP] Login form handler attached");
  }

  const registerForm = document.querySelector("#register-screen form");
  if (registerForm) {
    registerForm.addEventListener("submit", handleRegister, { passive: false });
    console.log("[APP] Register form handler attached");
  }

  // Set up other form handlers
  const withdrawForm = document.querySelector("#withdraw-screen form");
  if (withdrawForm) {
    withdrawForm.addEventListener("submit", (e) => {
      e.preventDefault();
      handleWithdraw();
    });
  }

  const securityCards = document.querySelectorAll(
    "#security-screen .security-card",
  );
  if (securityCards.length >= 2) {
    const btn1 = securityCards[0].querySelector(".btn-small");
    const btn2 = securityCards[1].querySelector(".btn-small");
    if (btn1)
      btn1.onclick = (e) => {
        e.preventDefault();
        handleChangePassword("login");
      };
    if (btn2)
      btn2.onclick = (e) => {
        e.preventDefault();
        handleChangePassword("withdrawal");
      };
  }

  // Start live feeds
  setTimeout(() => {
    startLiveWinnersFeed();
    startTopEarnersFeed();
  }, 1000);

  // Session checker - runs every minute
  setInterval(() => {
    if (authManager && authManager.isAuthenticated()) {
      authManager.checkSession();
    }
  }, 60000);

  console.log("[APP] Application initialized successfully");
});

// ========================================
// CONFIRM BET (Called from bet modal button)
// ========================================
function confirmBet(e) {
  // CRITICAL: Prevent form submission/page reload
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  console.log("[BET FLOW] confirmBet() called");

  // Get the selected amount from chips or custom input
  const customInput = document.getElementById("bet-custom-amount");
  const customAmount = customInput ? parseFloat(customInput.value) : 0;

  // Find which chip is selected (has 'selected' class)
  const selectedChip = document.querySelector(".bet-chip.selected");
  let amount = 0;

  if (customAmount > 0) {
    amount = customAmount;
  } else if (selectedChip) {
    // Extract amount from chip text (e.g., "$50" or "$1K")
    const chipText = selectedChip.textContent.trim();
    if (chipText.includes("K")) {
      amount = parseFloat(chipText.replace("$", "").replace("K", "")) * 1000;
    } else {
      amount = parseFloat(chipText.replace("$", ""));
    }
  }

  console.log("[BET FLOW] Selected amount:", amount);
  console.log("[BET FLOW] Selected type:", selectedBetType);
  console.log("[BET FLOW] Selected value:", selectedBetValue);

  if (!amount || amount <= 0) {
    showNotification("Please select or enter a bet amount");
    return;
  }

  // Close the bet modal
  const betModal = document.getElementById("bet-modal-overlay");
  if (betModal) {
    betModal.classList.remove("active");
  }

  // Place the bet with the selected amount
  console.log("[BET FLOW] Calling placeBetWithAmount with amount:", amount);
  placeBetWithAmount(amount);
}

// ========================================
// SELECT BET CHIP (Called when clicking amount chips)
// ========================================
function selectBetChip(amount) {
  // Remove 'selected' class from all chips
  const chips = document.querySelectorAll(".bet-chip");
  chips.forEach(chip => chip.classList.remove("selected"));

  // Add 'selected' class to clicked chip
  event.target.classList.add("selected");

  // Clear custom input
  const customInput = document.getElementById("bet-custom-amount");
  if (customInput) {
    customInput.value = "";
  }
}

// ========================================
// BET PLACEMENT WITH AMOUNT
// ========================================
async function placeBetWithAmount(amount) {
  console.log("[BET FLOW] placeBetWithAmount() called with amount:", amount);
  console.log("[BET FLOW] Current round:", currentRound);
  console.log("[BET FLOW] Selected bet type:", selectedBetType);
  console.log("[BET FLOW] Selected bet value:", selectedBetValue);

  if (!currentRound || !currentRound.round_number) {
    showNotification("Please wait for next round");
    return;
  }

  let choice = selectedBetValue;
  if (selectedBetType === "number") {
    const num = parseInt(selectedBetValue);
    if (num === 0) choice = "purple";
    else if (num % 2 === 0) choice = "red";
    else choice = "green";
  }

  console.log("[BET FLOW] Final choice for API:", choice);
  console.log("[BET FLOW] Final amount for API:", amount);

  requestInProgress = true;
  betPlacedThisRound = true;
  disableBetButtons();
  showLoading();

  // Safety timeout - force hide loader after 10000ms (10 seconds) to allow proper request completion
  const safetyTimeout = setTimeout(() => {
    console.warn("[BET FLOW] Safety timeout triggered - request took too long");
    hideLoading();
    requestInProgress = false;
  }, 10000);

  try {
    console.log("[BET FLOW] Sending API request to /game/bet");
    console.log("[BET FLOW] Request payload:", { choice, amount });

    const response = await apiRequest("/game/bet", {
      method: "POST",
      body: JSON.stringify({ choice, amount }),
    });

    console.log("[BET FLOW] API response received:", response);

    clearTimeout(safetyTimeout);
    const taxInfo = response.data?.tax_amount
      ? ` (Tax: $${response.data.tax_amount.toFixed(2)})`
      : "";
    showNotification(`Bet placed: $${amount}${taxInfo}`);

    // INSTANT UPDATE: Use new_balance from backend response (single source of truth)
    if (response.data?.new_balance !== undefined) {
      currentBalance = parseFloat(response.data.new_balance);
      console.log("Balance updated from backend response:", currentBalance);
    }

    // Update ALL balance displays immediately
    updateAllBalanceDisplays();

    // Reload bet history AND transaction history (async, non-blocking)
    loadBetHistory();
    loadTransactions();
  } catch (error) {
    clearTimeout(safetyTimeout);
    console.error("Bet error:", error);
    betPlacedThisRound = false;
    enableBetButtons();
    showNotification(error.message || "Failed to place bet. Please try again.");
  } finally {
    clearTimeout(safetyTimeout);
    requestInProgress = false;
    hideLoading();
    selectedBetType = null;
    selectedBetValue = null;
  }
}

// ========== TASK 10: RANDOM AVATAR GENERATOR ==========
function generateRandomAvatar() {
  const colors = [
    "#9333ea",
    "#7c3aed",
    "#6366f1",
    "#3b82f6",
    "#06b6d4",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#ec4899",
  ];

  // Generate consistent color based on user email (persistent per user)
  const email = currentUser?.email || "guest";
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % colors.length;
  const bgColor = colors[colorIndex];

  // Get first letter of email as initial
  const initial = email.charAt(0).toUpperCase();

  const avatarContainer = document.getElementById("userAvatar");
  if (avatarContainer) {
    avatarContainer.style.background = `linear-gradient(135deg, ${bgColor}, ${adjustColor(bgColor, -30)})`;
    avatarContainer.innerHTML = `<span style="color: white; font-size: 28px; font-weight: 700;">${initial}</span>`;
  }
}

function adjustColor(hex, amount) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const countryList = [
  { flag: "🇺🇸", code: "USA", name: "United States" },
  { flag: "🇮🇳", code: "IND", name: "India" },
  { flag: "🇬🇧", code: "GBR", name: "United Kingdom" },
  { flag: "🇨🇦", code: "CAN", name: "Canada" },
  { flag: "🇦🇺", code: "AUS", name: "Australia" },
  { flag: "🇹🇭", code: "THA", name: "Thailand" },
  { flag: "🇧🇷", code: "BRA", name: "Brazil" },
  { flag: "🇩🇪", code: "DEU", name: "Germany" },
  { flag: "🇫🇷", code: "FRA", name: "France" },
  { flag: "🇯🇵", code: "JPN", name: "Japan" },
  { flag: "🇰🇷", code: "KOR", name: "South Korea" },
  { flag: "🇸🇬", code: "SGP", name: "Singapore" },
  { flag: "🇵🇭", code: "PHL", name: "Philippines" },
  { flag: "🇮🇩", code: "IDN", name: "Indonesia" },
  { flag: "🇲🇾", code: "MYS", name: "Malaysia" },
  { flag: "🇻🇳", code: "VNM", name: "Vietnam" },
  { flag: "🇳🇬", code: "NGA", name: "Nigeria" },
  { flag: "🇿🇦", code: "ZAF", name: "South Africa" },
  { flag: "🇦🇪", code: "ARE", name: "UAE" },
  { flag: "🇲🇽", code: "MEX", name: "Mexico" },
];

function toggleCountryDropdown() {
  const dropdown = document.getElementById("countryDropdown");
  if (dropdown) {
    dropdown.classList.toggle("active");
  }
}

function selectCountry(code) {
  const country = countryList.find((c) => c.code === code);
  if (!country) return;

  // Update display
  const flagEl = document.getElementById("countryFlag");
  const codeEl = document.getElementById("countryCode");
  if (flagEl) flagEl.textContent = country.flag;
  if (codeEl) codeEl.textContent = country.code;

  // Close dropdown
  const dropdown = document.getElementById("countryDropdown");
  if (dropdown) dropdown.classList.remove("active");

  // Persist to localStorage
  localStorage.setItem("userCountry", code);
  showNotification(`Country updated to ${country.name}`);
}

function updateAccountCountry() {
  // Get saved country or default
  const savedCountry =
    localStorage.getItem("userCountry") || currentUser?.country || "USA";
  let country = countryList.find(
    (c) =>
      c.code === savedCountry ||
      c.code.toLowerCase().includes(savedCountry.toLowerCase().substring(0, 2)),
  );
  if (!country) country = countryList[0];

  const flagEl = document.getElementById("countryFlag");
  const codeEl = document.getElementById("countryCode");

  if (flagEl) flagEl.textContent = country.flag;
  if (codeEl) codeEl.textContent = country.code;
}

// Start feeds when page loads
// Realtime feeds initialization moved to main DOMContentLoaded listener above

// Reinitialize feeds when navigating
const originalNavigateTo = window.navigateTo || function () { };
window.navigateTo = function (screenId) {
  originalNavigateTo(screenId);

  if (screenId === "fun-screen") {
    setTimeout(startTopEarnersFeed, 100);
  }
  if (screenId === "home-screen") {
    setTimeout(startLiveWinnersFeed, 100);
  }
  if (screenId === "account-screen") {
    setTimeout(() => {
      generateRandomAvatar();
      updateAccountCountry();
    }, 100);
  }
  if (screenId === "transactions-screen") {
    setTimeout(() => loadTransactions(), 100);
  }
};

// ========== MINI RESULT HISTORY FUNCTIONS ==========

// Price is the round number itself (system-generated game identifier)
// No need for fake generation - backend provides actual round_number

// Get color based on result number (following existing game logic)
function getResultColor(resultNumber) {
  const num = parseInt(resultNumber);
  if (num === 0) {
    return "red-violet"; // 0 = Red + Violet
  } else if (num === 5) {
    return "green-violet"; // 5 = Green + Violet
  } else if (num % 2 === 0) {
    return "red"; // 2,4,6,8 = Red
  } else {
    return "green"; // 1,3,7,9 = Green
  }
}

// Load mini result history from API
async function loadMiniResultHistory() {
  const bodyEl = document.getElementById("miniResultBody");
  if (!bodyEl) return;

  // Game results are public system data - no authentication required
  try {
    // Show loading only if no data exists
    if (!miniResultTotalData || miniResultTotalData.length === 0) {
      bodyEl.innerHTML = '<div class="mini-result-loading">Loading...</div>';
    }

    // Fetch from API - get more data for pagination
    const response = await apiRequest("/game/results?limit=100");

    // Handle response - check if data is nested or direct
    let resultsData = null;
    if (response.success) {
      // Try response.data first, then response itself
      resultsData = response.data || response;

      // If resultsData is an object with a data property, use that
      if (resultsData && typeof resultsData === 'object' && resultsData.data && Array.isArray(resultsData.data)) {
        resultsData = resultsData.data;
      }
    }

    if (resultsData && Array.isArray(resultsData) && resultsData.length > 0) {
      // Update state with new data
      miniResultTotalData = resultsData;

      // Safeguard: Reset to page 1 if current page exceeds total pages
      const totalPages = Math.ceil(miniResultTotalData.length / miniResultPerPage);
      if (miniResultCurrentPage > totalPages && totalPages > 0) {
        miniResultCurrentPage = 1;
      }

      renderMiniResultPage();
    } else {
      // Only clear if we have no existing data
      if (!miniResultTotalData || miniResultTotalData.length === 0) {
        bodyEl.innerHTML =
          '<div class="mini-result-empty">No results available</div>';
        updateMiniResultPagination(0);
      }
    }
  } catch (error) {
    console.error("Error loading mini result history:", error);
    // Don't clear existing data on error, just log it
    if (!miniResultTotalData || miniResultTotalData.length === 0) {
      bodyEl.innerHTML =
        '<div class="mini-result-empty">Failed to load results</div>';
      updateMiniResultPagination(0);
    }
  }
}

// Render current page of mini results
function renderMiniResultPage() {
  const bodyEl = document.getElementById("miniResultBody");
  if (!bodyEl || !miniResultTotalData || !miniResultTotalData.length) {
    if (bodyEl) {
      bodyEl.innerHTML =
        '<div class="mini-result-empty">No results available</div>';
    }
    updateMiniResultPagination(0);
    return;
  }

  const startIdx = (miniResultCurrentPage - 1) * miniResultPerPage;
  const endIdx = startIdx + miniResultPerPage;
  const pageData = miniResultTotalData.slice(startIdx, endIdx);

  // Safeguard: If page data is empty but total data exists, reset to page 1
  if (pageData.length === 0 && miniResultTotalData.length > 0) {
    console.log('[RECORD] Page data empty but total exists, resetting to page 1');
    miniResultCurrentPage = 1;
    // Re-render with page 1
    renderMiniResultPage();
    return;
  }

  if (pageData.length === 0) {
    bodyEl.innerHTML =
      '<div class="mini-result-empty">No results available</div>';
    updateMiniResultPagination(0);
    return;
  }

  let html = "";
  pageData.forEach((result) => {
    const resultNum =
      result.result_number !== null && result.result_number !== undefined
        ? result.result_number
        : "-";
    // Use actual round_number as price (system game identifier)
    const price = result.round_number || "-";
    const colorClass = resultNum !== "-" ? getResultColor(resultNum) : "";

    html += `
      <div class="mini-result-row">
        <span class="result-period">#${result.round_number}</span>
        <span class="result-price">${price}</span>
        <span class="result-num">${resultNum}</span>
        <span class="result-color-cell">
          ${colorClass ? `<span class="result-color-dot ${colorClass}"></span>` : "-"}
        </span>
      </div>
    `;
  });

  bodyEl.innerHTML = html;
  updateMiniResultPagination(miniResultTotalData.length);
}

// Update pagination info and button states
function updateMiniResultPagination(total) {
  const infoEl = document.getElementById("miniResultPaginationInfo");
  const prevBtn = document.getElementById("miniResultPrevBtn");
  const nextBtn = document.getElementById("miniResultNextBtn");

  if (!infoEl) return;

  const startIdx =
    total > 0 ? (miniResultCurrentPage - 1) * miniResultPerPage + 1 : 0;
  const endIdx = Math.min(miniResultCurrentPage * miniResultPerPage, total);

  infoEl.textContent = `${startIdx}-${endIdx} of ${total}`;

  if (prevBtn) {
    prevBtn.disabled = miniResultCurrentPage <= 1;
  }
  if (nextBtn) {
    const totalPages = Math.ceil(total / miniResultPerPage);
    nextBtn.disabled = miniResultCurrentPage >= totalPages;
  }
}

// Pagination controls
function miniResultPrevPage() {
  if (miniResultCurrentPage > 1) {
    miniResultCurrentPage--;
    renderMiniResultPage();
  }
}

function miniResultNextPage() {
  const totalPages = Math.ceil(miniResultTotalData.length / miniResultPerPage);
  if (miniResultCurrentPage < totalPages) {
    miniResultCurrentPage++;
    renderMiniResultPage();
  }
}

// ========== BET HISTORY PAGINATION ==========
function updateBetHistoryPagination() {
  const infoEl = document.getElementById("betHistoryPaginationInfo");
  const prevBtn = document.getElementById("betHistoryPrevBtn");
  const nextBtn = document.getElementById("betHistoryNextBtn");

  if (!infoEl) return;

  const startIdx = betHistoryTotal > 0 ? (betHistoryCurrentPage - 1) * 5 + 1 : 0;
  const endIdx = Math.min(betHistoryCurrentPage * 5, betHistoryTotal);

  infoEl.textContent = `${startIdx}-${endIdx} of ${betHistoryTotal}`;

  if (prevBtn) {
    prevBtn.disabled = betHistoryCurrentPage <= 1;
  }
  if (nextBtn) {
    nextBtn.disabled = betHistoryCurrentPage >= betHistoryTotalPages;
  }
}

function betHistoryPrevPage() {
  if (betHistoryCurrentPage > 1) {
    loadBetHistory(betHistoryCurrentPage - 1);
  }
}

function betHistoryNextPage() {
  if (betHistoryCurrentPage < betHistoryTotalPages) {
    loadBetHistory(betHistoryCurrentPage + 1);
  }
}

// ========== BET HISTORY SCREEN (ACCOUNT PAGE) PAGINATION ==========
function updateBetHistoryFullPagination() {
  const infoEl = document.getElementById('betHistoryFullPaginationInfo');
  const prevBtn = document.getElementById('betHistoryFullPrevBtn');
  const nextBtn = document.getElementById('betHistoryFullNextBtn');

  if (!infoEl) return;

  const startIdx = betHistoryFullTotal > 0 ? (betHistoryFullCurrentPage - 1) * 10 + 1 : 0;
  const endIdx = Math.min(betHistoryFullCurrentPage * 10, betHistoryFullTotal);

  infoEl.textContent = `${startIdx}-${endIdx} of ${betHistoryFullTotal}`;

  if (prevBtn) {
    prevBtn.disabled = betHistoryFullCurrentPage <= 1;
  }
  if (nextBtn) {
    nextBtn.disabled = betHistoryFullCurrentPage >= betHistoryFullTotalPages;
  }
}

function betHistoryFullPrevPage() {
  if (betHistoryFullCurrentPage > 1) {
    loadBetHistoryScreen(betHistoryFullCurrentPage - 1, betHistoryFullCurrentFilter);
  }
}

function betHistoryFullNextPage() {
  if (betHistoryFullCurrentPage < betHistoryFullTotalPages) {
    loadBetHistoryScreen(betHistoryFullCurrentPage + 1, betHistoryFullCurrentFilter);
  }
}

// ========== WALLET ADDRESS MANAGEMENT ==========
let cachedWalletAddress = null;

// Fetch wallet address from backend API
async function fetchWalletAddress() {
  try {
    const response = await fetch(`${API_BASE_URL}/config/wallet`);
    const data = await response.json();

    if (data.success && data.data && data.data.address) {
      cachedWalletAddress = data.data.address;
      return data.data.address;
    } else {
      console.error('Failed to fetch wallet address:', data.message);
      return null;
    }
  } catch (error) {
    console.error('Error fetching wallet address:', error);
    return null;
  }
}

// Load wallet address when navigating to add-funds screen
async function loadWalletAddress() {
  const displayElement = document.getElementById('walletAddressDisplay');
  if (!displayElement) return;

  // Show loading state
  displayElement.textContent = 'Loading...';

  // Fetch address from API
  const address = await fetchWalletAddress();

  if (address) {
    displayElement.textContent = address;
  } else {
    displayElement.textContent = 'Address unavailable';
    showNotification('Failed to load wallet address');
  }
}

// Copy wallet address to clipboard
async function copyWalletAddress() {
  const address = cachedWalletAddress || await fetchWalletAddress();

  if (!address) {
    showNotification('Wallet address not available');
    return;
  }

  try {
    await navigator.clipboard.writeText(address);
    showNotification('Wallet address copied!');
  } catch (error) {
    console.error('Failed to copy address:', error);
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = address;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showNotification('Wallet address copied!');
    } catch (err) {
      showNotification('Failed to copy address');
    }
    document.body.removeChild(textArea);
  }
}

// ========== LAST DEPOSIT DISPLAY ==========
async function loadLastDeposit() {
  console.log('[LAST DEPOSIT] Loading last deposit...');
  const container = document.getElementById('lastDepositContainer');
  if (!container || !isLoggedIn()) {
    console.log('[LAST DEPOSIT] Container not found or user not logged in');
    if (container) {
      container.innerHTML = `
        <p style="text-align: center; color: rgba(148, 163, 184, 0.6); padding: 15px;">
          Login to view deposit history
        </p>
      `;
    }
    return;
  }

  // Show loading state
  container.innerHTML = `
    <p style="text-align: center; color: rgba(148, 163, 184, 0.6); padding: 15px;">
      Loading...
    </p>
  `;

  try {
    // Fetch recharge history from dedicated endpoint
    // Add cache-busting timestamp to ensure fresh data
    const timestamp = new Date().getTime();
    console.log('[LAST DEPOSIT] Fetching recharge history with timestamp:', timestamp);
    const data = await apiRequest(`/wallet/recharge-history?_t=${timestamp}`);
    const recharges = data.data || [];

    console.log('[LAST DEPOSIT] Received recharges:', recharges.length);
    if (recharges.length > 0) {
      console.log('[LAST DEPOSIT] Most recent recharge:', {
        id: recharges[0].id,
        amount: recharges[0].amount,
        status: recharges[0].status,
        created_at: recharges[0].created_at
      });
    }

    if (recharges.length === 0) {
      // Show "no deposits" message
      console.log('[LAST DEPOSIT] No deposits found');
      container.innerHTML = `
        <p style="text-align: center; color: rgba(148, 163, 184, 0.6); padding: 15px;">
          No recent deposits found.
        </p>
      `;
      return;
    }

    // Get most recent recharge (backend already sorts by created_at DESC)
    const lastDeposit = recharges[0];

    // Format status
    const statusMap = {
      'pending': 'Pending',
      'completed': 'Completed',
      'rejected': 'Rejected',
      'approved': 'Completed',
      'recharge_approved': 'Completed'
    };
    const status = statusMap[lastDeposit.status?.toLowerCase()] || lastDeposit.status || 'Pending';

    // Determine status color
    const statusColor = status === 'Completed' ? 'green' :
      status === 'Rejected' ? 'red' :
        'yellow';

    // Format date
    const date = new Date(lastDeposit.created_at);
    const formattedDate = date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Get amount
    const amount = parseFloat(lastDeposit.amount) || 0;

    console.log('[LAST DEPOSIT] Displaying:', {
      amount,
      status,
      formattedDate
    });

    // Render with proper styling
    container.innerHTML = `
      <div class="last-deposit-header">
        <span class="warning-icon">💰</span>
        <span>Last Deposit: 
          <strong class="yellow">$${amount.toFixed(2)}</strong> USD
        </span>
      </div>
      <p class="last-deposit-status" style="margin: 8px 0; font-size: 13px;">
        Status: <span class="${statusColor}" style="font-weight: 600;">${status}</span>
      </p>
      <p class="last-deposit-time" style="margin: 8px 0; font-size: 12px; color: rgba(148, 163, 184, 0.7);">
        Time: ${formattedDate}
      </p>
    `;
    console.log('[LAST DEPOSIT] Display updated successfully');
  } catch (error) {
    console.error('[LAST DEPOSIT] Failed to load last deposit:', error);
    container.innerHTML = `
      <p style="text-align: center; color: rgba(239, 68, 68, 0.8); padding: 15px; font-size: 13px;">
        Failed to load deposit history
      </p>
    `;
  }
}

// Update the navigateTo function to load wallet address when needed
const originalNavigateToFunc = window.navigateTo;
window.navigateTo = function (screenId) {
  // Call original navigation
  if (originalNavigateToFunc) {
    originalNavigateToFunc(screenId);
  }

  // Load wallet address when navigating to add-funds screen
  if (screenId === 'add-funds-screen') {
    setTimeout(() => {
      loadWalletAddress();
      loadLastDeposit();
    }, 100);
  }

  // Reset and setup withdrawal summary when navigating to withdraw screen
  if (screenId === 'withdraw-screen') {
    setTimeout(() => {
      // Reset summary to dashes
      updateWithdrawalSummary();

      // Add event listener to withdrawal amount input if not already added
      const amountInput = document.getElementById('withdraw-amount');
      if (amountInput && !amountInput.dataset.listenerAdded) {
        amountInput.addEventListener('input', updateWithdrawalSummary);
        amountInput.dataset.listenerAdded = 'true';
      }
    }, 100);
  }

  // Keep existing navigation handlers
  if (screenId === "fun-screen") {
    setTimeout(startTopEarnersFeed, 100);
  }
  if (screenId === "home-screen") {
    setTimeout(startLiveWinnersFeed, 100);
  }
  if (screenId === "account-screen") {
    setTimeout(() => {
      generateRandomAvatar();
      updateAccountCountry();
    }, 100);
  }
  if (screenId === "transactions-screen") {
    setTimeout(() => loadTransactions(), 100);
  }
};

// ========== TRANSACTION TAB SWITCHING ==========
window.switchTab = function (event, type) {
  // Update active tab UI
  const tabs = document.querySelectorAll('.tx-filter-btn');
  tabs.forEach(tab => tab.classList.remove('active'));
  if (event && event.target) {
    event.target.classList.add('active');
  }

  // Load transactions for the selected type
  console.log(`[TRANSACTIONS] Switching to tab: ${type}`);
  loadTransactions(type);
};

// ========== VIP SYSTEM ==========

// VIP Levels Configuration (must match backend)
const VIP_LEVELS = [
  { level: 0, threshold: 0, bonus: 0, withdrawalFee: 10.0 },
  { level: 1, threshold: 500, bonus: 5, withdrawalFee: 8.0 },
  { level: 2, threshold: 2000, bonus: 10, withdrawalFee: 6.0 },
  { level: 3, threshold: 10000, bonus: 20, withdrawalFee: 4.0 },
  { level: 4, threshold: 50000, bonus: 50, withdrawalFee: 3.0 },
  { level: 5, threshold: 100000, bonus: 100, withdrawalFee: 2.0 },
];

// Open VIP Modal
function openVIPModal() {
  const overlay = document.getElementById('vipModalOverlay');
  const modal = document.getElementById('vipModal');

  if (overlay && modal) {
    overlay.classList.add('active');
    modal.classList.add('active');

    // Load VIP data
    loadVIPData();
  }
}

// Close VIP Modal
function closeVIPModal() {
  const overlay = document.getElementById('vipModalOverlay');
  const modal = document.getElementById('vipModal');

  if (overlay && modal) {
    overlay.classList.remove('active');
    modal.classList.remove('active');
  }
}

// Load VIP Data from API
async function loadVIPData() {
  if (!isLoggedIn()) {
    showNotification('Please login to view VIP status');
    closeVIPModal();
    return;
  }

  try {
    const response = await apiRequest('/vip/status');

    if (response.success && response.data) {
      updateVIPUI(response.data);
    } else {
      showNotification('Failed to load VIP status');
    }
  } catch (error) {
    console.error('Error loading VIP data:', error);
    showNotification('Failed to load VIP status');
  }
}

// Update VIP UI with data
function updateVIPUI(data) {
  const {
    current_level,
    total_wager,
    next_level,
    required_for_next,
    progress_percentage,
    pending_vip_bonus,
    current_benefits,
    next_benefits,
    all_levels
  } = data;

  // Update badge
  const badge = document.getElementById('vipBadge');
  if (badge) {
    badge.textContent = `VIP ${current_level}`;
  }

  // Update status card
  const vipLevelElement = document.getElementById('vipCurrentLevel');
  const vipBadgeContainer = document.getElementById('vipBadgeContainer');
  const vipFireEffect = document.getElementById('vipFireEffect');

  if (vipLevelElement) {
    vipLevelElement.textContent = `VIP ${current_level}`;
  }

  // Add fire effect for max level (VIP 5)
  if (current_level === 5) {
    if (vipBadgeContainer) {
      vipBadgeContainer.classList.add('max-level');
    }
    if (vipFireEffect) {
      vipFireEffect.style.display = 'block';
    }
  } else {
    if (vipBadgeContainer) {
      vipBadgeContainer.classList.remove('max-level');
    }
    if (vipFireEffect) {
      vipFireEffect.style.display = 'none';
    }
  }

  document.getElementById('vipTotalWager').textContent = `$${parseFloat(total_wager).toFixed(2)}`;

  if (next_level !== null) {
    document.getElementById('vipNextLevel').textContent = `VIP ${next_level}`;
    document.getElementById('vipRequired').textContent = `$${parseFloat(required_for_next).toFixed(2)}`;
    document.getElementById('vipProgress').textContent = `${progress_percentage.toFixed(1)}%`;

    // Update progress bar
    const progressFill = document.getElementById('vipProgressFill');
    if (progressFill) {
      progressFill.style.width = `${progress_percentage}%`;
    }
  } else {
    // Max level reached
    document.getElementById('vipNextLevel').textContent = 'MAX LEVEL';
    document.getElementById('vipRequired').textContent = 'N/A';
    document.getElementById('vipProgress').textContent = '100%';

    const progressFill = document.getElementById('vipProgressFill');
    if (progressFill) {
      progressFill.style.width = '100%';
    }
  }

  // Update current benefits
  document.getElementById('vipCurrentBonus').textContent = `$${current_benefits.upgrade_bonus}`;
  document.getElementById('vipCurrentFee').textContent = `${current_benefits.withdrawal_fee}%`;

  // Show/hide pending bonus section
  const pendingBonusCard = document.getElementById('vipPendingBonusCard');
  const pendingBonusAmount = parseFloat(pending_vip_bonus) || 0;

  if (pendingBonusCard) {
    if (pendingBonusAmount > 0) {
      pendingBonusCard.style.display = 'block';
      document.getElementById('vipPendingBonusAmount').textContent = `$${pendingBonusAmount.toFixed(2)}`;
    } else {
      pendingBonusCard.style.display = 'none';
    }
  }

  // Update next benefits
  const nextBenefitsCard = document.getElementById('vipNextBenefitsCard');
  if (next_benefits) {
    nextBenefitsCard.style.display = 'block';
    document.getElementById('vipNextBonus').textContent = `$${next_benefits.upgrade_bonus}`;
    document.getElementById('vipNextFee').textContent = `${next_benefits.withdrawal_fee}%`;
  } else {
    nextBenefitsCard.style.display = 'none';
  }

  // Populate VIP levels table
  const tableBody = document.getElementById('vipTableBody');
  if (tableBody && all_levels) {
    let tableHTML = '';
    all_levels.forEach(level => {
      const isCurrentLevel = level.level === current_level;
      const rowClass = isCurrentLevel ? 'style="background: rgba(147, 51, 234, 0.1);"' : '';

      tableHTML += `
        <tr ${rowClass}>
          <td>VIP ${level.level}</td>
          <td>$${level.threshold.toLocaleString()}</td>
          <td>$${level.bonus}</td>
          <td>${level.withdrawal_fee}%</td>
        </tr>
      `;
    });
    tableBody.innerHTML = tableHTML;
  }
}

// Update VIP badge on account screen
async function updateVIPBadge() {
  if (!isLoggedIn()) return;

  try {
    const response = await apiRequest('/vip/status');

    if (response.success && response.data) {
      const badge = document.getElementById('vipBadge');
      if (badge) {
        badge.textContent = `VIP ${response.data.current_level}`;
      }
    }
  } catch (error) {
    console.error('Error updating VIP badge:', error);
  }
}

// Update the account screen navigation to load VIP badge
const originalNavigateToAccount = window.navigateTo;
window.navigateTo = function (screenId) {
  // Call original navigation
  if (originalNavigateToAccount) {
    originalNavigateToAccount(screenId);
  }

  // Update VIP badge when navigating to account screen
  if (screenId === 'account-screen') {
    setTimeout(() => {
      generateRandomAvatar();
      updateAccountCountry();
      updateVIPBadge();
    }, 100);
  }

  // Keep all existing navigation handlers
  if (screenId === 'add-funds-screen') {
    setTimeout(() => {
      loadWalletAddress();
      loadLastDeposit();
    }, 100);
  }

  if (screenId === 'withdraw-screen') {
    setTimeout(() => {
      updateWithdrawalSummary();
      const amountInput = document.getElementById('withdraw-amount');
      if (amountInput && !amountInput.dataset.listenerAdded) {
        amountInput.addEventListener('input', updateWithdrawalSummary);
        amountInput.dataset.listenerAdded = 'true';
      }
    }, 100);
  }

  if (screenId === "fun-screen") {
    setTimeout(startTopEarnersFeed, 100);
  }
  if (screenId === "home-screen") {
    setTimeout(startLiveWinnersFeed, 100);
  }
  if (screenId === "transactions-screen") {
    setTimeout(() => loadTransactions(), 100);
  }
};

// ========== CLAIM VIP BONUS ==========
async function claimVIPBonus() {
  if (!isLoggedIn()) {
    showNotification('Please login to claim VIP bonus');
    return;
  }

  const claimBtn = document.getElementById('vipClaimBonusBtn');
  if (!claimBtn) return;

  // Disable button and show loading state
  const originalText = claimBtn.textContent;
  claimBtn.disabled = true;
  claimBtn.textContent = 'Claiming...';
  claimBtn.style.opacity = '0.6';
  claimBtn.style.cursor = 'not-allowed';

  try {
    const response = await apiRequest('/vip/claim-bonus', {
      method: 'POST'
    });

    if (response.success) {
      const claimedAmount = parseFloat(response.data.claimed_amount) || 0;
      const newBalance = parseFloat(response.data.new_balance) || 0;

      // Update user balance in UI
      if (currentUser) {
        currentUser.main_balance = newBalance;
        updateBalanceDisplay();
      }

      // Show success notification
      showNotification(`Successfully claimed $${claimedAmount.toFixed(2)} VIP bonus!`);

      // Reload VIP data to update UI
      await loadVIPData();
    } else {
      showNotification(response.message || 'Failed to claim VIP bonus');
      // Re-enable button
      claimBtn.disabled = false;
      claimBtn.textContent = originalText;
      claimBtn.style.opacity = '1';
      claimBtn.style.cursor = 'pointer';
    }
  } catch (error) {
    console.error('Error claiming VIP bonus:', error);
    showNotification('Failed to claim VIP bonus');
    // Re-enable button
    claimBtn.disabled = false;
    claimBtn.textContent = originalText;
    claimBtn.style.opacity = '1';
    claimBtn.style.cursor = 'pointer';
  }
}
