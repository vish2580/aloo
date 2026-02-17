# Forgot Password System - Complete Documentation

## 📚 Overview

Complete password reset functionality for LuxWin App with:
- Secure token generation (crypto)
- Email delivery via Brevo SMTP
- Token expiry (15 minutes)
- Rate limiting (5 requests/15 min)
- Password hashing (bcryptjs)
- No information leakage

---

## 🏗️ Architecture

### Database Schema
```sql
users table additions:
├── reset_password_token (VARCHAR 255) - Hashed SHA-256 token
└── reset_password_expires (TIMESTAMP) - Token expiry time
```

### File Structure
```
src/
├── database/
│   └── migration_forgot_password.sql    # Database migration
├── services/
│   └── emailService.js                  # Brevo SMTP email service
├── utils/
│   └── tokenUtils.js                    # Token generation & hashing
├── models/
│   └── User.js                          # +4 methods for password reset
├── controllers/
│   └── authController.js                # +2 methods (forgot/reset)
└── routes/
    └── authRoutes.js                    # +2 routes with validation
```

---

## 🔌 API Endpoints

### 1. Forgot Password

**POST** `/api/auth/forgot-password`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (Always):**
```json
{
  "success": true,
  "message": "If your account exists, you will receive a password reset email shortly."
}
```

**Features:**
- ✅ Rate limited (5 req/15min)
- ✅ Email validation
- ✅ Generic response (security)
- ✅ Sends email if user exists
- ✅ Ignores banned users

---

### 2. Reset Password

**POST** `/api/auth/reset-password`

**Request Body:**
```json
{
  "token": "64_character_hex_token_from_email",
  "newPassword": "newpassword123"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Password reset successful. You can now login with your new password."
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Invalid or expired reset token"
}
```

**Features:**
- ✅ Rate limited (5 req/15min)
- ✅ Token validation
- ✅ Expiry check (15 min)
- ✅ Password min 8 chars
- ✅ Clears token after use

---

## 🔐 Security Features

| Feature | Implementation |
|---------|----------------|
| **Token Generation** | 32-byte crypto.randomBytes() |
| **Token Storage** | SHA-256 hashed |
| **Token Expiry** | 15 minutes (configurable) |
| **Password Hashing** | bcryptjs (10 rounds) |
| **Rate Limiting** | 5 requests per 15 minutes |
| **Information Leakage** | Generic responses |
| **Banned Users** | Silently ignored |
| **Token Reuse** | Prevented (cleared after use) |

---

## 📧 Email Template

**Subject:** Password Reset Request - LuxWin

**Features:**
- Professional branded design
- Gradient header
- Clear CTA button
- Copyable reset link
- Expiry warning
- Security tips
- Mobile responsive
- Plain text fallback

**Reset Link Format:**
```
${FRONTEND_URL}/reset-password?token=${RAW_TOKEN}
```

---

## ⚙️ Environment Variables

Add to `.env`:

```env
# Email Configuration (Brevo SMTP)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your_brevo_email@example.com
SMTP_PASS=your_brevo_smtp_key

# Password Reset Configuration
FRONTEND_URL=http://localhost:3000
RESET_TOKEN_EXPIRE_MINUTES=15
```

---

## 🚀 Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Database Migration
```bash
psql -U postgres -d luxwin_db -f src/database/migration_forgot_password.sql
```

### 3. Configure Environment
1. Sign up at https://www.brevo.com/
2. Get SMTP credentials from Settings → SMTP & API
3. Update `.env` with your credentials

### 4. Start Server
```bash
npm start
# or
npm run dev
```

---

## 🧪 Testing

See `FORGOT_PASSWORD_TESTING.md` for complete testing guide.

**Quick Test:**
```bash
# 1. Request reset
curl -X POST http://localhost:5000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

# 2. Check email for token

# 3. Reset password
curl -X POST http://localhost:5000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token": "TOKEN_FROM_EMAIL", "newPassword": "newpass123"}'

# 4. Login with new password
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "newpass123"}'
```

---

## 📝 User Model Methods

### `User.setResetToken(email, hashedToken, expiresAt)`
Stores hashed token and expiry in database.

### `User.findByResetToken(hashedToken)`
Finds user by valid (non-expired) token.

### `User.updatePassword(userId, newPasswordHash)`
Updates user's password hash.

### `User.clearResetToken(userId)`
Removes reset token after successful reset.

---

## 🎯 Flow Diagram

```
User Request → Forgot Password
    ↓
Check User Exists → Generate Token
    ↓
Hash Token (SHA-256) → Save to DB
    ↓
Send Email (Brevo SMTP) → User Receives Link
    ↓
User Clicks Link → Frontend Extracts Token
    ↓
Submit Reset Request → Validate Token
    ↓
Hash & Compare → Check Expiry
    ↓
Update Password (bcrypt) → Clear Token
    ↓
Success → User Can Login
```

---

## 🐛 Troubleshooting

### Email Not Sending
1. Check SMTP credentials in `.env`
2. Verify Brevo account is active
3. Check server logs for errors
4. Test SMTP connection:
   ```javascript
   const emailService = require('./src/services/emailService');
   await emailService.verifyConnection();
   ```

### Token Invalid/Expired
1. Check `RESET_TOKEN_EXPIRE_MINUTES` (default: 15)
2. Verify token hasn't been used already
3. Check database: `SELECT reset_password_expires FROM users WHERE email = '...'`

### Migration Failed
```bash
# Check if columns exist
psql -U postgres -d luxwin_db -c "\d users"

# Re-run migration
psql -U postgres -d luxwin_db -f src/database/migration_forgot_password.sql
```

---

## 📦 Dependencies

**New:**
- `nodemailer@^6.9.7` - Email sending

**Existing:**
- `bcryptjs` - Password hashing
- `crypto` (built-in) - Token generation
- `express-validator` - Input validation
- `express-rate-limit` - Rate limiting

---

## ✅ Checklist

- [x] Database migration created
- [x] Token utilities implemented
- [x] Email service configured
- [x] User model methods added
- [x] Auth controller methods added
- [x] Routes with validation added
- [x] Environment variables configured
- [x] Dependencies installed
- [x] Testing guide created
- [x] Documentation completed

---

## 🔒 Best Practices Implemented

✅ **Never reveal if email exists** - Generic responses
✅ **Token hashing** - SHA-256 before storage
✅ **Password hashing** - bcryptjs with 10 rounds
✅ **Token expiry** - 15 minutes default
✅ **Rate limiting** - Prevent abuse
✅ **Input validation** - express-validator
✅ **Error handling** - Proper logging
✅ **Email templates** - Professional design
✅ **Security logging** - Track all attempts
✅ **No token reuse** - Cleared after use

---

## 📞 Support

For issues or questions:
1. Check `FORGOT_PASSWORD_TESTING.md`
2. Review server logs
3. Verify environment variables
4. Test SMTP connection

---

**Version:** 1.0.0  
**Last Updated:** 2026-02-16  
**Author:** LuxWin Development Team
