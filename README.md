# Luxwin Color Prediction Gaming App - Backend

A **production-ready** backend for a Color Prediction gaming application built with Node.js, Express, and PostgreSQL. Features comprehensive security, abuse prevention, and audit logging.

## 🎮 Features

### Core Features
- **User Authentication**: UUID-based users with dual password system (login + withdrawal)
- **Wallet System**: Balance management, deposits, and secure withdrawals
- **Game Engine**: Automated round-based color prediction game (Red/Green/Purple)
- **Bet History**: Complete tracking of all user bets
- **Transaction History**: Detailed record of all wallet activities

### Promotion Features
- **Referral System**: 3-level commission structure (L1: 2%, L2: 1%, L3: 0.5%)
- **Red Envelope System**: Admin-created bonus codes with expiration
- **First Recharge Bonus**: Configurable bonus percentage for first deposits

### 🔒 Security Features (Production-Ready)
- **JWT Authentication**: Secure token-based authentication (7-day expiry)
- **Withdrawal Password Safety**: 3-attempt lockout system with 30-minute timeout
- **Rate Limiting**: Endpoint-specific limits (auth, betting, withdrawals, etc.)
- **Idempotency Protection**: Prevents duplicate submissions with 24-hour key storage
- **Double-Bet Prevention**: 2-second race condition protection
- **Balance Safeguards**: Prevents negative balance with explicit checks
- **Audit Logging**: Comprehensive logging of all sensitive operations
- **Input Sanitization**: XSS and injection attack prevention
- **Error Handling**: Production-safe error messages with error codes
- **SQL Injection Protection**: Parameterized queries throughout

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL with connection pooling
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs (10 rounds)
- **Validation**: express-validator
- **Security**: helmet, express-rate-limit, cors, input sanitization

## 📁 Project Structure

```
luxwin-backend/
├── src/
│   ├── config/
│   │   └── database.js              # Database connection pool
│   ├── controllers/
│   │   ├── authController.js        # Auth endpoints logic
│   │   ├── userController.js        # User profile management
│   │   ├── walletController.js      # Wallet operations + withdrawal safety
│   │   ├── gameController.js        # Game operations + double-bet prevention
│   │   ├── historyController.js     # History queries
│   │   ├── referralController.js    # Referral system
│   │   ├── redEnvelopeController.js # Red envelope claiming
│   │   └── adminPromotionController.js # Admin promotion management
│   ├── database/
│   │   ├── init.js                  # Core database schema
│   │   ├── initPromotions.js        # Promotion tables
│   │   └── initSecurity.js          # Security tables (NEW)
│   ├── middlewares/
│   │   ├── auth.js                  # JWT authentication
│   │   ├── rateLimiter.js           # Enhanced rate limiting (IP + User)
│   │   ├── errorHandler.js          # Production-safe error handler
│   │   ├── validator.js             # Validation + sanitization
│   │   └── idempotency.js           # Idempotency middleware (NEW)
│   ├── models/
│   │   ├── User.js                  # User model (UUID-based)
│   │   ├── Wallet.js                # Wallet model
│   │   ├── Transaction.js           # Transaction model
│   │   ├── Withdrawal.js            # Withdrawal model
│   │   ├── GameRound.js             # Game round model
│   │   ├── Bet.js                   # Bet model + duplicate checking
│   │   ├── Referral.js              # Referral relationships
│   │   ├── Commission.js            # Commission tracking
│   │   ├── RedEnvelope.js           # Red envelope codes
│   │   ├── RedEnvelopeClaim.js      # Claim history
│   │   ├── PromotionConfig.js       # Dynamic promotion config
│   │   ├── WithdrawalAttempt.js     # Failed attempt tracking (NEW)
│   │   ├── AuditLog.js              # Audit logging (NEW)
│   │   └── IdempotencyKey.js        # Idempotency key storage (NEW)
│   ├── routes/
│   │   ├── authRoutes.js            # Auth routes
│   │   ├── userRoutes.js            # User profile routes
│   │   ├── walletRoutes.js          # Wallet routes
│   │   ├── gameRoutes.js            # Game routes
│   │   ├── historyRoutes.js         # History routes
│   │   ├── referralRoutes.js        # Referral routes
│   │   ├── redEnvelopeRoutes.js     # Red envelope routes
│   │   └── adminPromotionRoutes.js  # Admin routes
│   ├── services/
│   │   ├── gameEngine.js            # Automated game logic
│   │   ├── referralService.js       # Referral commission logic
│   │   ├── redEnvelopeService.js    # Red envelope logic
│   │   └── auditService.js          # Centralized audit logging (NEW)
│   ├── utils/
│   │   ├── avatars.js               # Avatar utilities
│   │   └── promotions.js            # Promotion utilities
│   └── server.js                    # Main server file
├── .env.example                     # Environment variables template
├── .gitignore
├── package.json
├── README.md                        # This file
├── SECURITY.md                      # Comprehensive security documentation (NEW)
└── DEPLOYMENT.md                    # Production deployment checklist (NEW)
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher recommended)
- PostgreSQL (v13 or higher recommended)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   cd "LuxWin App"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   PORT=5000
   NODE_ENV=development
   
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your_password
   DB_NAME=luxwin_db
   
   JWT_SECRET=your_jwt_secret_key_change_in_production
   JWT_EXPIRE=7d
   
   ROUND_DURATION_SECONDS=180
   BET_LOCK_BEFORE_SECONDS=10
   MIN_BET_AMOUNT=10
   MAX_BET_AMOUNT=10000
   
   MIN_WITHDRAW_AMOUNT=50
   WITHDRAW_FEE_PERCENT=2
   ```

4. **Create PostgreSQL database**
   ```bash
   psql -U postgres
   CREATE DATABASE luxwin_db;
   \q
   ```

5. **Initialize database tables**
   ```bash
   # Initialize core tables (users, wallets, game, etc.)
   npm run init-db
   
   # Initialize promotion tables (referrals, red envelopes, etc.)
   npm run init-promotions
   
   # Initialize security tables (audit logs, idempotency, withdrawal attempts)
   npm run init-security
   ```

6. **Start the server**
   ```bash
   # Development mode (with auto-reload)
   npm run dev
   
   # Production mode
   npm start
   ```

The server will start on `http://localhost:5000`

## 📡 API Endpoints

### Authentication

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "withdrawal_password": "withdraw123",
  "country": "USA",
  "referral_code": "OPTIONAL123"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "login_password": "password123"
}
```

#### Get Profile
```http
GET /api/auth/profile
Authorization: Bearer <token>
```

### Wallet

#### Get Balance
```http
GET /api/wallet/balance
Authorization: Bearer <token>
```

#### Add Funds
```http
POST /api/wallet/add-funds
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 100,
  "transaction_hash": "optional_hash"
}
```

#### Request Withdrawal
```http
POST /api/wallet/withdraw
Authorization: Bearer <token>
Idempotency-Key: <uuid>
Content-Type: application/json

{
  "amount": 50,
  "withdrawal_password": "withdraw123",
  "wallet_address": "TRC20_WALLET_ADDRESS"
}
```

#### Get Withdrawal History
```http
GET /api/wallet/withdrawals
Authorization: Bearer <token>
```

### Game

#### Get Current Round
```http
GET /api/game/current-round
Authorization: Bearer <token>
```

#### Place Bet
```http
POST /api/game/bet
Authorization: Bearer <token>
Idempotency-Key: <uuid>
Content-Type: application/json

{
  "choice": "red",
  "amount": 20
}
```

**Valid choices**: `red`, `green`, `purple`, `violet` (or specific numbers 0-9)

#### Get Recent Results
```http
GET /api/game/results?limit=20
Authorization: Bearer <token>
```

#### Get Current Round Bets
```http
GET /api/game/current-bets
Authorization: Bearer <token>
```

### History

#### Get Transaction History
```http
GET /api/history/transactions?limit=50&offset=0&type=deposit
Authorization: Bearer <token>
```

#### Get Bet History
```http
GET /api/history/bets?limit=50&offset=0
Authorization: Bearer <token>
```

## 🎲 Game Logic

### Round System
- Each round lasts 180 seconds (configurable)
- Betting locks 10 seconds before round end
- Results are automatically generated
- Winnings are automatically credited

### Color Rules
- **Red**: Wins on even numbers (2, 4, 6, 8) and sometimes 0
- **Green**: Wins on odd numbers (1, 3, 5, 7, 9)
- **Purple**: Wins when 0 appears (rare)

### Payout Multipliers
- **Red**: 2x
- **Green**: 2x
- **Purple**: 9x

## 🔒 Security Features

### Authentication & Authorization
- JWT token-based authentication (7-day expiry)
- Dual password system (login + withdrawal passwords)
- Password hashing with bcryptjs (10 rounds)
- UUID-based user IDs (not sequential integers)

### Withdrawal Safety
- **3-Attempt Lockout**: Account locks for 30 minutes after 3 failed withdrawal password attempts
- **Attempt Tracking**: All failed attempts logged with timestamps
- **Remaining Attempts**: Users informed of remaining attempts before lockout
- **Automatic Reset**: Counter resets on successful withdrawal

### Abuse Prevention
- **Rate Limiting**: Endpoint-specific limits with IP + User ID tracking
- **Idempotency Protection**: Prevents duplicate submissions (24-hour key storage)
- **Double-Bet Prevention**: 2-second race condition window check
- **Balance Safeguards**: Explicit negative balance prevention
- **Input Sanitization**: XSS and injection attack prevention on all inputs

### Audit & Compliance
- **Comprehensive Audit Logging**: All sensitive operations logged (withdrawals, bets, admin actions)
- **Security Event Tracking**: Failed attempts, blocked actions, suspicious activity
- **IP & User Agent Logging**: Full request context for forensics
- **Retention**: Audit logs indexed for fast queries

### Production Safety
- **Error Handling**: No stack traces or sensitive data in production error responses
- **Error Codes**: Machine-readable error codes for all failures
- **Database Protection**: Parameterized queries prevent SQL injection
- **CORS Configuration**: Restrict origins in production
- **Helmet.js**: Security headers (CSP, XSS Protection, etc.)

**📖 For detailed security documentation, see [SECURITY.md](SECURITY.md)**

## 🛡️ Rate Limits

### Endpoint-Specific Limits
- **General API**: 100 requests per 15 minutes (per IP + User)
- **Authentication**: 5 attempts per 15 minutes (per IP only)
- **Registration**: 3 attempts per hour (per IP only)
- **Betting**: 10 requests per minute (per IP + User)
- **Withdrawals**: 3 requests per hour (per IP + User)
- **Red Envelopes**: 5 claims per minute (per IP + User)

### Rate Limit Responses
```json
{
  "success": false,
  "error_code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests, please try again later."
}
```

## 💾 Database Schema

### Core Tables
- `users` - User accounts (UUID primary keys)
- `wallets` - User wallet balances
- `transactions` - All money movements
- `withdrawals` - Withdrawal requests and status
- `game_rounds` - Game rounds with results
- `bets` - User bets and payouts

### Promotion Tables
- `referrals` - Referral relationships (L1, L2, L3)
- `commissions` - Commission payouts to referrers
- `red_envelopes` - Admin-created red envelope codes
- `red_envelope_claims` - User claim history
- `promotion_config` - Dynamic promotion configuration

### Security Tables
- `withdrawal_attempts` - Failed withdrawal password tracking
- `audit_logs` - Comprehensive audit trail of sensitive operations
- `idempotency_keys` - Duplicate submission prevention

### Indexes
All tables include appropriate indexes for:
- Primary key lookups
- Foreign key relationships
- Common query patterns (user_id, created_at, status)
- Audit log queries (actor_id, action, created_at)

## 🧪 Testing the API

### Development Tools
- Postman
- cURL
- Thunder Client (VS Code extension)
- REST Client (VS Code extension)

### Important Headers
```http
Authorization: Bearer <jwt_token>
Idempotency-Key: <uuid>
Content-Type: application/json
```

### Example cURL Commands

**Register:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "withdrawal_password": "withdraw123",
    "country": "USA"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Place Bet (with Idempotency Key):**
```bash
curl -X POST http://localhost:5000/api/game/bet \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "choice": "green",
    "amount": 20
  }'
```

**Request Withdrawal (with Idempotency Key):**
```bash
curl -X POST http://localhost:5000/api/wallet/withdraw \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "amount": 100,
    "withdrawal_password": "withdraw123",
    "wallet_address": "TRC20_ADDRESS_HERE"
  }'
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `NODE_ENV` | Environment | development |
| `DB_HOST` | Database host | localhost |
| `DB_PORT` | Database port | 5432 |
| `DB_USER` | Database user | postgres |
| `DB_PASSWORD` | Database password | - |
| `DB_NAME` | Database name | luxwin_db |
| `JWT_SECRET` | JWT secret key | - |
| `JWT_EXPIRE` | Token expiry | 7d |
| `ROUND_DURATION_SECONDS` | Round duration | 180 |
| `BET_LOCK_BEFORE_SECONDS` | Lock time before end | 10 |
| `MIN_BET_AMOUNT` | Minimum bet | 10 |
| `MAX_BET_AMOUNT` | Maximum bet | 10000 |
| `MIN_WITHDRAW_AMOUNT` | Minimum withdrawal | 50 |
| `WITHDRAW_FEE_PERCENT` | Withdrawal fee % | 2 |

## 📝 Notes

- This is the **backend only** - frontend must be built separately
- **Production-ready** with comprehensive security features
- All sensitive operations are audited and logged
- Idempotency keys required for wallet/game/red-envelope operations
- Referral and promotion systems fully implemented
- Admin panel routes included for promotion management
- Deposits are currently mocked (blockchain integration needed)
- Withdrawals require manual admin approval (approval system needed)

## 🚀 Production Deployment

Before deploying to production:

1. **Security Checklist**: Review [DEPLOYMENT.md](DEPLOYMENT.md) for complete checklist
2. **Environment**: Set `NODE_ENV=production`
3. **JWT Secret**: Use strong, random secret (32+ characters)
4. **Database**: Set up PostgreSQL with proper user permissions
5. **SSL/TLS**: Use HTTPS with valid certificate (Let's Encrypt recommended)
6. **Firewall**: Configure firewall rules for production
7. **Monitoring**: Set up log monitoring and alerts
8. **Backups**: Configure automated database backups

**📋 See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment guide**

## 🚧 Future Enhancements

### Not Yet Implemented
- Admin withdrawal approval workflow (routes exist, approval logic needed)
- Real blockchain integration for deposits/withdrawals
- WebSocket for real-time game updates
- Email/SMS notifications
- Admin dashboard UI
- User KYC verification
- Payment gateway integration
- Mobile app backend optimizations

### Completed Features ✅
- ✅ User authentication with dual passwords
- ✅ Wallet system with deposits and withdrawals
- ✅ Automated game engine with round management
- ✅ Comprehensive security (rate limiting, idempotency, audit logging)
- ✅ Multi-level referral system (L1, L2, L3)
- ✅ Red envelope bonus system
- ✅ First recharge bonus
- ✅ Admin promotion management routes
- ✅ Withdrawal password safety with lockout
- ✅ Double-bet prevention
- ✅ Balance safeguards
- 2FA authentication

## 📄 License

ISC

## 👨‍💻 Support

For issues or questions, please open an issue in the repository.

---

**Made with ❤️ for Luxwin Gaming Platform**
