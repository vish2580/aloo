// Admin Dashboard JavaScript - Backend Connected
// API Configuration
const API_BASE_URL = "http://localhost:5000/api";
let authToken = localStorage.getItem("adminToken");

// ==================== ADMIN AUTH ====================
function checkAdminAuth() {
  const token = localStorage.getItem("adminToken");
  if (!token) {
    showLoginScreen();
    return false;
  }

  // Verify token is not expired
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.exp * 1000 < Date.now()) {
      localStorage.removeItem("adminToken");
      showLoginScreen();
      return false;
    }
  } catch (e) {
    localStorage.removeItem("adminToken");
    showLoginScreen();
    return false;
  }

  authToken = token;
  showDashboard();
  return true;
}

function showLoginScreen() {
  document.getElementById("admin-login-screen").style.display = "flex";
  document.getElementById("admin-dashboard").style.display = "none";
}

function showDashboard() {
  document.getElementById("admin-login-screen").style.display = "none";
  document.getElementById("admin-dashboard").style.display = "flex";
}

async function handleAdminLogin(e) {
  e.preventDefault();

  const username = document.getElementById("admin-username").value.trim();
  const password = document.getElementById("admin-password").value;
  const errorDiv = document.getElementById("login-error");

  if (!username || !password) {
    errorDiv.textContent = "Please enter username and password";
    errorDiv.style.display = "block";
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/admin/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      errorDiv.textContent = data.message || "Login failed";
      errorDiv.style.display = "block";
      return;
    }

    // Save admin token
    localStorage.setItem("adminToken", data.data.token);
    authToken = data.data.token;

    errorDiv.style.display = "none";
    showDashboard();

    // Load initial data
    loadDashboardStats();
    loadRecentActivity();
    loadLiveGameStats();
  } catch (error) {
    console.error("Login error:", error);
    errorDiv.textContent = "Connection error. Please try again.";
    errorDiv.style.display = "block";
  }
}

function adminLogout() {
  localStorage.removeItem("adminToken");
  authToken = null;
  showLoginScreen();
  document.getElementById("admin-login-form").reset();
}

// ==================== API HELPER ====================
async function apiCall(endpoint, method = "GET", body = null) {
  console.log(`[API] ${method} ${endpoint}`, body ? JSON.stringify(body) : "");

  if (!authToken) {
    showLoginScreen();
    throw new Error("Not authenticated");
  }

  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await response.json();

    console.log(`[API] Response ${response.status}:`, data);

    if (response.status === 401 || response.status === 403) {
      // Token invalid or expired
      localStorage.removeItem("adminToken");
      showLoginScreen();
      throw new Error("Session expired. Please login again.");
    }

    if (!response.ok) {
      throw new Error(data.message || "API Error");
    }

    return data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}

// ==================== INITIALIZATION ====================
document.addEventListener("DOMContentLoaded", function () {
  // Setup login form handler
  const loginForm = document.getElementById("admin-login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", handleAdminLogin);
  }

  // Check if already authenticated
  if (!checkAdminAuth()) {
    return; // Stop here if not authenticated
  }

  initNavigation();
  initToggles();
  initColorSelection();
  initFormHandlers();

  // Load initial data
  loadDashboardStats();
  loadRecentActivity();
  loadLiveGameStats();

  // Start auto-refresh
  setInterval(loadDashboardStats, 30000);
  setInterval(loadLiveGameStats, 5000);
  setInterval(loadRecentActivity, 15000);
});

// ==================== SEARCH FUNCTIONS ====================
function searchUsers() {
  const searchInput = document.getElementById("userSearchInput");
  const query = searchInput ? searchInput.value.trim() : "";
  loadUsers(query);
}

function refreshDashboard() {
  console.log("Refreshing dashboard...");
  loadDashboardStats();
  loadRecentActivity();
  loadLiveGameStats();
  showNotification("Dashboard refreshed", "success");
}

// ==================== NAVIGATION ====================
function initNavigation() {
  const navLinks = document.querySelectorAll(".sidebar-nav .nav-link");
  const sections = document.querySelectorAll(".content-section");
  const pageTitle = document.getElementById("pageTitle");

  navLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      const sectionId = this.dataset.section;

      navLinks.forEach((l) => l.classList.remove("active"));
      this.classList.add("active");

      sections.forEach((s) => s.classList.remove("active"));
      document.getElementById(sectionId).classList.add("active");

      const titles = {
        dashboard: "Dashboard",
        users: "User Management",
        withdrawals: "Recharge / Withdrawals",
        "game-control": "Game Control Panel",
        "red-envelope": "Red Envelope Management",
        "referral-control": "Referral Control & Fraud Detection",
        "security-flags": "Security / Flags",
        promotions: "Promotions & Commission",
        announcements: "Announcements",
        settings: "Settings",
      };
      pageTitle.textContent = titles[sectionId] || "Dashboard";

      // Load section-specific data
      switch (sectionId) {
        case "dashboard":
          loadDashboardStats();
          loadRecentActivity();
          loadLiveGameStats();
          break;
        case "users":
          loadUsers();
          break;
        case "withdrawals":
          loadRechargeRequests("all");
          break;
        case "game-control":
          loadGameControlStatus();
          break;
        case "red-envelope":
          loadRedEnvelopes();
          break;
        case "referral-control":
          loadReferralList();
          break;
        case "security-flags":
          loadSecurityOverview();
          loadFlaggedUsers();
          break;
        case "promotions":
          loadReferralStats();
          loadPromotionConfig();
          break;
        case "announcements":
          loadAnnouncements();
          break;
        case "settings":
          loadSettings();
          break;
      }
    });
  });
}

// ==================== DASHBOARD STATS ====================
async function loadDashboardStats() {
  console.log("[DEBUG] loadDashboardStats called");
  try {
    const response = await apiCall("/admin/dashboard/stats");
    console.log("[DEBUG] Dashboard stats response:", response);
    if (response.success) {
      const data = response.data;

      // Update cards
      const cards = document.querySelectorAll(".summary-card");
      if (cards[0])
        cards[0].querySelector(".card-value").textContent =
          data.totalUsers.toLocaleString();
      if (cards[1])
        cards[1].querySelector(".card-value").textContent =
          "$" +
          data.totalDeposits.toLocaleString(undefined, {
            minimumFractionDigits: 2,
          });
      if (cards[2])
        cards[2].querySelector(".card-value").textContent =
          "$" +
          data.totalWithdrawals.toLocaleString(undefined, {
            minimumFractionDigits: 2,
          });
      if (cards[3])
        cards[3].querySelector(".card-value").textContent =
          "$" +
          data.todayProfit.toLocaleString(undefined, {
            minimumFractionDigits: 2,
          });
    }
  } catch (error) {
    console.error("[DEBUG] Failed to load dashboard stats:", error);
  }
}

async function loadRecentActivity() {
  try {
    const response = await apiCall("/admin/dashboard/activity?limit=10");
    if (response.success) {
      const activityList = document.querySelector(".activity-list");
      if (activityList) {
        activityList.innerHTML = response.data
          .map(
            (activity) => `
                    <div class="activity-item">
                        <span class="activity-icon">${activity.icon}</span>
                        <div class="activity-info">
                            <span class="activity-text">${activity.text}</span>
                            <span class="activity-time">${formatTimeAgo(activity.timestamp)}</span>
                        </div>
                    </div>
                `,
          )
          .join("");
      }
    }
  } catch (error) {
    console.error("Failed to load activity:", error);
  }
}

async function loadLiveGameStats() {
  console.log("[DEBUG] loadLiveGameStats called");
  try {
    const response = await apiCall("/admin/dashboard/live-game");
    console.log("[DEBUG] Live game stats response:", response);
    if (response.success) {
      const data = response.data;

      // Update game stats
      const statsContainer = document.querySelector(".game-stats");
      if (statsContainer && data.currentRound) {
        const statRows = statsContainer.querySelectorAll(".stat-row");
        if (statRows[0])
          statRows[0].querySelector(".stat-value").textContent =
            `#${data.currentRound.roundNumber}`;
        if (statRows[1])
          statRows[1].querySelector(".stat-value").textContent =
            data.activePlayers.toString();
        if (statRows[2])
          statRows[2].querySelector(".stat-value").textContent =
            "$" + data.currentRoundBets.toLocaleString();
        if (statRows[3])
          statRows[3].querySelector(".stat-value").textContent =
            data.roundsToday.toString();
        if (statRows[4])
          statRows[4].querySelector(".stat-value").textContent =
            "$" + data.todayBetsTotal.toLocaleString();
      }

      // Update countdown in game control - use local timer for smooth countdown
      if (data.currentRound) {
        const roundIdEl = document.querySelector(".round-id");
        if (roundIdEl)
          roundIdEl.textContent = `#${data.currentRound.roundNumber}`;

        // Check if this is a new round
        const endTime = new Date(data.currentRound.endTime).getTime();
        const roundNumber = data.currentRound.roundNumber;

        // Only start new countdown if round number changed or no countdown is running
        if (roundNumber !== adminCurrentRoundNumber || !adminCountdownInterval) {
          console.log('[ADMIN TIMER] New round detected:', roundNumber);
          startAdminCountdown(endTime, roundNumber);
        }
        // If same round, the local interval is already running smoothly
      }
    }
  } catch (error) {
    console.error("[DEBUG] Failed to load game stats:", error);
  }
}

function updateCountdown(seconds) {
  const countdownEl = document.getElementById("gameCountdown");
  if (countdownEl) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    countdownEl.textContent = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
}

// Start local countdown timer for admin (runs every second)
function startAdminCountdown(endTime, roundNumber) {
  // Clear any existing interval to prevent memory leaks
  if (adminCountdownInterval) {
    clearInterval(adminCountdownInterval);
    adminCountdownInterval = null;
  }

  // Store the end time and round number
  adminRoundEndTime = endTime;
  adminCurrentRoundNumber = roundNumber;

  console.log('[ADMIN TIMER] Starting countdown for round', roundNumber, 'ending at', new Date(endTime).toLocaleTimeString());

  // Update immediately
  updateAdminCountdownDisplay();

  // Start interval to update every second
  adminCountdownInterval = setInterval(() => {
    updateAdminCountdownDisplay();
  }, 1000);
}

function updateAdminCountdownDisplay() {
  if (!adminRoundEndTime) return;

  const now = Date.now();
  const remaining = Math.max(0, Math.floor((adminRoundEndTime - now) / 1000));

  updateCountdown(remaining);

  // If countdown reaches 0, stop the interval
  if (remaining === 0) {
    console.log('[ADMIN TIMER] Countdown reached 0, waiting for new round from API');
    if (adminCountdownInterval) {
      clearInterval(adminCountdownInterval);
      adminCountdownInterval = null;
    }
  }
}

// ==================== USER MANAGEMENT ====================
async function loadUsers(search = "") {
  try {
    const response = await apiCall(
      `/admin/users?search=${encodeURIComponent(search)}&limit=50`,
    );
    if (response.success) {
      const tbody = document.querySelector("#users .admin-table tbody");
      if (tbody) {
        tbody.innerHTML = response.data.users
          .map(
            (user) => `
                    <tr data-user-id="${user.id}">
                        <td>UID: ${user.uid || 'N/A'}</td>
                        <td>${user.email.split("@")[0].substring(0, 10)}***</td>
                        <td>${user.email.substring(0, 3)}***@${user.email.split("@")[1]}</td>
                        <td class="${user.balance > 0 ? "green" : "red"}">$${user.balance.toFixed(2)}</td>
                        <td>$${user.totalDeposits.toFixed(2)}</td>
                        <td>$${user.totalBets.toFixed(2)}</td>
                        <td><span class="status-badge ${user.isBanned ? "banned" : "active"}">${user.isBanned ? "Banned" : "Active"}</span></td>
                        <td class="actions">
                            <button class="btn-sm btn-view" onclick="viewUser('${user.id}')">View</button>
                            <button class="btn-sm btn-primary" onclick="showAddFundsModal('${user.id}')">Add Funds</button>
                            <button class="btn-sm ${user.isBanned ? 'btn-unban' : 'btn-ban'}" onclick="toggleUserBan('${user.id}', ${user.isBanned})">${user.isBanned ? 'Unban User' : 'Ban User'}</button>
                        </td>
                    </tr>
                `,
          )
          .join("");
      }
    }
  } catch (error) {
    showNotification("Failed to load users", "error");
  }
}

// ==================== USER DETAILS MODAL ====================
let currentViewUserId = null;

async function viewUser(userId) {
  currentViewUserId = userId;

  try {
    const response = await apiCall(`/admin/users/${userId}/details`);

    if (response.success) {
      const { user, wallet, stats, recentTransactions, recentBets } = response.data;

      // Populate modal with user details
      const modal = document.getElementById('userDetailsModal');
      if (!modal) {
        console.error('User details modal not found');
        return;
      }

      // Set user info
      document.getElementById('modalUserEmail').textContent = user.email;
      document.getElementById('modalUserId').textContent = user.id;
      document.getElementById('modalUserCountry').textContent = user.country || 'N/A';
      document.getElementById('modalUserBalance').textContent = `$${wallet.balance.toFixed(2)}`;

      // Dynamic injection of Status + Button
      const statusContainer = document.getElementById('modalUserStatusContainer');
      if (statusContainer) {
        const statusBadge = `<span class="status-badge ${user.isBanned ? 'banned' : 'active'}">${user.isBanned ? 'BANNED' : 'ACTIVE'}</span>`;
        const actionButton = `<button onclick="toggleUserBan('${user.id}', ${user.isBanned})" class="btn-sm ${user.isBanned ? 'btn-unban' : 'btn-ban'}" style="margin-left: 15px; cursor: pointer; display: inline-block;">${user.isBanned ? 'Unban User' : 'Ban User'}</button>`;
        statusContainer.innerHTML = statusBadge + actionButton;
      } else {
        console.error('Status container not found, trying fallback');
        // Fallback if container not found
        const statusEl = document.getElementById('modalUserStatus');
        if (statusEl) statusEl.innerHTML = `<span class="status-badge ${user.isBanned ? 'banned' : 'active'}">${user.isBanned ? 'BANNED' : 'ACTIVE'}</span>`;
      }

      // Format and set registered date
      const registeredDate = new Date(user.createdAt);
      const formattedDate = registeredDate.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      document.getElementById('modalUserRegistered').textContent = formattedDate;

      // Set stats
      document.getElementById('modalTotalDeposits').textContent = `$${stats.totalDeposits.toFixed(2)}`;
      document.getElementById('modalTotalBets').textContent = `$${stats.totalBets.toFixed(2)}`;
      document.getElementById('modalTotalWinnings').textContent = `$${stats.totalWinnings.toFixed(2)}`;
      document.getElementById('modalTotalWithdrawals').textContent = `$${stats.totalWithdrawals.toFixed(2)}`;
      document.getElementById('modalBetCount').textContent = stats.totalBetCount || 0;

      // Show modal
      modal.style.display = 'flex';
    }
  } catch (error) {
    console.error('Error viewing user:', error);
    showNotification('Failed to load user details: ' + error.message, 'error');
  }
}

function closeUserModal() {
  const modal = document.getElementById('userDetailsModal');
  if (modal) {
    modal.style.display = 'none';
  }
  currentViewUserId = null;
}

async function toggleUserBan(userId, currentlyBanned) {
  const action = currentlyBanned ? 'unban' : 'ban';
  const confirmMessage = currentlyBanned
    ? 'Are you sure you want to unban this user?'
    : 'Are you sure you want to ban this user? They will not be able to bet, recharge, withdraw, or claim red envelopes.';

  if (!confirm(confirmMessage)) return;

  try {
    await apiCall(`/admin/users/${userId}/toggle-ban`, 'POST');
    showNotification(`User ${action}ned successfully`, 'success');

    // Refresh user details modal
    closeUserModal();
    loadUsers();
  } catch (error) {
    showNotification(`Failed to ${action} user: ` + error.message, 'error');
  }
}

async function banUser(userId) {
  if (!confirm("Are you sure you want to ban this user?")) return;

  try {
    await apiCall(`/admin/users/${userId}/ban`, "POST");
    showNotification("User banned successfully", "success");
    loadUsers();
  } catch (error) {
    showNotification("Failed to ban user: " + error.message, "error");
  }
}

async function unbanUser(userId) {
  if (!confirm("Are you sure you want to unban this user?")) return;

  try {
    await apiCall(`/admin/users/${userId}/unban`, "POST");
    showNotification("User unbanned successfully", "success");
    loadUsers();
  } catch (error) {
    showNotification("Failed to unban user: " + error.message, "error");
  }
}

function showAdjustBalanceModal(userId) {
  const amount = prompt(
    "Enter amount to adjust (positive to add, negative to deduct):",
  );
  if (amount === null) return;

  const reason = prompt("Enter reason for adjustment:");
  if (reason === null) return;

  adjustBalance(userId, parseFloat(amount), reason);
}

async function adjustBalance(userId, amount, reason) {
  try {
    await apiCall(`/admin/users/${userId}/adjust-balance`, "POST", {
      amount,
      reason,
    });
    showNotification("Balance adjusted successfully", "success");
    loadUsers();
  } catch (error) {
  }
}

// ==================== ADD FUNDS TO USER ====================
let currentAddFundsUserId = null;

function showAddFundsModal(userId) {
  currentAddFundsUserId = userId;
  const modal = document.getElementById("addFundsModal");
  const form = document.getElementById("addFundsForm");

  if (modal && form) {
    form.reset();
    modal.style.display = "flex";
  }
}

function closeAddFundsModal() {
  const modal = document.getElementById("addFundsModal");
  const form = document.getElementById("addFundsForm");

  if (modal && form) {
    modal.style.display = "none";
    form.reset();
    currentAddFundsUserId = null;
  }
}

async function confirmAddFunds() {
  const amountInput = document.getElementById("addFundsAmount");
  const reasonInput = document.getElementById("addFundsReason");

  if (!amountInput || !reasonInput) {
    showNotification("Form inputs not found", "error");
    return;
  }

  const amount = parseFloat(amountInput.value);
  const reason = reasonInput.value.trim();

  // Validation
  if (isNaN(amount) || amount <= 0) {
    showNotification("Please enter a valid positive amount", "error");
    return;
  }

  if (!reason) {
    showNotification("Please enter a reason for adding funds", "error");
    return;
  }

  if (!currentAddFundsUserId) {
    showNotification("User ID not found", "error");
    return;
  }

  await addFundsToUser(currentAddFundsUserId, amount, reason);
}

async function addFundsToUser(userId, amount, reason) {
  try {
    await apiCall(`/admin/users/${userId}/adjust-balance`, "POST", {
      amount: amount,
      reason: reason,
    });

    showNotification("Funds added successfully", "success");
    closeAddFundsModal();
    loadUsers(); // Refresh the users list to show updated balance
  } catch (error) {
    showNotification("Failed to add funds: " + error.message, "error");
  }
}


// ==================== WITHDRAWALS ====================
async function loadWithdrawals(status = "all") {
  console.log('[ADMIN] loadWithdrawals called with status:', status);
  try {
    console.log('[ADMIN] Calling API:', `/admin/withdrawals?status=${status}`);
    const response = await apiCall(`/admin/withdrawals?status=${status}`);
    console.log('[ADMIN] API response:', response);

    if (response.success) {
      console.log('[ADMIN] Found', response.data.length, 'withdrawals');
      const tbody = document.querySelector("#withdrawal-table-body");
      console.log('[ADMIN] Table body element:', tbody);

      if (tbody) {
        tbody.innerHTML = response.data
          .map(
            (w) => {
              console.log('[ADMIN] Rendering withdrawal:', w);
              return `
                    <tr data-withdrawal-id="${w.id}">
                        <td>#W${w.id.toString().padStart(3, "0")}</td>
                        <td>${w.email.substring(0, 10)}***</td>
                        <td class="red">$${w.netAmount.toFixed(2)}</td>
                        <td>
                            <span style="display: inline-flex; align-items: center;">
                                ${w.walletAddress.substring(0, 8)}...${w.walletAddress.slice(-6)}
                                <span class="copy-icon" onclick="event.stopPropagation(); copyToClipboard('${w.walletAddress}', 'Address Copied');" title="Copy address">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                </span>
                            </span>
                        </td>
                        <td>${formatDate(w.createdAt)}</td>
                        <td><span class="status-badge ${w.status}">${capitalize(w.status)}</span></td>
                        <td class="actions">
                            ${w.status === "pending"
                  ? `
                                <button class="btn-sm btn-approve" onclick="approveWithdrawal(${w.id})">Approve</button>
                                <button class="btn-sm btn-reject" onclick="rejectWithdrawal(${w.id})">Reject</button>
                            `
                  : `
                                <button class="btn-sm btn-view" onclick="viewWithdrawal(${w.id})">View</button>
                            `
                }
                        </td>
                    </tr>
                `;
            }
          )
          .join("");
        console.log('[ADMIN] Table updated with', response.data.length, 'rows');
      } else {
        console.error('[ADMIN] Table body not found! Selector: #withdrawal-table-body');
      }
    } else {
      console.error('[ADMIN] API returned success=false:', response);
    }
  } catch (error) {
    console.error('[ADMIN] loadWithdrawals error:', error);
    showNotification("Failed to load withdrawals", "error");
  }
}

async function approveWithdrawal(withdrawalId) {
  if (!confirm("Approve this withdrawal request?")) return;

  try {
    await apiCall(`/admin/withdrawals/${withdrawalId}/approve`, "POST");
    showNotification("Withdrawal approved successfully", "success");
    loadWithdrawals();
    loadDashboardStats();
  } catch (error) {
    showNotification("Failed to approve: " + error.message, "error");
  }
}

async function rejectWithdrawal(withdrawalId) {
  const reason = prompt("Enter reason for rejection:");
  if (reason === null) return;

  try {
    await apiCall(`/admin/withdrawals/${withdrawalId}/reject`, "POST", {
      reason,
    });
    showNotification("Withdrawal rejected and refunded", "success");
    loadWithdrawals();
  } catch (error) {
    showNotification("Failed to reject: " + error.message, "error");
  }
}

// ==================== RECHARGE REQUESTS ====================
// Global state for current recharge filter
let currentRechargeFilter = "all";

// Switch between Deposits and Withdrawals tabs
function switchRechargeTab(tab) {
  // Update tab buttons
  document.querySelectorAll(".main-tab").forEach((btn) => {
    btn.classList.remove("active");
  });
  event.target.classList.add("active");

  // Update tab content
  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.remove("active");
  });

  if (tab === "deposits") {
    document.getElementById("deposits-tab").classList.add("active");

    // Reset filter to "All" and update UI
    currentRechargeFilter = "all";
    const depositsTab = document.getElementById("deposits-tab");
    if (depositsTab) {
      depositsTab.querySelectorAll(".filter-tab").forEach((filterTab) => {
        filterTab.classList.remove("active");
        if (filterTab.textContent.trim() === "All") {
          filterTab.classList.add("active");
        }
      });
    }

    // Load fresh data
    loadRechargeRequests("all");
  } else if (tab === "withdrawals") {
    document.getElementById("withdrawals-tab").classList.add("active");

    // Reset filter to "All" and update UI
    const withdrawalsTab = document.getElementById("withdrawals-tab");
    if (withdrawalsTab) {
      withdrawalsTab.querySelectorAll(".filter-tab").forEach((filterTab) => {
        filterTab.classList.remove("active");
        if (filterTab.textContent.trim() === "All") {
          filterTab.classList.add("active");
        }
      });
    }

    // Load fresh data
    loadWithdrawals("all");
  }
}

// Load recharge requests from API
async function loadRechargeRequests(status = "all") {
  currentRechargeFilter = status;
  try {
    // Don't send status parameter if 'all' - let backend return everything
    const url = status === "all"
      ? `/admin/recharge`
      : `/admin/recharge?status=${status}`;

    const response = await apiCall(url);
    if (response.success) {
      const tbody = document.getElementById("recharge-table-body");
      if (tbody) {
        if (!response.data || response.data.length === 0) {
          tbody.innerHTML = `
            <tr>
              <td colspan="6" style="text-align: center; padding: 40px; color: #666;">
                No recharge requests found
              </td>
            </tr>
          `;
          return;
        }

        tbody.innerHTML = response.data
          .map(
            (r) => `
              <tr data-recharge-id="${r.id}">
                <td>${r.uid || "N/A"}</td>
                <td>${r.email ? r.email.substring(0, 15) + "***" : "N/A"}</td>
                <td class="green">$${parseFloat(r.amount).toFixed(2)}</td>
                <td>${formatDate(r.created_at)}</td>
                <td><span class="status-badge ${r.status}">${capitalize(r.status)}</span></td>
                <td class="actions">
                  ${r.status === "pending"
                ? `
                      <button class="btn-sm btn-approve" onclick="approveRecharge(${r.id})">Approve</button>
                      <button class="btn-sm btn-reject" onclick="rejectRecharge(${r.id})">Reject</button>
                    `
                : `
                      <button class="btn-sm btn-view" onclick="viewRecharge(${r.id})">View</button>
                    `
              }
                </td>
              </tr>
            `,
          )
          .join("");
      }
    }
  } catch (error) {
    console.error("Failed to load recharge requests:", error);
    showNotification("Failed to load recharge requests", "error");
  }
}

// Filter recharge requests by status
function filterRechargeRequests(status) {
  // Update filter tab UI
  const depositsTab = document.getElementById("deposits-tab");
  if (depositsTab) {
    depositsTab.querySelectorAll(".filter-tab").forEach((tab) => {
      tab.classList.remove("active");
    });
    event.target.classList.add("active");
  }

  // Load filtered data
  loadRechargeRequests(status);
}

// Filter withdrawals by status
function filterWithdrawals(status) {
  // Update filter tab UI
  const withdrawalsTab = document.getElementById("withdrawals-tab");
  if (withdrawalsTab) {
    withdrawalsTab.querySelectorAll(".filter-tab").forEach((tab) => {
      tab.classList.remove("active");
    });
    event.target.classList.add("active");
  }

  // Load filtered data
  loadWithdrawals(status);
}

// Approve recharge request
async function approveRecharge(rechargeId) {
  console.log("[DEBUG] approveRecharge called with ID:", rechargeId, "Type:", typeof rechargeId);

  showConfirmationModal(
    "Approve Recharge",
    "Are you sure you want to approve this recharge request? The amount will be added to the user's balance.",
    async () => {
      // Find and disable the approve button
      const row = document.querySelector(`tr[data-recharge-id="${rechargeId}"]`);
      const approveBtn = row?.querySelector('.btn-approve');

      if (approveBtn) {
        approveBtn.disabled = true;
        approveBtn.textContent = "Approving...";
      }

      try {
        console.log("[DEBUG] Calling API: PUT /admin/recharge/" + rechargeId + "/approve");

        const response = await apiCall(
          `/admin/recharge/${rechargeId}/approve`,
          "PUT",
        );

        console.log("[DEBUG] Approve response:", response);

        // Check for success - handle both response.success and HTTP 200
        if (response && (response.success === true || response.success !== false)) {
          showNotification("Recharge approved successfully", "success");

          // Update row status without reload
          if (row) {
            const statusCell = row.querySelector(".status-badge");
            if (statusCell) {
              statusCell.className = "status-badge approved";
              statusCell.textContent = "Approved";
            }

            const actionsCell = row.querySelector(".actions");
            if (actionsCell) {
              actionsCell.innerHTML = `<button class="btn-sm btn-view" onclick="viewRecharge(${rechargeId})">View</button>`;
            }
          }

          // Reload dashboard stats
          if (typeof loadDashboardStats === "function") {
            loadDashboardStats();
          }
        } else {
          // Only show error if response explicitly indicates failure
          throw new Error(response.message || "Approval failed");
        }
      } catch (error) {
        console.error("[ERROR] Failed to approve recharge:", error);

        // Re-enable button on error
        if (approveBtn) {
          approveBtn.disabled = false;
          approveBtn.textContent = "Approve";
        }

        showNotification(
          "Failed to approve: " + (error.message || "Unknown error"),
          "error",
        );
      }
    },
  );
}

// Reject recharge request
async function rejectRecharge(rechargeId) {
  // Prompt for rejection reason
  const reason = prompt("Enter reason for rejection:");
  if (reason === null || reason.trim() === "") {
    showNotification("Rejection reason is required", "error");
    return;
  }

  showConfirmationModal(
    "Reject Recharge",
    "Are you sure you want to reject this recharge request? This action cannot be undone.",
    async () => {
      try {
        const response = await apiCall(
          `/admin/recharge/${rechargeId}/reject`,
          "PUT",
          { admin_notes: reason.trim() }
        );
        if (response.success) {
          showNotification("Recharge rejected", "success");

          // Update row status without reload
          const row = document.querySelector(
            `tr[data-recharge-id="${rechargeId}"]`,
          );
          if (row) {
            const statusCell = row.querySelector(".status-badge");
            if (statusCell) {
              statusCell.className = "status-badge rejected";
              statusCell.textContent = "Rejected";
            }

            const actionsCell = row.querySelector(".actions");
            if (actionsCell) {
              actionsCell.innerHTML = `<button class="btn-sm btn-view" onclick="viewRecharge(${rechargeId})">View</button>`;
            }
          }
        }
      } catch (error) {
        console.error("Failed to reject recharge:", error);
        showNotification(
          "Failed to reject: " + (error.message || "Unknown error"),
          "error",
        );
      }
    },
  );
}

// View recharge details (placeholder)
function viewRecharge(rechargeId) {
  showNotification(`Viewing recharge request #${rechargeId}`, "info");
}

// Show confirmation modal
function showConfirmationModal(title, message, onConfirm) {
  const modal = document.getElementById("confirmationModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalMessage = document.getElementById("modalMessage");
  const confirmBtn = document.getElementById("modalConfirmBtn");

  if (modal && modalTitle && modalMessage && confirmBtn) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;

    // Remove old event listeners by cloning
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    // Add new event listener
    newConfirmBtn.addEventListener("click", () => {
      closeConfirmationModal();
      onConfirm();
    });

    modal.style.display = "flex";
  }
}

// Close confirmation modal
function closeConfirmationModal() {
  const modal = document.getElementById("confirmationModal");
  if (modal) {
    modal.style.display = "none";
  }
}

// ==================== GAME CONTROL ====================
let selectedColor = null;
let selectedNumber = null;
let adminCountdownInterval = null;
let adminRoundEndTime = null;
let adminCurrentRoundNumber = null;

async function loadGameControlStatus() {
  console.log("[DEBUG] loadGameControlStatus called");
  try {
    const response = await apiCall("/admin/game/status");
    console.log("[DEBUG] Game status response:", response);
    if (response.success) {
      const data = response.data;

      // Update round info and start local countdown
      if (data.currentRound) {
        const roundIdEl = document.querySelector(".round-id");
        if (roundIdEl)
          roundIdEl.textContent = `#${data.currentRound.roundNumber}`;

        // Start local countdown timer
        const endTime = new Date(data.currentRound.endTime).getTime();
        const roundNumber = data.currentRound.roundNumber;
        startAdminCountdown(endTime, roundNumber);
      }

      // Update toggles based on manual override
      const autoMode = document.getElementById("autoMode");
      const manualOverride = document.getElementById("manualOverride");
      const pauseGame = document.getElementById("pauseGame");

      if (autoMode && manualOverride) {
        autoMode.checked = data.autoMode;
        manualOverride.checked = !data.autoMode;
        document.getElementById("autoStatus").textContent = data.autoMode
          ? "ON"
          : "OFF";
        document.getElementById("manualStatus").textContent = data.autoMode
          ? "OFF"
          : "ON";
      }

      // Update pause status
      if (pauseGame) {
        pauseGame.checked = data.isPaused || false;
        document.getElementById("pauseStatus").textContent = data.isPaused
          ? "ON"
          : "OFF";
      }

      // Update selected result if manual override is set
      if (data.manualOverride) {
        if (data.manualOverride.color) {
          selectColor(data.manualOverride.color);
        } else if (data.manualOverride.number !== null) {
          selectNumber(data.manualOverride.number);
        }
      }

      // Update recent results
      const recentResults = document.querySelector(".recent-results");
      if (recentResults && data.recentResults) {
        recentResults.innerHTML = data.recentResults
          .map(
            (r) => `
                    <div class="result-item ${r.result}">${r.resultNumber}</div>
                `,
          )
          .join("");
      }
    }
  } catch (error) {
    console.error("[DEBUG] Failed to load game status:", error);
  }
}

function initColorSelection() {
  document.querySelectorAll(".color-select-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const color = this.classList.contains("green")
        ? "green"
        : this.classList.contains("red")
          ? "red"
          : "violet";
      selectColor(color);
    });
  });
}

function selectColor(color) {
  selectedColor = color;
  selectedNumber = null;

  document
    .querySelectorAll(".color-select-btn")
    .forEach((btn) => btn.classList.remove("selected"));
  document
    .querySelectorAll(".number-select-btn")
    .forEach((btn) => btn.classList.remove("selected"));

  const colorBtn = document.querySelector(`.color-select-btn.${color}`);
  if (colorBtn) colorBtn.classList.add("selected");

  updateSelectedResult();
}

function selectNumber(num) {
  selectedNumber = num;
  selectedColor = null;

  document
    .querySelectorAll(".color-select-btn")
    .forEach((btn) => btn.classList.remove("selected"));
  document
    .querySelectorAll(".number-select-btn")
    .forEach((btn) => btn.classList.remove("selected"));

  const numBtns = document.querySelectorAll(".number-select-btn");
  if (numBtns[num]) numBtns[num].classList.add("selected");

  updateSelectedResult();
}

function updateSelectedResult() {
  const resultEl = document.getElementById("selectedResult");
  if (resultEl) {
    if (selectedColor) {
      resultEl.textContent = capitalize(selectedColor);
      resultEl.style.color =
        selectedColor === "green"
          ? "#4ade80"
          : selectedColor === "red"
            ? "#f87171"
            : "#a78bfa";
    } else if (selectedNumber !== null) {
      resultEl.textContent = `Number ${selectedNumber}`;
      resultEl.style.color = "#c084fc";
    } else {
      resultEl.textContent = "None";
      resultEl.style.color = "#c084fc";
    }
  }
}

async function applyGameSettings() {
  console.log("[DEBUG] applyGameSettings called");
  const manualOverride = document.getElementById("manualOverride");

  if (manualOverride && manualOverride.checked) {
    if (!selectedColor && selectedNumber === null) {
      showNotification("Please select a color or number first", "error");
      return;
    }

    try {
      const payload = {};
      if (selectedColor) payload.color = selectedColor;
      if (selectedNumber !== null) payload.number = selectedNumber;

      console.log("[DEBUG] Setting manual override:", payload);
      await apiCall("/admin/game/override", "POST", payload);
      showNotification("Manual override set for next round", "success");
      loadGameControlStatus(); // Refresh status
    } catch (error) {
      showNotification("Failed to set override: " + error.message, "error");
    }
  } else {
    try {
      console.log("[DEBUG] Clearing manual override, enabling auto mode");
      await apiCall("/admin/game/override", "DELETE");
      showNotification("Auto mode enabled", "success");
      loadGameControlStatus(); // Refresh status
    } catch (error) {
      showNotification("Failed to clear override: " + error.message, "error");
    }
  }
}

// ==================== RED ENVELOPES ====================
async function loadRedEnvelopes() {
  try {
    const response = await apiCall("/admin/promotions/red-envelopes");
    if (response.success) {
      const envelopes = response.data;

      // Calculate stats
      const activeEnvelopes = envelopes.filter((e) => e.is_active).length;
      const totalDistributed = envelopes.reduce(
        (sum, e) => sum + e.amount * e.max_claims,
        0,
      );
      const totalClaimed = envelopes.reduce(
        (sum, e) => sum + e.amount * e.current_claims,
        0,
      );
      const totalClaimCount = envelopes.reduce(
        (sum, e) => sum + e.current_claims,
        0,
      );

      // Update stats display
      const statsContainer = document.getElementById("envelopeStats");
      if (statsContainer) {
        statsContainer.innerHTML = `
                    <div class="env-stat-card">
                        <span class="env-stat-value">${activeEnvelopes}</span>
                        <span class="env-stat-label">Active Envelopes</span>
                    </div>
                    <div class="env-stat-card">
                        <span class="env-stat-value">$${totalDistributed.toFixed(0)}</span>
                        <span class="env-stat-label">Total Distributed</span>
                    </div>
                    <div class="env-stat-card">
                        <span class="env-stat-value">$${totalClaimed.toFixed(0)}</span>
                        <span class="env-stat-label">Claimed Amount</span>
                    </div>
                    <div class="env-stat-card">
                        <span class="env-stat-value">${totalClaimCount}</span>
                        <span class="env-stat-label">Total Claims</span>
                    </div>
                `;
      }

      // Update table
      const tbody = document.querySelector("#red-envelope .admin-table tbody");
      if (tbody) {
        tbody.innerHTML = envelopes
          .map((env) => {
            const claimedAmount = env.amount * env.current_claims;
            const maxTotal = env.amount * env.max_claims;
            const remaining = maxTotal - claimedAmount;
            const claimLink =
              env.claim_link ||
              `${window.location.origin}/claim.html?code=${env.code}`;
            return `
                        <tr>
                            <td>
                                <div>#RE${env.id.toString().padStart(3, "0")}</div>
                                <div class="envelope-code" style="font-size: 11px; color: #facc15; margin-top: 4px;">${env.code}</div>
                            </td>
                            <td>$${env.amount.toFixed(2)}</td>
                            <td class="green">$${claimedAmount.toFixed(2)}</td>
                            <td>$${remaining.toFixed(2)}</td>
                            <td>${env.current_claims}/${env.max_claims}</td>
                            <td>${formatDate(env.created_at)}</td>
                            <td>${env.expires_at ? formatDate(env.expires_at) : "Never"}</td>
                            <td><span class="status-badge ${env.is_active ? "active" : "expired"}">${env.is_active ? "Active" : "Inactive"}</span></td>
                            <td class="actions envelope-actions">
                                <button class="btn-sm btn-copy" onclick="copyEnvelopeLink('${claimLink}')" title="Copy Link">📋 Copy</button>
                                <button class="btn-sm btn-view" onclick="viewEnvelopeClaims(${env.id})">View</button>
                                ${env.is_active ? `<button class="btn-sm btn-deactivate" onclick="deactivateEnvelope(${env.id})">Deactivate</button>` : ""}
                            </td>
                        </tr>
                    `;
          })
          .join("");
      }
    }
  } catch (error) {
    console.error("Failed to load red envelopes:", error);
  }
}

async function createRedEnvelope() {
  console.log("[DEBUG] createRedEnvelope called");
  const amount = parseFloat(
    document.getElementById("envelopeAmount")?.value || 0,
  );
  const max_claims = parseInt(
    document.getElementById("envelopeMaxClaims")?.value || 1,
  );
  const expires_in_hours = parseInt(
    document.getElementById("envelopeExpiry")?.value || 0,
  );
  const eligibility =
    document.getElementById("envelopeEligibility")?.value || "all";
  const target_uid = document.getElementById("targetUid")?.value?.trim() || "";
  const isActive = document.getElementById("envelopeActive")?.checked ?? true;

  console.log("[DEBUG] Red envelope data:", {
    amount,
    max_claims,
    expires_in_hours,
    eligibility,
    target_uid,
    isActive,
  });

  if (!amount || amount <= 0) {
    showNotification("Please enter a valid reward amount", "error");
    return;
  }

  if (!max_claims || max_claims <= 0) {
    showNotification("Please enter a valid max claims number", "error");
    return;
  }

  // Validate specific_user eligibility ONLY if that option is selected
  if (eligibility === 'specific_user') {
    if (!target_uid || target_uid === '') {
      showNotification("Please enter target user UID for specific user eligibility", "error");
      return;
    }
  }

  try {
    const response = await apiCall("/admin/promotions/red-envelopes", "POST", {
      amount,
      max_claims,
      expires_in_hours: expires_in_hours > 0 ? expires_in_hours : null,
      eligibility_rule: eligibility,
      target_uid: eligibility === 'specific_user' ? target_uid : null,
      is_active: isActive,
    });

    console.log("[DEBUG] Red envelope created:", response);
    if (response.success) {
      const claimLink =
        response.data.claim_link ||
        `${window.location.origin}/claim.html?code=${response.data.code}`;

      // Show success with copy option
      showNotification(
        `Red Envelope created! Code: ${response.data.code}`,
        "success",
      );

      // Show modal with claim link
      const copyLink = confirm(
        `Red Envelope Created!\n\nCode: ${response.data.code}\nClaim Link: ${claimLink}\n\nClick OK to copy the link to clipboard.`,
      );
      if (copyLink) {
        copyEnvelopeLink(claimLink);
      }

      loadRedEnvelopes();

      // Reset form
      document.getElementById("envelopeAmount").value = "10";
      document.getElementById("envelopeMaxClaims").value = "100";
      document.getElementById("envelopeExpiry").value = "24";
      document.getElementById("envelopeEligibility").value = "all";
      document.getElementById("targetUid").value = "";
      document.getElementById("targetUidGroup").style.display = "none";
    }
  } catch (error) {
    console.error("[DEBUG] Failed to create envelope:", error);
    showNotification("Failed to create envelope: " + error.message, "error");
  }
}

// Keep old function for backwards compatibility
async function createEnvelope() {
  await createRedEnvelope();
}

// Deactivate red envelope
async function deactivateEnvelope(envelopeId) {
  console.log("[DEBUG] deactivateEnvelope called for ID:", envelopeId);
  if (!confirm("Are you sure you want to deactivate this red envelope?"))
    return;

  try {
    await apiCall(
      `/admin/promotions/red-envelopes/${envelopeId}/deactivate`,
      "POST",
    );
    showNotification("Red envelope deactivated", "success");
    loadRedEnvelopes();
  } catch (error) {
    console.error("[DEBUG] Failed to deactivate envelope:", error);
    showNotification("Failed to deactivate: " + error.message, "error");
  }
}

// Copy envelope claim link to clipboard
function copyEnvelopeLink(link) {
  navigator.clipboard
    .writeText(link)
    .then(() => {
      showNotification("Claim link copied to clipboard!", "success");
    })
    .catch((err) => {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      showNotification("Claim link copied to clipboard!", "success");
    });
}

// ==================== PROMOTIONS ====================
async function loadPromotionConfig() {
  try {
    const response = await apiCall("/admin/promotions/config");
    if (response.success) {
      const data = response.data;

      // Update commission rate inputs
      const promoForm = document.querySelector(
        "#promotions .control-card:first-child .promo-form",
      );
      if (promoForm) {
        const inputs = promoForm.querySelectorAll('input[type="number"]');
        if (inputs[0] && data.commission_l1_percent)
          inputs[0].value = data.commission_l1_percent.value;
        if (inputs[1] && data.commission_l2_percent)
          inputs[1].value = data.commission_l2_percent.value;
        if (inputs[2] && data.commission_l3_percent)
          inputs[2].value = data.commission_l3_percent.value;
      }

      // Update first deposit bonus
      const bonusForm = document.querySelector(
        "#promotions .control-card:nth-child(2) .promo-form",
      );
      if (bonusForm && data.first_recharge_bonus_enabled) {
        const toggle = bonusForm.querySelector('input[type="checkbox"]');
        if (toggle)
          toggle.checked = data.first_recharge_bonus_enabled.value === "true";

        const inputs = bonusForm.querySelectorAll('input[type="number"]');
        if (inputs[0] && data.first_recharge_bonus_percent)
          inputs[0].value = data.first_recharge_bonus_percent.value;
      }
    }

    // Also load bet tax config
    loadBetTaxConfig();
  } catch (error) {
    console.error("Failed to load promotion config:", error);
  }
}

async function loadReferralStats() {
  try {
    const response = await apiCall("/admin/referrals/stats");
    if (response.success) {
      const data = response.data;
      const statsContainer = document.querySelector("#promotions .promo-stats");

      if (statsContainer) {
        const rows = statsContainer.querySelectorAll(".promo-stat-row");
        if (rows[0])
          rows[0].querySelector(".value").textContent =
            data.totalReferrals.toLocaleString();
        if (rows[1])
          rows[1].querySelector(".value").textContent =
            "$" + data.todayCommissions.toFixed(2);
        if (rows[2])
          rows[2].querySelector(".value").textContent =
            "$" + data.totalCommissions.toFixed(2);
        if (rows[3])
          rows[3].querySelector(".value").textContent =
            "$" + data.firstRechargeBonuses.toFixed(2);
        if (rows[4])
          rows[4].querySelector(".value").textContent =
            data.activePromoters.toString();
      }
    }
  } catch (error) {
    console.error("Failed to load referral stats:", error);
  }
}

async function updateCommissionRates() {
  console.log("[DEBUG] updateCommissionRates called");
  const form = document.querySelector(
    "#promotions .control-card:first-child .promo-form",
  );
  if (!form) {
    console.error("[DEBUG] Commission form not found");
    return;
  }

  const inputs = form.querySelectorAll('input[type="number"]');
  const level_1 = parseFloat(inputs[0]?.value);
  const level_2 = parseFloat(inputs[1]?.value);
  const level_3 = parseFloat(inputs[2]?.value);

  console.log("[DEBUG] Commission rates:", { level_1, level_2, level_3 });

  try {
    await apiCall("/admin/promotions/commission-rates", "PUT", {
      level_1,
      level_2,
      level_3,
    });
    showNotification("Commission rates updated successfully!", "success");
  } catch (error) {
    console.error("[DEBUG] Failed to update commission rates:", error);
    showNotification("Failed to update: " + error.message, "error");
  }
}

async function updateFirstRechargeBonus() {
  const form = document.querySelector(
    "#promotions .control-card:nth-child(2) .promo-form",
  );
  if (!form) return;

  const toggle = form.querySelector('input[type="checkbox"]');
  const inputs = form.querySelectorAll('input[type="number"]');

  try {
    await apiCall("/admin/promotions/first-recharge-bonus", "PUT", {
      enabled: toggle?.checked,
      bonus_percent: parseFloat(inputs[0]?.value),
    });
    showNotification("First recharge bonus updated!", "success");
  } catch (error) {
    showNotification("Failed to update: " + error.message, "error");
  }
}

// ==================== BET TAX ====================
async function loadBetTaxConfig() {
  try {
    const response = await apiCall("/admin/promotions/bet-tax");
    if (response.success) {
      const taxInput = document.getElementById("betTaxPercent");
      if (taxInput) {
        taxInput.value = response.data.bet_tax_percent;
      }
    }
  } catch (error) {
    console.error("Failed to load bet tax config:", error);
  }
}

async function updateBetTax() {
  console.log("[DEBUG] updateBetTax called");
  const taxInput = document.getElementById("betTaxPercent");
  if (!taxInput) {
    console.error("[DEBUG] Bet tax input not found");
    return;
  }

  const tax_percent = parseFloat(taxInput.value);
  console.log("[DEBUG] Bet tax value:", tax_percent);

  if (isNaN(tax_percent) || tax_percent < 0 || tax_percent > 50) {
    showNotification("Tax percent must be between 0 and 50", "error");
    return;
  }

  try {
    await apiCall("/admin/promotions/bet-tax", "PUT", { tax_percent });
    showNotification("Bet tax rate updated!", "success");
  } catch (error) {
    console.error("[DEBUG] Failed to update bet tax:", error);
    showNotification("Failed to update: " + error.message, "error");
  }
}

// ==================== ANNOUNCEMENTS ====================
async function loadAnnouncements() {
  try {
    const response = await apiCall("/admin/announcements");
    if (response.success) {
      const list = document.querySelector(".announcement-list");
      if (list) {
        list.innerHTML = response.data
          .map(
            (a) => `
                    <div class="announcement-card ${a.type}">
                        <div class="announce-header">
                            <span class="announce-type">${getAnnouncementIcon(a.type)} ${capitalize(a.type)}</span>
                            <span class="announce-date">${formatDate(a.created_at)}</span>
                        </div>
                        <h4 class="announce-title">${escapeHtml(a.title)}</h4>
                        <p class="announce-text">${escapeHtml(a.message)}</p>
                        <div class="announce-actions">
                            <button class="btn-sm btn-delete" onclick="deleteAnnouncement(${a.id})">Delete</button>
                        </div>
                    </div>
                `,
          )
          .join("");
      }
    }
  } catch (error) {
    console.error("Failed to load announcements:", error);
  }
}

async function createAnnouncement() {
  const form = document.querySelector(".announce-form");
  if (!form) return;

  const title = form.querySelector(
    'input[placeholder="Announcement title"]',
  )?.value;
  const message = form.querySelector("textarea")?.value;
  const type = form.querySelector("select")?.value || "info";
  const showAsPopup =
    form.querySelector('input[type="checkbox"]')?.checked || false;

  if (!title || !message) {
    showNotification("Title and message are required", "error");
    return;
  }

  try {
    await apiCall("/admin/announcements", "POST", {
      title,
      message,
      type,
      showAsPopup,
    });
    showNotification("Announcement published!", "success");

    // Clear form
    form.querySelector('input[placeholder="Announcement title"]').value = "";
    form.querySelector("textarea").value = "";

    loadAnnouncements();
  } catch (error) {
    showNotification("Failed to create: " + error.message, "error");
  }
}

async function deleteAnnouncement(id) {
  if (!confirm("Delete this announcement?")) return;

  try {
    await apiCall(`/admin/announcements/${id}`, "DELETE");
    showNotification("Announcement deleted", "success");
    loadAnnouncements();
  } catch (error) {
    showNotification("Failed to delete: " + error.message, "error");
  }
}

// ==================== TOGGLE SWITCHES ====================
function initToggles() {
  const autoMode = document.getElementById("autoMode");
  const manualOverride = document.getElementById("manualOverride");
  const pauseGame = document.getElementById("pauseGame");

  if (autoMode) {
    autoMode.addEventListener("change", function () {
      document.getElementById("autoStatus").textContent = this.checked
        ? "ON"
        : "OFF";
      if (this.checked && manualOverride) {
        manualOverride.checked = false;
        document.getElementById("manualStatus").textContent = "OFF";
      }
    });
  }

  if (manualOverride) {
    manualOverride.addEventListener("change", function () {
      document.getElementById("manualStatus").textContent = this.checked
        ? "ON"
        : "OFF";
      if (this.checked && autoMode) {
        autoMode.checked = false;
        document.getElementById("autoStatus").textContent = "OFF";
      }
    });
  }

  if (pauseGame) {
    pauseGame.addEventListener("change", async function () {
      document.getElementById("pauseStatus").textContent = this.checked
        ? "ON"
        : "OFF";

      try {
        if (this.checked) {
          await apiCall("/admin/game/pause", "POST");
          showNotification("Game paused - no new rounds will start", "success");
        } else {
          await apiCall("/admin/game/resume", "POST");
          showNotification("Game resumed - rounds will continue", "success");
        }
      } catch (error) {
        showNotification(
          "Failed to update game state: " + error.message,
          "error",
        );
        this.checked = !this.checked;
        document.getElementById("pauseStatus").textContent = this.checked
          ? "ON"
          : "OFF";
      }
    });
  }
}

// ==================== SETTINGS ====================
async function loadSettings() {
  try {
    const response = await apiCall("/admin/settings");
    if (response.success) {
      const data = response.data;

      // General Settings
      const generalForm = document.querySelector(
        "#settings .settings-grid .control-card:nth-child(1) .settings-form",
      );
      if (generalForm) {
        const inputs = generalForm.querySelectorAll(".form-input");
        if (inputs[0]) inputs[0].value = data.site_name;
        if (inputs[1]) inputs[1].value = data.support_email;
        if (inputs[2]) inputs[2].value = data.support_whatsapp;
        if (inputs[3]) inputs[3].value = data.telegram_channel;
      }

      // Game Settings
      const gameForm = document.querySelector(
        "#settings .settings-grid .control-card:nth-child(2) .settings-form",
      );
      if (gameForm) {
        const inputs = gameForm.querySelectorAll(".form-input");
        if (inputs[0]) inputs[0].value = data.round_duration;
        if (inputs[1]) inputs[1].value = data.min_bet;
        if (inputs[2]) inputs[2].value = data.max_bet;
        if (inputs[3]) inputs[3].value = data.house_edge;
      }

      // Wallet Settings
      const walletForm = document.querySelector(
        "#settings .settings-grid .control-card:nth-child(3) .settings-form",
      );
      if (walletForm) {
        const inputs = walletForm.querySelectorAll(".form-input");
        if (inputs[0]) inputs[0].value = data.min_deposit;
        if (inputs[1]) inputs[1].value = data.min_withdrawal;
        if (inputs[2]) inputs[2].value = data.max_withdrawal;
        if (inputs[3]) inputs[3].value = data.usdt_wallet_address;
      }
    }
  } catch (error) {
    console.error("Failed to load settings:", error);
  }
}

async function saveGeneralSettings() {
  console.log("[DEBUG] saveGeneralSettings called");
  const form = document.querySelector(
    "#settings .settings-grid .control-card:nth-child(1) .settings-form",
  );
  if (!form) {
    console.error("[DEBUG] General settings form not found");
    return;
  }

  const inputs = form.querySelectorAll(".form-input");
  const payload = {
    category: "general",
    settings: {
      site_name: inputs[0]?.value || "LuxWin",
      support_email: inputs[1]?.value || "",
      support_whatsapp: inputs[2]?.value || "",
      telegram_channel: inputs[3]?.value || "",
    },
  };
  console.log("[DEBUG] Saving general settings:", payload);

  try {
    await apiCall("/admin/settings", "PUT", payload);
    showNotification("General settings saved!", "success");
  } catch (error) {
    console.error("[DEBUG] Failed to save general settings:", error);
    showNotification("Failed to save settings: " + error.message, "error");
  }
}

async function saveGameSettings() {
  console.log("[DEBUG] saveGameSettings called");
  const form = document.querySelector(
    "#settings .settings-grid .control-card:nth-child(2) .settings-form",
  );
  if (!form) {
    console.error("[DEBUG] Game settings form not found");
    return;
  }

  const inputs = form.querySelectorAll(".form-input");
  const payload = {
    category: "game",
    settings: {
      round_duration: inputs[0]?.value || "180",
      min_bet: inputs[1]?.value || "1",
      max_bet: inputs[2]?.value || "1000",
      house_edge: inputs[3]?.value || "5",
    },
  };
  console.log("[DEBUG] Saving game settings:", payload);

  try {
    await apiCall("/admin/settings", "PUT", payload);
    showNotification("Game settings saved!", "success");
  } catch (error) {
    console.error("[DEBUG] Failed to save game settings:", error);
    showNotification("Failed to save settings: " + error.message, "error");
  }
}

async function saveWalletSettings() {
  console.log("[DEBUG] saveWalletSettings called");
  const form = document.querySelector(
    "#settings .settings-grid .control-card:nth-child(3) .settings-form",
  );
  if (!form) {
    console.error("[DEBUG] Wallet settings form not found");
    return;
  }

  const inputs = form.querySelectorAll(".form-input");
  const payload = {
    category: "wallet",
    settings: {
      min_deposit: inputs[0]?.value || "10",
      min_withdrawal: inputs[1]?.value || "20",
      max_withdrawal: inputs[2]?.value || "5000",
      usdt_wallet_address: inputs[3]?.value || "",
    },
  };
  console.log("[DEBUG] Saving wallet settings:", payload);

  try {
    await apiCall("/admin/settings", "PUT", payload);
    showNotification("Wallet settings saved!", "success");
  } catch (error) {
    console.error("[DEBUG] Failed to save wallet settings:", error);
    showNotification("Failed to save settings: " + error.message, "error");
  }
}

// ==================== FORM HANDLERS ====================
function initFormHandlers() {
  // Search handler
  document.querySelectorAll(".search-input").forEach((input) => {
    input.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        loadUsers(this.value);
      }
    });
  });

  // Filter tabs
  document.querySelectorAll(".filter-tab").forEach((tab) => {
    tab.addEventListener("click", function () {
      this.parentElement
        .querySelectorAll(".filter-tab")
        .forEach((t) => t.classList.remove("active"));
      this.classList.add("active");

      const status = this.textContent.toLowerCase();
      loadWithdrawals(status === "all" ? "all" : status);
    });
  });
}

// ==================== NOTIFICATION ====================
function showNotification(message, type = "info") {
  const existingNotif = document.querySelector(".admin-notification");
  if (existingNotif) existingNotif.remove();

  const notif = document.createElement("div");
  notif.className = `admin-notification ${type}`;
  notif.innerHTML = `
        <span class="notif-icon">${type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️"}</span>
        <span class="notif-message">${message}</span>
    `;

  notif.style.cssText = `
        position: fixed;
        top: 24px;
        right: 24px;
        padding: 16px 24px;
        background: ${type === "success"
      ? "rgba(34, 197, 94, 0.95)"
      : type === "error"
        ? "rgba(239, 68, 68, 0.95)"
        : "rgba(59, 130, 246, 0.95)"
    };
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 9999;
        animation: slideIn 0.3s ease;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        color: #fff;
        font-weight: 500;
    `;

  document.body.appendChild(notif);

  setTimeout(() => {
    notif.style.animation = "slideOut 0.3s ease";
    setTimeout(() => notif.remove(), 300);
  }, 3000);
}

// Add animation keyframes
const style = document.createElement("style");
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// ==================== UTILITY FUNCTIONS ====================
function formatTimeAgo(timestamp) {
  const now = new Date();
  const time = new Date(timestamp);
  const diff = Math.floor((now - time) / 1000);

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

function formatDate(timestamp) {
  if (!timestamp) return "N/A";
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Copy to clipboard utility function
function copyToClipboard(text, successMessage = "Copied!") {
  if (!navigator.clipboard) {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand("copy");
      showCopyToast(successMessage);
    } catch (err) {
      showCopyToast("Failed to copy", "error");
    }
    document.body.removeChild(textArea);
    return;
  }

  navigator.clipboard.writeText(text)
    .then(() => {
      showCopyToast(successMessage);
    })
    .catch((err) => {
      console.error("Failed to copy:", err);
      showCopyToast("Failed to copy", "error");
    });
}

// Show copy toast notification
function showCopyToast(message, type = "success") {
  const existingToast = document.querySelector(".copy-toast");
  if (existingToast) existingToast.remove();

  const toast = document.createElement("div");
  toast.className = "copy-toast";
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 24px;
    right: 24px;
    padding: 12px 20px;
    background: ${type === "success" ? "rgba(34, 197, 94, 0.95)" : "rgba(239, 68, 68, 0.95)"};
    color: #fff;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 99999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideInRight 0.3s ease;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "slideOutRight 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 1500);
}

// Add animation for copy toast
if (!document.getElementById("copyToastStyles")) {
  const toastStyle = document.createElement("style");
  toastStyle.id = "copyToastStyles";
  toastStyle.textContent = `
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
    .copy-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      margin-left: 8px;
      cursor: pointer;
      opacity: 0.6;
      transition: opacity 0.2s;
      vertical-align: middle;
    }
    .copy-icon:hover {
      opacity: 1;
    }
    .copy-icon svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }
  `;
  document.head.appendChild(toastStyle);
}

function getAnnouncementIcon(type) {
  switch (type) {
    case "promo":
      return "🎁";
    case "warning":
      return "⚠️";
    case "success":
      return "✅";
    default:
      return "ℹ️";
  }
}

function viewUser(userId) {
  viewUserDetails(userId);
}

async function viewUserDetails(userId) {
  try {
    const response = await apiCall(`/admin/users/${userId}/details`);
    if (response.success) {
      const data = response.data;
      const user = data.user;
      const stats = data.stats;

      // Create modal HTML
      const modalHtml = `
                <div class="admin-modal" id="userModal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>User Details - ${user.email}</h3>
                            <button class="modal-close" onclick="closeModal('userModal')">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <span class="label">User ID</span>
                                    <span class="value">${user.id.substring(0, 8)}...</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Country</span>
                                    <span class="value">${user.country}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Balance</span>
                                    <span class="value ${user.balance >= 0 ? "green" : "red"}">$${user.balance.toFixed(2)}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Status</span>
                                    <span class="value">${user.isBanned ? "🚫 Banned" : "✅ Active"}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Total Deposits</span>
                                    <span class="value">$${stats.totalDeposits.toFixed(2)}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Total Bets</span>
                                    <span class="value">$${stats.totalBets.toFixed(2)}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Total Winnings</span>
                                    <span class="value">$${stats.totalWinnings.toFixed(2)}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Total Withdrawals</span>
                                    <span class="value">$${stats.totalWithdrawals.toFixed(2)}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Bet Count</span>
                                    <span class="value">${stats.totalBetCount}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Registered</span>
                                    <span class="value">${formatDate(user.createdAt)}</span>
                                </div>
                            </div>
                            <h4 style="margin-top: 20px;">Recent Transactions</h4>
                            <div class="mini-table">
                                ${data.recentTransactions
          .map(
            (t) => `
                                    <div class="mini-row">
                                        <span>${t.type}</span>
                                        <span class="${t.amount >= 0 ? "green" : "red"}">$${parseFloat(t.amount).toFixed(2)}</span>
                                        <span>${formatTimeAgo(t.created_at)}</span>
                                    </div>
                                `,
          )
          .join("")}
                            </div>
                        </div>
                    </div>
                </div>
            `;

      document.body.insertAdjacentHTML("beforeend", modalHtml);
      addModalStyles();
    }
  } catch (error) {
    showNotification("Failed to load user details: " + error.message, "error");
  }
}

function viewWithdrawal(withdrawalId) {
  viewWithdrawalDetails(withdrawalId);
}

async function viewWithdrawalDetails(withdrawalId) {
  try {
    const response = await apiCall(
      `/admin/withdrawals/${withdrawalId}/details`,
    );
    if (response.success) {
      const data = response.data;
      const w = data.withdrawal;

      const modalHtml = `
                <div class="admin-modal" id="withdrawalModal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>Withdrawal #W${w.id.toString().padStart(3, "0")}</h3>
                            <button class="modal-close" onclick="closeModal('withdrawalModal')">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <span class="label">User</span>
                                    <span class="value">${w.email}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Country</span>
                                    <span class="value">${w.country}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Amount</span>
                                    <span class="value red">$${w.amount.toFixed(2)}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Fee</span>
                                    <span class="value">$${w.fee.toFixed(2)}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Net Amount</span>
                                    <span class="value red">$${w.netAmount.toFixed(2)}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Status</span>
                                    <span class="value status-badge ${w.status}">${capitalize(w.status)}</span>
                                </div>
                                <div class="detail-item full-width">
                                    <span class="label">Wallet Address</span>
                                    <span class="value" style="word-break: break-all; display: inline-flex; align-items: center; gap: 8px;">
                                        <span>${w.walletAddress}</span>
                                        <span class="copy-icon" onclick="copyToClipboard('${w.walletAddress}', 'Address Copied');" title="Copy address">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                            </svg>
                                        </span>
                                    </span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Current Balance</span>
                                    <span class="value">$${w.currentBalance.toFixed(2)}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Requested</span>
                                    <span class="value">${formatDate(w.createdAt)}</span>
                                </div>
                                ${w.processedAt
          ? `
                                <div class="detail-item">
                                    <span class="label">Processed</span>
                                    <span class="value">${formatDate(w.processedAt)}</span>
                                </div>
                                `
          : ""
        }
                                ${w.notes
          ? `
                                <div class="detail-item full-width">
                                    <span class="label">Notes</span>
                                    <span class="value">${escapeHtml(w.notes)}</span>
                                </div>
                                `
          : ""
        }
                            </div>
                            <h4 style="margin-top: 20px;">Withdrawal History</h4>
                            <div class="mini-table">
                                ${data.withdrawalHistory
          .map(
            (h) => `
                                    <div class="mini-row">
                                        <span>#W${h.id.toString().padStart(3, "0")}</span>
                                        <span class="red">$${h.netAmount.toFixed(2)}</span>
                                        <span class="status-badge ${h.status}">${capitalize(h.status)}</span>
                                        <span>${formatTimeAgo(h.createdAt)}</span>
                                    </div>
                                `,
          )
          .join("")}
                            </div>
                        </div>
                    </div>
                </div>
            `;

      document.body.insertAdjacentHTML("beforeend", modalHtml);
      addModalStyles();
    }
  } catch (error) {
    showNotification(
      "Failed to load withdrawal details: " + error.message,
      "error",
    );
  }
}

function viewEnvelopeClaims(envelopeId) {
  viewEnvelopeClaimsDetails(envelopeId);
}

async function viewEnvelopeClaimsDetails(envelopeId) {
  try {
    const response = await apiCall(
      `/admin/promotions/red-envelopes/${envelopeId}/claims`,
    );
    if (response.success) {
      const claims = response.data;

      const modalHtml = `
                <div class="admin-modal" id="claimsModal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>Red Envelope #RE${envelopeId.toString().padStart(3, "0")} - Claims</h3>
                            <button class="modal-close" onclick="closeModal('claimsModal')">&times;</button>
                        </div>
                        <div class="modal-body">
                            ${claims.length === 0
          ? "<p>No claims yet</p>"
          : `
                                <div class="mini-table">
                                    <div class="mini-row header">
                                        <span>User</span>
                                        <span>Amount</span>
                                        <span>Claimed At</span>
                                    </div>
                                    ${claims
            .map(
              (c) => `
                                        <div class="mini-row">
                                            <span>${c.claimed_by}</span>
                                            <span class="green">$${c.amount.toFixed(2)}</span>
                                            <span>${formatDate(c.claimed_at)}</span>
                                        </div>
                                    `,
            )
            .join("")}
                                </div>
                            `
        }
                        </div>
                    </div>
                </div>
            `;

      document.body.insertAdjacentHTML("beforeend", modalHtml);
      addModalStyles();
    }
  } catch (error) {
    showNotification("Failed to load claims: " + error.message, "error");
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.remove();
}

function addModalStyles() {
  if (document.getElementById("modalStyles")) return;

  const styles = document.createElement("style");
  styles.id = "modalStyles";
  styles.textContent = `
        .admin-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        }
        .modal-content {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-radius: 16px;
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
            overflow: auto;
            border: 1px solid rgba(192, 132, 252, 0.3);
        }
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .modal-header h3 { margin: 0; color: #fff; }
        .modal-close {
            background: none;
            border: none;
            color: #fff;
            font-size: 24px;
            cursor: pointer;
        }
        .modal-body { padding: 20px; }
        .detail-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
        }
        .detail-item {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .detail-item.full-width { grid-column: 1 / -1; }
        .detail-item .label { color: #9ca3af; font-size: 12px; }
        .detail-item .value { color: #fff; font-size: 14px; }
        .mini-table { margin-top: 10px; }
        .mini-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            color: #fff;
            font-size: 13px;
        }
        .mini-row.header { font-weight: 600; color: #9ca3af; }
        .green { color: #4ade80; }
        .red { color: #f87171; }
    `;
  document.head.appendChild(styles);
}

// ==================== REFERRAL CONTROL ====================
let currentReferralRiskFilter = "all";

async function loadReferralList(riskLevel = null) {
  try {
    const filter = riskLevel || currentReferralRiskFilter;
    const params = filter !== "all" ? `?risk_level=${filter}` : "";

    const response = await apiCall(`/admin/referrals/list${params}`);

    // Log full API response for debugging
    console.log('[REFERRAL LIST] Full API response:', JSON.stringify(response, null, 2));

    if (response.success) {
      const tbody = document.getElementById("referralListTableBody");
      if (tbody) {
        // Safe fallback: ensure we have an array to work with
        const referralList = Array.isArray(response.data)
          ? response.data
          : (response.data && Array.isArray(response.data.referrals))
            ? response.data.referrals
            : [];

        console.log('[REFERRAL LIST] Processing', referralList.length, 'referrals');

        if (referralList.length === 0) {
          tbody.innerHTML = `
            <tr>
              <td colspan="9" style="text-align: center; padding: 40px; color: #9ca3af;">
                No referral data available
              </td>
            </tr>
          `;
        } else {
          tbody.innerHTML = referralList
            .map(
              (ref) => `
                    <tr data-inviter-id="${ref.inviter_uid || ref.inviter_id || ''}">
                        <td>#${(ref.inviter_uid || ref.inviter_id || 'N/A').substring(0, 8)}</td>
                        <td>
                            <span class="status-badge ${ref.risk_level || 'Low'}">
                                ${ref.risk_level === "red" ? "🔴" : ref.risk_level === "yellow" ? "🟡" : "🟢"} ${capitalize(ref.risk_level || 'Low')}
                            </span>
                        </td>
                        <td>${ref.team_count || 0}</td>
                        <td class="green">$${parseFloat(ref.team_recharge || ref.total_team_recharge || 0).toFixed(2)}</td>
                        <td class="green">$${parseFloat(ref.total_commission || 0).toFixed(2)}</td>
                        <td><span class="${(ref.same_ip_count || 0) > 0 ? "red" : "green"}">${ref.same_ip_count || 0}</span></td>
                        <td><span class="${(ref.same_device_count || 0) > 0 ? "red" : "green"}">${ref.same_device_count || 0}</span></td>
                        <td><span class="${(ref.active_flags || 0) > 0 ? "red" : "green"}">${ref.active_flags || 0}</span></td>
                        <td class="actions">
                            <button class="btn-sm btn-view" onclick="viewReferralDetails('${ref.inviter_uid || ref.inviter_id || ''}')">View Details</button>
                        </td>
                    </tr>
                `,
            )
            .join("");
        }
      }
    } else {
      console.error('[REFERRAL LIST] API returned success: false');
      showNotification("Failed to load referral list", "error");
    }
  } catch (error) {
    console.error('[REFERRAL LIST] Error:', error);
    showNotification("Failed to load referral list: " + error.message, "error");

    // Show empty table instead of crashing
    const tbody = document.getElementById("referralListTableBody");
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 40px; color: #ef4444;">
            Error loading referral data. Please try again.
          </td>
        </tr>
      `;
    }
  }
}

function filterReferralsByRisk(riskLevel) {
  currentReferralRiskFilter = riskLevel;

  // Update active tab
  document.querySelectorAll("#referral-control .filter-tab").forEach((tab) => {
    tab.classList.remove("active");
  });
  event.target.classList.add("active");

  loadReferralList(riskLevel);
}

async function viewReferralDetails(inviterId) {
  try {
    const response = await apiCall(`/admin/referrals/${inviterId}/details`);
    if (response.success) {
      const data = response.data;
      const inviter = data.inviter;
      const teamOverview = data.team_overview;
      const teamMembers = data.team_members;
      const flags = data.security_flags;

      const modalHtml = `
                <div class="admin-modal" id="referralDetailModal">
                    <div class="modal-content" style="max-width: 900px;">
                        <div class="modal-header">
                            <h3>👨‍👩‍👧‍👦 Referral Team Details - #${inviter.id.substring(0, 8)}</h3>
                            <button class="modal-close" onclick="closeModal('referralDetailModal')">&times;</button>
                        </div>
                        <div class="modal-body">
                            <!-- Inviter Summary -->
                            <h4>Inviter Summary</h4>
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <span class="label">Inviter ID</span>
                                    <span class="value">#${inviter.id.substring(0, 8)}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Email</span>
                                    <span class="value">${inviter.email.substring(0, 15)}***</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Risk Level</span>
                                    <span class="value">
                                        <span class="status-badge ${inviter.risk_level}">
                                            ${inviter.risk_level === "red" ? "🔴" : inviter.risk_level === "yellow" ? "🟡" : "🟢"} ${capitalize(inviter.risk_level)}
                                        </span>
                                    </span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Risk Score</span>
                                    <span class="value ${inviter.risk_score > 50 ? "red" : "green"}">${inviter.risk_score}/100</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Balance</span>
                                    <span class="value green">$${parseFloat(inviter.balance).toFixed(2)}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Status</span>
                                    <span class="value">${inviter.is_banned ? "🚫 Banned" : "✅ Active"}</span>
                                </div>
                            </div>

                            <!-- Team Overview -->
                            <h4 style="margin-top: 20px;">Team Overview</h4>
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <span class="label">Total Team Members</span>
                                    <span class="value">${teamOverview.total_team_members}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Banned Members</span>
                                    <span class="value red">${teamOverview.banned_members || 0}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Total Recharge</span>
                                    <span class="value green">$${parseFloat(teamOverview.total_team_recharge).toFixed(2)}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Total Withdrawal</span>
                                    <span class="value red">$${parseFloat(teamOverview.total_team_withdrawal).toFixed(2)}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Total Commission</span>
                                    <span class="value green">$${parseFloat(inviter.total_commission).toFixed(2)}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Total Bets</span>
                                    <span class="value">$${parseFloat(teamOverview.total_team_bets).toFixed(2)}</span>
                                </div>
                            </div>

                            <!-- Security Flags -->
                            ${flags.length > 0
          ? `
                            <h4 style="margin-top: 20px;">Security Flags</h4>
                            <div class="mini-table">
                                ${flags
            .map(
              (f) => `
                                    <div class="mini-row" style="color: ${f.severity === "critical" ? "#ef4444" : f.severity === "high" ? "#f59e0b" : "#3b82f6"};">
                                        <span>${f.flag_type.replace(/_/g, " ")}</span>
                                        <span>${f.severity.toUpperCase()}</span>
                                        <span>${f.is_resolved ? "✅ Resolved" : "⚠️ Active"}</span>
                                    </div>
                                `,
            )
            .join("")}
                            </div>
                            `
          : ""
        }

                            <!-- Team Members -->
                            <h4 style="margin-top: 20px;">Team Members (${teamMembers.length})</h4>
                            <div class="mini-table" style="max-height: 300px; overflow-y: auto;">
                                <div class="mini-row header">
                                    <span>UID</span>
                                    <span>Deposits</span>
                                    <span>Commission</span>
                                    <span>Flags</span>
                                </div>
                                ${teamMembers
          .map(
            (member) => `
                                    <div class="mini-row">
                                        <span>#${member.id.substring(0, 8)} ${member.same_ip_flag ? "🔴IP" : ""} ${member.same_device_flag ? "🔴DEV" : ""}</span>
                                        <span class="green">$${parseFloat(member.total_deposits).toFixed(2)}</span>
                                        <span class="green">$${parseFloat(member.commission_given).toFixed(2)}</span>
                                        <span class="${member.active_flags > 0 ? "red" : "green"}">${member.active_flags}</span>
                                    </div>
                                `,
          )
          .join("")}
                            </div>

                            <!-- Action Buttons -->
                            ${!inviter.is_banned
          ? `
                            <div style="margin-top: 20px; display: flex; gap: 10px;">
                                <button class="btn btn-danger" onclick="showBanReferralModal('${inviter.id}', 'inviter')">🚫 Ban Inviter Only</button>
                                <button class="btn btn-danger" onclick="showBanReferralModal('${inviter.id}', 'team')" style="background: #dc2626;">🚫 Ban Entire Team</button>
                            </div>
                            `
          : `
                            <div style="margin-top: 20px;">
                                <button class="btn btn-primary" onclick="unbanReferralTeam('${inviter.id}', 'inviter')">✅ Unban</button>
                            </div>
                            `
        }
                        </div>
                    </div>
                </div>
            `;

      document.body.insertAdjacentHTML("beforeend", modalHtml);
      addModalStyles();
    }
  } catch (error) {
    showNotification(
      "Failed to load referral details: " + error.message,
      "error",
    );
  }
}

function showBanReferralModal(inviterId, scope) {
  const scopeText = scope === "team" ? "entire team" : "inviter only";
  const reason = prompt(
    `⚠️ Ban ${scopeText}\n\nEnter reason for ban (required):`,
  );
  if (!reason || reason.trim().length === 0) {
    showNotification("Ban reason is required", "error");
    return;
  }

  const revokeBonus = confirm(
    "Do you want to revoke all referral bonuses?\n\nClick OK to revoke, Cancel to keep.",
  );

  banReferralTeam(inviterId, scope, reason, revokeBonus);
}

async function banReferralTeam(inviterId, scope, reason, revokeBonus) {
  try {
    await apiCall(`/admin/referrals/${inviterId}/ban`, "POST", {
      scope,
      reason,
      revokeBonus,
    });

    showNotification(
      `Successfully banned ${scope === "team" ? "team" : "inviter"}`,
      "success",
    );

    // Close modal and refresh
    closeModal("referralDetailModal");
    loadReferralList();
  } catch (error) {
    showNotification("Failed to ban: " + error.message, "error");
  }
}

async function unbanReferralTeam(inviterId, scope) {
  if (!confirm("Are you sure you want to unban?")) return;

  try {
    await apiCall(`/admin/referrals/${inviterId}/unban`, "POST", {
      scope,
      reason: "Unbanned by admin",
    });

    showNotification("Successfully unbanned", "success");

    // Close modal and refresh
    closeModal("referralDetailModal");
    loadReferralList();
  } catch (error) {
    showNotification("Failed to unban: " + error.message, "error");
  }
}

// ==================== SECURITY / FLAGS ====================
let currentSecurityFilter = "all";

async function loadSecurityOverview() {
  try {
    const response = await apiCall("/admin/security/overview");
    if (response.success) {
      const data = response.data;

      // Update stats cards
      document.getElementById("criticalFlagsCount").textContent =
        data.stats.flags.critical_flags || 0;
      document.getElementById("highFlagsCount").textContent =
        data.stats.flags.high_flags || 0;
      document.getElementById("flaggedUsersCount").textContent =
        data.stats.flags.flagged_users || 0;
      document.getElementById("resolvedFlagsCount").textContent =
        data.resolution_stats.resolved_last_7_days || 0;
    }
  } catch (error) {
    console.error("Failed to load security overview:", error);
  }
}

async function loadFlaggedUsers(filter = null) {
  try {
    const currentFilter = filter || currentSecurityFilter;
    let params = "";

    if (currentFilter !== "all") {
      if (["critical", "high", "medium"].includes(currentFilter)) {
        params = `?severity=${currentFilter}`;
      } else {
        params = `?flag_type=${currentFilter}`;
      }
    }

    const response = await apiCall(`/admin/security/flags${params}`);
    if (response.success) {
      const tbody = document.getElementById("securityFlagsTableBody");
      if (tbody) {
        tbody.innerHTML = response.data.flagged_users
          .map(
            (user) => `
                    <tr data-user-id="${user.id}">
                        <td>#${user.id.substring(0, 8)}</td>
                        <td>${user.email.substring(0, 15)}***</td>
                        <td class="${user.risk_score > 50 ? "red" : "green"}">${user.risk_score}/100</td>
                        <td>
                            <span class="status-badge ${user.risk_level}">
                                ${user.risk_level === "red" ? "🔴" : user.risk_level === "yellow" ? "🟡" : "🟢"} ${capitalize(user.risk_level)}
                            </span>
                        </td>
                        <td><span class="red">${user.flag_count}</span></td>
                        <td style="font-size: 11px;">${(user.flag_types || []).join(", ").replace(/_/g, " ")}</td>
                        <td class="green">$${parseFloat(user.balance).toFixed(2)}</td>
                        <td><span class="status-badge ${user.is_banned ? "banned" : "active"}">${user.is_banned ? "Banned" : "Active"}</span></td>
                        <td class="actions">
                            <button class="btn-sm btn-view" onclick="viewSecurityDetails('${user.id}')">View</button>
                        </td>
                    </tr>
                `,
          )
          .join("");
      }
    }
  } catch (error) {
    showNotification("Failed to load flagged users: " + error.message, "error");
  }
}

function filterSecurityFlags(filter) {
  currentSecurityFilter = filter;

  // Update active tab
  document.querySelectorAll("#security-flags .filter-tab").forEach((tab) => {
    tab.classList.remove("active");
  });
  event.target.classList.add("active");

  loadFlaggedUsers(filter);
}

async function viewSecurityDetails(userId) {
  try {
    const response = await apiCall(`/admin/security/users/${userId}/flags`);
    if (response.success) {
      const data = response.data;
      const user = data.user;
      const flags = data.security_flags;
      const relatedUsers = data.related_users;
      const activity = data.activity;

      const modalHtml = `
                <div class="admin-modal" id="securityDetailModal">
                    <div class="modal-content" style="max-width: 900px;">
                        <div class="modal-header">
                            <h3>🛡️ Security Analysis - #${user.id.substring(0, 8)}</h3>
                            <button class="modal-close" onclick="closeModal('securityDetailModal')">&times;</button>
                        </div>
                        <div class="modal-body">
                            <!-- User Info -->
                            <h4>User Information</h4>
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <span class="label">User ID</span>
                                    <span class="value">#${user.id.substring(0, 8)}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Email</span>
                                    <span class="value">${user.email.substring(0, 20)}***</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Risk Score</span>
                                    <span class="value ${user.risk_score > 50 ? "red" : "green"}">${user.risk_score}/100</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Risk Level</span>
                                    <span class="value">
                                        <span class="status-badge ${user.risk_level}">
                                            ${user.risk_level === "red" ? "🔴" : user.risk_level === "yellow" ? "🟡" : "🟢"} ${capitalize(user.risk_level)}
                                        </span>
                                    </span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Balance</span>
                                    <span class="value green">$${parseFloat(user.balance).toFixed(2)}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Status</span>
                                    <span class="value">${user.is_banned ? "🚫 Banned" : "✅ Active"}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Signup IP</span>
                                    <span class="value">${user.signup_ip || "N/A"}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Device ID</span>
                                    <span class="value" style="font-size: 10px;">${user.device_id ? user.device_id.substring(0, 12) + "..." : "N/A"}</span>
                                </div>
                            </div>

                            <!-- Activity Stats -->
                            <h4 style="margin-top: 20px;">Activity Statistics</h4>
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <span class="label">Total Deposits</span>
                                    <span class="value green">$${parseFloat(activity.total_deposits).toFixed(2)}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Total Withdrawals</span>
                                    <span class="value red">$${parseFloat(activity.total_withdrawals).toFixed(2)}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Total Bets</span>
                                    <span class="value">$${parseFloat(activity.total_bets).toFixed(2)}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Win Rate</span>
                                    <span class="value ${parseFloat(activity.win_rate) > 70 ? "red" : "green"}">${activity.win_rate}%</span>
                                </div>
                            </div>

                            <!-- Security Flags -->
                            <h4 style="margin-top: 20px;">Security Flags (${flags.length})</h4>
                            <div class="mini-table" style="max-height: 250px; overflow-y: auto;">
                                ${flags
          .map(
            (f) => `
                                    <div class="mini-row" style="color: ${f.severity === "critical" ? "#ef4444" : f.severity === "high" ? "#f59e0b" : "#3b82f6"};">
                                        <span>${f.flag_type.replace(/_/g, " ").toUpperCase()}</span>
                                        <span>${f.severity.toUpperCase()}</span>
                                        <span>${f.description}</span>
                                        <span>${f.is_resolved ? "✅" : "⚠️"}</span>
                                        ${!f.is_resolved ? `<button class="btn-sm" onclick="resolveSecurityFlag(${f.id}, '${user.id}')" style="font-size: 10px; padding: 2px 6px;">Resolve</button>` : ""}
                                    </div>
                                `,
          )
          .join("")}
                            </div>

                            <!-- Related Users -->
                            ${relatedUsers.length > 0
          ? `
                            <h4 style="margin-top: 20px;">Related Users (Same IP/Device) - ${relatedUsers.length}</h4>
                            <div class="mini-table" style="max-height: 200px; overflow-y: auto;">
                                ${relatedUsers
            .map(
              (ru) => `
                                    <div class="mini-row">
                                        <span>#${ru.id.substring(0, 8)}</span>
                                        <span>${ru.email.substring(0, 15)}***</span>
                                        <span class="status-badge ${ru.risk_level}">${capitalize(ru.risk_level)}</span>
                                        <span>${ru.relation_type.replace(/_/g, " ")}</span>
                                        <span>${ru.is_banned ? "🚫 Banned" : "✅ Active"}</span>
                                    </div>
                                `,
            )
            .join("")}
                            </div>
                            `
          : ""
        }

                            <!-- Actions -->
                            <div style="margin-top: 20px; display: flex; gap: 10px;">
                                <button class="btn btn-primary" onclick="analyzeUserSecurity('${user.id}')">🔍 Run Analysis</button>
                                ${!user.is_banned ? `<button class="btn btn-danger" onclick="banUser('${user.id}')">🚫 Ban User</button>` : ""}
                            </div>
                        </div>
                    </div>
                </div>
            `;

      document.body.insertAdjacentHTML("beforeend", modalHtml);
      addModalStyles();
    }
  } catch (error) {
    showNotification(
      "Failed to load security details: " + error.message,
      "error",
    );
  }
}

async function resolveSecurityFlag(flagId, userId) {
  const notes = prompt("Enter resolution notes:");
  if (!notes || notes.trim().length === 0) {
    showNotification("Resolution notes are required", "error");
    return;
  }

  try {
    await apiCall(`/admin/security/flags/${flagId}/resolve`, "POST", {
      resolution_notes: notes,
    });

    showNotification("Flag resolved successfully", "success");

    // Refresh the details
    closeModal("securityDetailModal");
    viewSecurityDetails(userId);
  } catch (error) {
    showNotification("Failed to resolve flag: " + error.message, "error");
  }
}

async function analyzeUserSecurity(userId) {
  if (
    !confirm(
      "Run security analysis on this user?\n\nThis will check for suspicious patterns and create flags if detected.",
    )
  )
    return;

  try {
    const response = await apiCall(
      `/admin/security/users/${userId}/analyze`,
      "POST",
    );
    showNotification(
      response.message || "Analysis complete",
      response.data.flags_created > 0 ? "warning" : "success",
    );

    // Refresh the details
    closeModal("securityDetailModal");
    viewSecurityDetails(userId);
  } catch (error) {
    showNotification("Failed to analyze user: " + error.message, "error");
  }
}

function showBatchAnalyzeModal() {
  const riskLevel = prompt(
    "Batch Security Analysis\n\nEnter risk level to analyze (red/yellow/all):",
    "all",
  );
  if (!riskLevel) return;

  const limit = prompt("How many users to analyze?", "100");
  if (!limit) return;

  batchAnalyzeUsers(riskLevel, parseInt(limit));
}

async function batchAnalyzeUsers(riskLevel, limit) {
  try {
    showNotification(
      `Analyzing ${limit} users... This may take a moment.`,
      "info",
    );

    const response = await apiCall("/admin/security/batch-analyze", "POST", {
      risk_level: riskLevel,
      limit: limit,
    });

    showNotification(response.message || "Batch analysis complete", "success");
    loadFlaggedUsers();
    loadSecurityOverview();
  } catch (error) {
    showNotification("Failed to batch analyze: " + error.message, "error");
  }
}
