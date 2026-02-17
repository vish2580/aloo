# Promotions & Red Envelope System

Complete referral commission and red envelope bonus system for LuxWin App.

## Features Implemented

### 1. Referral System
- ✅ Auto-generate unique referral code on user registration
- ✅ Generate referral links
- ✅ Track multi-level referrals (L1, L2, L3)
- ✅ Store referral relationships permanently
- ✅ Prevent self-referral

### 2. Commission Logic
- ✅ Level-wise commission calculation (configurable %)
- ✅ Commission earned on bets
- ✅ First recharge bonus (one-time when referred user makes first deposit)
- ✅ Commission history with all details
- ✅ Auto-credit to user balance

### 3. Red Envelope System
- ✅ Admin can create red envelopes
- ✅ Configurable amount and max claims
- ✅ Optional expiry time
- ✅ Unique claim codes
- ✅ One claim per user
- ✅ Auto-deactivate when fully claimed
- ✅ Complete claim history

### 4. Database Schema

**Tables Created:**
- `referrals` - Referral relationships
- `commissions` - Commission earnings
- `red_envelopes` - Red envelope definitions
- `red_envelope_claims` - Claim records
- `promotion_config` - System configuration

## Setup

### Initialize Promotions Schema

```bash
npm run init-promotions
```

This will create all necessary tables and default configuration.

## API Endpoints

### User APIs

#### Get Referral Info
```http
GET /api/referral/info
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "referral_code": "ABC123XY",
    "referral_link": "https://luxwin.app/register?ref=ABC123XY",
    "created_at": "2026-01-02T10:00:00.000Z"
  }
}
```

#### Get Referral Stats
```http
GET /api/referral/stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total_invites": 5,
    "total_commission": 150.50,
    "total_earnings": 150.50,
    "first_recharge_bonus": 50.00,
    "bet_commission": 100.50,
    "commission_breakdown": {
      "level_1": 100.00,
      "level_2": 30.50,
      "level_3": 20.00
    },
    "referrals": [
      {
        "user_id": "uuid",
        "email": "user@example.com",
        "joined_at": "2026-01-02T10:00:00.000Z",
        "level": 1
      }
    ]
  }
}
```

#### Get Commission History
```http
GET /api/referral/commissions?limit=50&offset=0
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "source_user": "user@example.com",
      "level": 1,
      "amount": 5.00,
      "type": "bet_commission",
      "description": "L1 commission from bet",
      "created_at": "2026-01-02T10:00:00.000Z"
    }
  ]
}
```

#### Claim Red Envelope
```http
POST /api/red-envelope/claim
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "RE1ABC123DEF"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Red envelope claimed successfully",
  "data": {
    "amount": 100.00,
    "new_balance": 250.00,
    "claimed_at": "2026-01-02T10:00:00.000Z"
  }
}
```

#### Get My Claimed Red Envelopes
```http
GET /api/red-envelope/my-claims
Authorization: Bearer <token>
```

### Admin APIs

#### Create Red Envelope
```http
POST /api/admin/promotions/red-envelopes
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "amount": 50,
  "max_claims": 10,
  "expires_in_hours": 24
}
```

**Response:**
```json
{
  "success": true,
  "message": "Red envelope created successfully",
  "data": {
    "id": 1,
    "code": "RE1ABC123DEF",
    "amount": 50.00,
    "max_claims": 10,
    "expires_at": "2026-01-03T10:00:00.000Z",
    "claim_link": "https://luxwin.app/claim/RE1ABC123DEF"
  }
}
```

#### List Red Envelopes
```http
GET /api/admin/promotions/red-envelopes?limit=50&offset=0
Authorization: Bearer <admin-token>
```

#### View Envelope Claims
```http
GET /api/admin/promotions/red-envelopes/:envelope_id/claims
Authorization: Bearer <admin-token>
```

#### Get Promotion Config
```http
GET /api/admin/promotions/config
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "commission_l1_percent": {
      "value": "5",
      "description": "Level 1 commission percentage"
    },
    "commission_l2_percent": {
      "value": "3",
      "description": "Level 2 commission percentage"
    },
    "commission_l3_percent": {
      "value": "1",
      "description": "Level 3 commission percentage"
    },
    "first_recharge_bonus_percent": {
      "value": "10",
      "description": "First recharge bonus percentage"
    },
    "first_recharge_bonus_enabled": {
      "value": "true",
      "description": "Enable first recharge bonus"
    }
  }
}
```

#### Update Commission Rates
```http
PUT /api/admin/promotions/commission-rates
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "level_1": 5,
  "level_2": 3,
  "level_3": 1
}
```

#### Update First Recharge Bonus
```http
PUT /api/admin/promotions/first-recharge-bonus
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "enabled": true,
  "bonus_percent": 10
}
```

#### Update Config (Generic)
```http
PUT /api/admin/promotions/config
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "key": "commission_l1_percent",
  "value": "7",
  "description": "Updated Level 1 commission"
}
```

## How It Works

### Registration with Referral
When a user registers with a referral code:
1. System validates the referral code
2. Creates user account
3. Generates unique referral code for new user
4. Links new user to referrer in `referrals` table
5. Returns success with user data

### Commission on Bets
When a user places a bet:
1. Bet is recorded and balance deducted
2. System traces referral chain (L1, L2, L3)
3. Calculates commission based on configured rates
4. Credits commission to each level's referrer
5. Records commission in database
6. Updates user balances
7. Creates transaction records

### First Recharge Bonus
When a user makes their first deposit:
1. Deposit is processed normally
2. System checks if user was referred
3. Checks if referrer already received first recharge bonus
4. Calculates bonus (e.g., 10% of deposit)
5. Credits bonus to referrer
6. Marks as first recharge to prevent duplicates

### Red Envelope Claiming
When a user claims a red envelope:
1. Validates envelope code exists
2. Checks if active and not expired
3. Checks if max claims reached
4. Verifies user hasn't claimed before
5. Credits amount to user balance
6. Increments claim count
7. Deactivates if fully claimed

## Default Configuration

```
commission_l1_percent = 5%
commission_l2_percent = 3%
commission_l3_percent = 1%
first_recharge_bonus_percent = 10%
first_recharge_bonus_enabled = true
```

## Security Features

- ✅ Prevent self-referral
- ✅ Prevent duplicate red envelope claims
- ✅ Prevent claiming expired envelopes
- ✅ Transaction-based commission processing
- ✅ Balance locking during operations
- ✅ Input validation on all endpoints
- ✅ SQL injection safe queries

## Integration Points

### Modified Files:
1. `src/controllers/authController.js` - Added referral code generation on signup
2. `src/controllers/gameController.js` - Added commission processing on bets
3. `src/controllers/walletController.js` - Added first recharge bonus processing
4. `src/server.js` - Added new routes

### No Breaking Changes:
- Existing auth, wallet, game logic unchanged
- All original APIs still functional
- Database schema extended, not modified

## Testing

### Test Referral Flow:
```bash
# 1. Register user A
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usera@example.com",
    "password": "password123",
    "withdrawal_password": "withdraw123",
    "country": "USA"
  }'

# Get referral code from response

# 2. Register user B with A's referral code
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "userb@example.com",
    "password": "password123",
    "withdrawal_password": "withdraw123",
    "country": "USA",
    "referral_code": "ABC123XY"
  }'

# 3. User B deposits (triggers first recharge bonus for A)
# 4. User B bets (triggers bet commission for A)
# 5. Check A's commission history
```

### Test Red Envelope:
```bash
# 1. Admin creates red envelope
curl -X POST http://localhost:5000/api/admin/promotions/red-envelopes \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "max_claims": 5,
    "expires_in_hours": 24
  }'

# 2. User claims red envelope
curl -X POST http://localhost:5000/api/red-envelope/claim \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "RE1ABC123DEF"
  }'
```

## Notes

- Commission processing is asynchronous (non-blocking)
- First recharge bonus is one-time per referrer-referee pair
- Red envelope codes are unique and auto-generated
- All monetary operations are transaction-safe
- Commission types: `bet_commission`, `first_recharge`

---

**Status:** ✅ Production Ready
