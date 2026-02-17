# 🚀 PROMOTION SYSTEM - QUICK START GUIDE

**5-Minute Setup & Test Guide**

---

## 📦 STEP 1: RUN DATABASE MIGRATION

Open terminal in project root:

```bash
cd "C:\Users\Administrator\Desktop\LuxWin App - Copy"
node src/database/initPromotions.js
```

**Expected Output:**
```
✓ Added phone field to users table
✓ Referrals table created
✓ Commissions table created (strict types)
✓ First Rewards tracking table created
✓ Promotion Config table created
✅ CLEAN promotion system initialization completed!
```

---

## 🎮 STEP 2: START SERVER

```bash
npm start
```

Server should start on `http://localhost:5000`

---

## 🧪 STEP 3: TEST THE SYSTEM

### A. Test User Signup with Referral Code

1. **Create User A (Referrer):**
   - Signup normally
   - Note their referral code (shown in promotion page)

2. **Create User B (Level 1) using User A's code:**
   - Signup with `referral_code` in request body
   - User B is now Level 1 under User A

3. **Create User C (Level 2) using User B's code:**
   - User C is now Level 2 under User A (Level 1 under User B)

### B. Test Real-Time Commission

1. **Login as User B**
2. **Make a recharge** (admin approves it)
3. **Place a bet** (any amount)
4. **Login as User A** (the referrer)
5. **Check wallet balance** → Should increase by 5% of bet amount
6. **Check transactions** → See commission entry
7. **Check promotion page** → See commission recorded

### C. Test Promotion Page

**Login as User A and navigate to Promotion page:**

✅ You should see:
- **Actual Commission** → Total earned
- **Total Contribution** → Sum of all bets from L1+L2+L3
- **Total People Invited** → Count of L1+L2+L3 users
- **Level 1 Tab** → Shows User B with Water Reward
- **Level 2 Tab** → Shows User C with Water Reward
- **Level 3 Tab** → Empty (no L3 users yet)

### D. Test Manual First Reward (Admin Only)

1. **Login as Admin**
2. **Navigate to Admin Panel → Promotions**
3. **Go to "First Reward Management"**
4. **See User B in "Eligible Users" list** (made first recharge)
5. **Click "Credit First Reward"**
6. **Enter amount** (e.g., $35)
7. **Submit**
8. **Check User A's wallet** → Should increase by $35
9. **Check User A's promotion page** → First Reward column shows $35 for User B

---

## 📊 STEP 4: VERIFY DATA CONSISTENCY

### Check Wallet = Transactions

```sql
SELECT 
  u.id,
  u.email,
  u.main_balance,
  (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id = u.id) as transaction_sum
FROM users u
WHERE u.id = 'USER_A_UUID';
```

**Result:** `main_balance` should equal `transaction_sum`

### Check Commission = Subset of Transactions

```sql
SELECT 
  (SELECT COUNT(*) FROM commissions WHERE user_id = 'USER_A_UUID') as commission_count,
  (SELECT COUNT(*) FROM transactions WHERE user_id = 'USER_A_UUID' AND type = 'commission') as transaction_count;
```

**Result:** Both counts should match

---

## 🎯 STEP 5: TEST ALL ENDPOINTS

### User Endpoints

**Get Referral Info:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/referral/info
```

**Get Promotion Stats:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/referral/stats
```

**Get Level 1 Users:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/referral/users/1
```

**Get Level 2 Users:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/referral/users/2
```

**Get Commission History:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/referral/commissions
```

### Admin Endpoints

**Get Eligible Users:**
```bash
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  http://localhost:5000/api/admin/promotion/first-reward/eligible
```

**Credit First Reward:**
```bash
curl -X POST \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"USER_UUID","reward_amount":35}' \
  http://localhost:5000/api/admin/promotion/first-reward/credit
```

**Get First Reward History:**
```bash
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  http://localhost:5000/api/admin/promotion/first-reward/history
```

---

## 🔍 TROUBLESHOOTING

### Issue: Promotion page shows $0.00

**Solution:** 
- Check if user has any referrals: `SELECT * FROM referrals WHERE referred_by = 'USER_ID'`
- Check if downline users placed bets: `SELECT * FROM bets WHERE user_id IN (SELECT user_id FROM referrals WHERE referred_by = 'USER_ID')`

### Issue: Commission not auto-credited

**Check server logs for:**
```
🎯 [BET] COMMITTED successfully
Error processing bet commission: ...
```

**Verify:**
- User has referrer: `SELECT referred_by FROM referrals WHERE user_id = 'USER_ID'`
- Commission rates set: `SELECT * FROM promotion_config WHERE key LIKE 'commission_%'`

### Issue: Can't credit first reward

**Check:**
- User has referrer
- User has at least one approved recharge
- First reward not already given: `SELECT * FROM first_rewards WHERE user_id = 'USER_ID'`

---

## 📱 FRONTEND TESTING

1. **Open browser** → `http://localhost:3000`
2. **Login as User A** (who has referrals)
3. **Navigate to Account → Promotion**

**Check:**
- ✅ Commission amount displays correctly
- ✅ Total contribution displays correctly
- ✅ Total people invited is correct
- ✅ Level tabs show correct counts (Level 1: X, Level 2: Y, Level 3: Z)
- ✅ Click Level 1 tab → Shows list of users with UID, phone, water reward, first reward
- ✅ Click Level 2 tab → Shows Level 2 users
- ✅ Click Level 3 tab → Shows Level 3 users or "No data"
- ✅ Copy promo code button works
- ✅ Copy promo link button works

---

## ✅ SUCCESS CHECKLIST

Complete this checklist to verify everything works:

- [ ] Database migration successful (no errors)
- [ ] Server starts without errors
- [ ] User can signup with referral code
- [ ] Bet commission auto-credits to referrer wallet
- [ ] Commission creates transaction entry
- [ ] Commission creates commission record
- [ ] Promotion page loads stats correctly
- [ ] Level 1/2/3 tabs show correct users
- [ ] UID formatting works (shows as "UIDXXXXXX")
- [ ] Phone shows last 4 digits masked
- [ ] Water reward displays correctly per user
- [ ] Admin can see eligible users for first reward
- [ ] Admin can credit first reward manually
- [ ] First reward creates wallet credit + transaction + commission
- [ ] Cannot give first reward twice to same user
- [ ] Total contribution sums all L1+L2+L3 bets
- [ ] Wallet balance = sum of transactions (consistency check)

---

## 🎉 YOU'RE DONE!

If all checks pass, the promotion system is **working perfectly** and ready for production use.

### Key Points to Remember:

1. **Commission is AUTOMATIC** → Happens on every bet
2. **First Reward is MANUAL** → Admin must credit it
3. **Promotion Page is READ-ONLY** → Never modifies wallet
4. **3 Levels ONLY** → No Level 4 or beyond
5. **Everything is ATOMIC** → Wallet, transactions, commissions always synced

---

## 📞 Need Help?

Check the complete documentation:
- `PROMOTION_SYSTEM_REBUILD_COMPLETE.md` → Full system details
- `src/services/referralService.js` → Core logic
- `src/models/` → Data models

---

**Happy Testing! 🚀**