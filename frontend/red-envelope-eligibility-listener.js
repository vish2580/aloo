// Event listener for red envelope eligibility dropdown
// This script should be added to admin.js or included in the HTML

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function () {
    const eligibilityDropdown = document.getElementById('envelopeEligibility');
    const targetUidGroup = document.getElementById('targetUidGroup');
    const targetUidInput = document.getElementById('targetUid');

    if (eligibilityDropdown && targetUidGroup) {
        eligibilityDropdown.addEventListener('change', function () {
            if (this.value === 'specific_user') {
                targetUidGroup.style.display = 'block';
            } else {
                targetUidGroup.style.display = 'none';
                if (targetUidInput) {
                    targetUidInput.value = '';
                }
            }
        });
    }
});
