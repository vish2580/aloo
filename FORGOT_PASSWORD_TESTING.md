# Forgot Password System - Testing Guide

## 📋 Prerequisites

Before testing, ensure you have:

1. ✅ **Installed Dependencies**
   ```bash
   npm install
   ```

2. ✅ **Run Database Migration**
   ```bash
   psql -U postgres -d luxwin_db -f src/database/migration_forgot_password.sql
   ```

3. ✅ **Updated .env File**
   ```env
   SMTP_HOST=smtp-relay.brevo.com
   SMTP_PORT=587
   SMTP_USER=your_brevo_email@example.com
   SMTP_PASS=your_brevo_smtp_key
   FRONTEND_URL=http://localhost:3000
   RESET_TOKEN_EXPIRE_MINUTES=15
   ```

4. ✅ **Get Brevo SMTP Credentials**
   - Sign up at https://www.brevo.com/
   - Go to Settings → SMTP & API
   - Generate SMTP key
   - Use your login email as `SMTP_USER`
   - Use the generated key as `SMTP_PASS`

---

## 🚀 Starting the Server

```bash
npm start
# or for development
npm run dev
```

---

## 🧪 Testing the Forgot Password Flow

### Test 1: Request Password Reset

**Endpoint:** `POST /api/auth/forgot-password`

**Request:**
```bash
curl -X POST http://localhost:5000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "If your account exists, you will receive a password reset email shortly."
}
```

**What to Check:**
- ✅ Response is always the same (security feature)
- ✅ Email is sent if user exists
- ✅ No email sent if user doesn't exist
- ✅ Check your email inbox for reset link
- ✅ Server logs show token generation

**Server Logs (if user exists):**
```
[AUTH] Password reset requested for email: user@example.com
[AUTH] Reset token generated for user <uuid> (user@example.com), expires at <timestamp>
[EMAIL] ✅ Password reset email sent to user@example.com
```

---

### Test 2: Reset Password with Valid Token

**Endpoint:** `POST /api/auth/reset-password`

**Request:**
```bash
curl -X POST http://localhost:5000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "TOKEN_FROM_EMAIL",
    "newPassword": "newpassword123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Password reset successful. You can now login with your new password."
}
```

**What to Check:**
- ✅ Password is updated in database
- ✅ Reset token is cleared
- ✅ Can login with new password
- ✅ Cannot reuse the same token

---

### Test 3: Login with New Password

**Endpoint:** `POST /api/auth/login`

**Request:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "newpassword123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { ... },
    "token": "jwt_token_here"
  }
}
```

---

## 🔒 Security Tests

### Test 4: Invalid/Expired Token

**Request:**
```bash
curl -X POST http://localhost:5000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "invalid_token_here",
    "newPassword": "newpassword123"
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "message": "Invalid or expired reset token"
}
```

---

### Test 5: Token Expiry (Wait 15+ Minutes)

1. Request password reset
2. Wait 15+ minutes
3. Try to use the token

**Expected:** Token should be rejected as expired

---

### Test 6: Password Validation

**Request with short password:**
```bash
curl -X POST http://localhost:5000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "valid_token",
    "newPassword": "short"
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "errors": [
    {
      "msg": "Password must be at least 8 characters",
      "param": "newPassword"
    }
  ]
}
```

---

### Test 7: Rate Limiting

Send 6+ requests to `/api/auth/forgot-password` within 15 minutes.

**Expected:** 6th request should be rate limited

**Response:**
```json
{
  "success": false,
  "message": "Too many requests, please try again later."
}
```

---

### Test 8: Non-Existent Email

**Request:**
```bash
curl -X POST http://localhost:5000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nonexistent@example.com"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "If your account exists, you will receive a password reset email shortly."
}
```

**What to Check:**
- ✅ Same response as valid email (security)
- ✅ No email sent
- ✅ Server logs show "user not found"

---

### Test 9: Banned User

1. Ban a user via admin panel
2. Request password reset for that user

**Expected:**
- ✅ Generic success message
- ✅ No email sent
- ✅ Server logs show "account banned"

---

## 📧 Email Template Preview

The reset email includes:
- Professional branded header
- Clear reset button
- Copyable reset link
- Expiry warning (15 minutes)
- Security tips
- Responsive design

**Email Subject:** "Password Reset Request - LuxWin"

---

## 🗄️ Database Verification

Check if token is stored correctly:

```sql
SELECT 
  email,
  reset_password_token,
  reset_password_expires
FROM users
WHERE email = 'user@example.com';
```

**After successful reset:**
```sql
-- Both fields should be NULL
SELECT 
  email,
  reset_password_token,
  reset_password_expires
FROM users
WHERE email = 'user@example.com';
```

---

## 🐛 Troubleshooting

### Email Not Sending

1. **Check SMTP credentials in .env**
   ```bash
   echo $SMTP_USER
   echo $SMTP_PASS
   ```

2. **Verify Brevo account is active**
   - Login to Brevo dashboard
   - Check SMTP status

3. **Check server logs**
   ```
   [EMAIL] ❌ Failed to send password reset email
   ```

4. **Test SMTP connection**
   Add this to your test file:
   ```javascript
   const emailService = require('./src/services/emailService');
   emailService.verifyConnection();
   ```

### Token Not Working

1. **Check token hasn't expired**
   - Default: 15 minutes
   - Check `RESET_TOKEN_EXPIRE_MINUTES` in .env

2. **Verify token in database**
   ```sql
   SELECT reset_password_expires FROM users WHERE email = 'user@example.com';
   ```

3. **Check for typos in token**
   - Token is case-sensitive
   - Must be exact match from email

### Migration Issues

```bash
# Check if columns exist
psql -U postgres -d luxwin_db -c "\d users"

# Re-run migration if needed
psql -U postgres -d luxwin_db -f src/database/migration_forgot_password.sql
```

---

## ✅ Complete Test Checklist

- [ ] Install dependencies (`npm install`)
- [ ] Run database migration
- [ ] Configure .env with SMTP credentials
- [ ] Start server
- [ ] Test forgot password with valid email
- [ ] Receive reset email
- [ ] Click reset link or copy token
- [ ] Reset password successfully
- [ ] Login with new password
- [ ] Test with invalid token
- [ ] Test with expired token (wait 15+ min)
- [ ] Test password validation (< 8 chars)
- [ ] Test rate limiting (6+ requests)
- [ ] Test non-existent email
- [ ] Test banned user
- [ ] Verify token cleared after reset

---

## 📝 Notes

- **Security:** System never reveals if email exists
- **Rate Limiting:** 5 requests per 15 minutes per IP
- **Token Expiry:** 15 minutes (configurable)
- **Password Hashing:** bcryptjs with 10 rounds
- **Token Storage:** SHA-256 hashed in database
- **Email Provider:** Brevo SMTP (free tier available)

---

## 🎯 Success Criteria

✅ User can request password reset
✅ Email is sent with reset link
✅ Token expires after 15 minutes
✅ Password is updated successfully
✅ Old password no longer works
✅ New password works for login
✅ Token cannot be reused
✅ Rate limiting prevents abuse
✅ No information leakage about user existence
