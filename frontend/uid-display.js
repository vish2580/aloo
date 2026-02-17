/**
 * UID Display JavaScript
 * 
 * This file contains functions to display UID in the user account page
 * and handle UID in the global state.
 */

// Add this to the existing app.js file after user login/registration

// Function to update UID display in account screen
function updateUIDDisplay(uid) {
    const uidElement = document.getElementById('userUid');
    if (uidElement && uid) {
        uidElement.textContent = `UID: ${uid}`;
    }
}

// Modify existing login/register success handlers to store and display UID
// Example integration:
/*
function handleLoginSuccess(userData) {
  // ... existing code ...
  
  // Store UID in global state
  window.currentUser = {
    ...window.currentUser,
    uid: userData.uid
  };
  
  // Update UID display
  updateUIDDisplay(userData.uid);
  
  // ... rest of existing code ...
}
*/

// Export for use in main app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { updateUIDDisplay };
}
