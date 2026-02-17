# Quick Testing Guide - Round System Fixes

## 🚀 Quick Start Test (5 Minutes)

### 1. Start the Server
```bash
cd "LuxWin App - Copy -pro"
npm start
```

**Expected Output:**
```
🎮 Game Engine initializing...
✅ No orphaned rounds found
✅ Resuming active round X (ID: Y)
  OR
✅ No active round found. Will create new round.
🔄 Starting authoritative round monitor (1s interval)
✅ Game Engine initialized successfully
🚀 Server running on http://localhost:5000
```

### 2. Watch First Round Complete
Open browser console and navigate to: `http://localhost:5000`

**Watch for these events in order:**

1. **Round Creation** (Server logs):
   ```
   ✅ Round 123 created (ID: 456) - Betting open
      Lock at: 2024-XX-XXTXX:XX:XX.XXXZ
      End at:  2024-XX-XXTXX:XX:XX.XXXZ
   ```

2. **Round Lock** (30 seconds before end):
   ```
   🔒 Round 123 locked - No more bets allowed
   ```

3. **Round End** (at scheduled time):
   ```
   ⏰ Round 123 ending - Processing results...
   ✅ Round 123 result set: green (7)
   💰 Processed X bet(s) for round 123
   ✅ Round 123 completed successfully
   ```

4. **New Round Creation** (2 seconds after):
   ```
   ✅ Round 124 created (ID: 457) - Betting open
   ```

### 3. Verify Frontend Behavior
Watch the countdown timer on the homepage:

- ✅ Should count down smoothly: `03:00` → `02:59` → ... → `00:01` → `00:00`
- ✅ Should **NEVER** stay stuck at `00:00`
- ✅ New round should appear within 2-3 seconds
- ✅ Round number should increment

---

## 🔥 Critical Tests

### Test 1: Countdown Never Freezes
**Duration:** 3 minutes

1. Open frontend: `http://localhost:5000`
2. Watch the timer count down to `00:00`
3. **CRITICAL:** Timer should NOT freeze at `00:00`
4. Within 3 seconds, new round should load
5. Timer should restart at `03:00` (or configured duration)

**Pass Criteria:**
- ✅ Timer reaches `00:00` and immediately starts loading
- ✅ No hanging at `00:00` for more than 3 seconds
- ✅ New round loads automatically

---

### Test 2: Server Restart Recovery
**Duration:** 2 minutes

1. Wait until round is in progress (not at end)
2. Stop server: `Ctrl+C` or `pm2 stop luxwin`
3. Wait 5 seconds
4. Restart server: `npm start` or `pm2 restart luxwin`

**Check Server Logs:**
```
🎮 Game Engine initializing...
🔧 Found 1 orphaned round(s). Recovering...
🔧 Recovering round 123 (ID: 456)
⏰ Round 123 ending - Processing results...
✅ Round 123 completed successfully
✅ All orphaned rounds recovered
🔄 Starting authoritative round monitor (1s interval)
```

**Pass Criteria:**
- ✅ Logs show "Found X orphaned round(s)"
- ✅ Orphaned rounds are recovered and completed
- ✅ New round starts automatically
- ✅ No errors in recovery process

---

### Test 3: No Duplicate Rounds
**Duration:** 10 minutes

Let the system run for at least 3-4 complete rounds.

**Check Database:**
```sql
-- Connect to database
psql -U luxwin_user -d luxwin

-- Check for duplicate round numbers
SELECT round_number, COUNT(*) as count
FROM game_rounds
GROUP BY round_number
HAVING COUNT(*) > 1;
```

**Expected Result:** `0 rows` (no duplicates)

**Check Sequence:**
```sql
SELECT round_number, status, result
FROM game_rounds
ORDER BY round_number DESC
LIMIT 10;
```

**Pass Criteria:**
- ✅ No duplicate round numbers
- ✅ Sequential round numbers (no gaps)
- ✅ All completed rounds have results
- ✅ Only 0-1 active rounds (betting or locked)

---

### Test 4: Betting Window Enforcement
**Duration:** 3 minutes

1. Start of round - place bet → **Should succeed**
2. Middle of round - place bet → **Should succeed**
3. 5 seconds before lock - place bet → **Should succeed**
4. 1 second before lock - place bet → **Should fail** (BETTING_CLOSED)
5. After lock - place bet → **Should fail** (BETTING_CLOSED)

**Check Frontend Response:**
```json
{
  "success": false,
  "message": "Betting is closed for this round",
  "error_code": "BETTING_CLOSED"
}
```

**Pass Criteria:**
- ✅ Bets accepted during betting window
- ✅ Bets rejected near/after lock time
- ✅ Clear error messages
- ✅ No bets accepted after status = 'locked'

---

### Test 5: Round Timing Accuracy
**Duration:** 5 minutes

Monitor 2-3 complete rounds.

**Check Timing:**
```javascript
// In browser console
let roundStartTime = Date.now();

// When countdown reaches 00:00
let roundEndTime = Date.now();
let actualDuration = (roundEndTime - roundStartTime) / 1000;

console.log(`Expected: 180s, Actual: ${actualDuration}s`);
// Should be within ±2 seconds
```

**Pass Criteria:**
- ✅ Round duration matches configured value (±2s)
- ✅ Lock happens at configured time (±1s)
- ✅ Consistent timing across multiple rounds
- ✅ No drift over time

---

## 🎯 Admin Control Tests

### Test 6: Pause/Resume
**Duration:** 5 minutes

**In Admin Panel** (`http://localhost:5000/admin.html`):

1. **Pause Game:**
   - Click "Pause Game" button
   - Server log: `⏸️ Game paused`
   - Wait for current round to end
   - Verify NO new round starts
   - Frontend shows "No active round"

2. **Resume Game:**
   - Click "Resume Game" button
   - Server log: `▶️ Game resumed`
   - Within 2 seconds, new round should start
   - Server log: `✅ Round X created`

**Pass Criteria:**
- ✅ Pause prevents new rounds
- ✅ Current round still completes
- ✅ Resume immediately creates new round
- ✅ System returns to normal operation

---

### Test 7: Manual Override
**Duration:** 3 minutes

**In Admin Panel:**

1. Set override: Color = `green`, Number = `7`
2. Wait for current round to complete
3. Next round should use the override
4. Check server logs:
   ```
   🔧 Manual override applied: green (7)
   ✅ Round X result set: green (7)
   ```
5. Following round should be auto (random)

**Pass Criteria:**
- ✅ Override applies to NEXT round only
- ✅ Override cleared after use
- ✅ Subsequent rounds are random
- ✅ Admin action logged

---

## 📊 Monitoring Commands

### Real-time Server Logs
```bash
# If using PM2
pm2 logs luxwin --lines 100

# If running directly
# Already visible in terminal
```

### Database Health Check
```sql
-- Current round status
SELECT * FROM game_rounds 
WHERE status IN ('betting', 'locked')
ORDER BY round_number DESC 
LIMIT 1;

-- Recent completed rounds
SELECT round_number, status, result, result_number, 
       end_time, created_at
FROM game_rounds 
WHERE status = 'completed'
ORDER BY round_number DESC 
LIMIT 5;

-- Pending bets (should be 0 for completed rounds)
SELECT COUNT(*) as pending_bets
FROM bets 
WHERE result = 'pending'
AND round_id IN (
  SELECT id FROM game_rounds WHERE status = 'completed'
);
```

### API Health Check
```bash
# Check current round
curl http://localhost:5000/api/game/current-round

# Expected response:
{
  "success": true,
  "data": {
    "round_id": 123,
    "round_number": 456,
    "status": "betting",
    "time_until_lock": 150,
    "time_until_end": 180,
    "can_bet": true
  }
}
```

---

## ✅ Success Checklist

After running all tests, verify:

- [ ] Countdown **never** freezes at 0.00
- [ ] New round starts within 2-3 seconds after previous ends
- [ ] Round numbers increment sequentially
- [ ] Server restart recovers orphaned rounds automatically
- [ ] No duplicate rounds in database
- [ ] Betting window enforced correctly
- [ ] Round timing accurate (±2 seconds)
- [ ] Pause/Resume works correctly
- [ ] Manual override applies to next round only
- [ ] No errors in server logs
- [ ] No errors in browser console
- [ ] Database queries return expected data

---

## 🐛 Troubleshooting

### Problem: Countdown stuck at 00:00

**Solution:**
```bash
# 1. Check if backend has active round
curl http://localhost:5000/api/game/current-round

# 2. If null, restart server (recovery will handle it)
pm2 restart luxwin

# 3. Monitor logs for recovery
pm2 logs luxwin --lines 50
```

---

### Problem: No new round after previous ends

**Check:**
1. Is game paused? → Check admin panel
2. Any errors in logs? → Check `pm2 logs`
3. Database state? → Run SQL health check

**Solution:**
```bash
# Restart server - monitor will detect and create round
pm2 restart luxwin
```

---

### Problem: Multiple active rounds

**This should NEVER happen. If it does:**

```sql
-- Check for multiple active rounds
SELECT * FROM game_rounds 
WHERE status IN ('betting', 'locked')
ORDER BY round_number DESC;

-- If more than 1 row, manually complete old ones
UPDATE game_rounds 
SET status = 'completed', 
    result = 'red', 
    result_number = 0
WHERE id = <old_round_id>;
```

Then restart server.

---

## 🎉 Expected Behavior Summary

### Normal Operation:
```
Round 100 (betting) → 02:30 remaining
Round 100 (betting) → 01:00 remaining
Round 100 (betting) → 00:30 remaining
Round 100 (locked)  → 00:15 remaining [No more bets]
Round 100 (locked)  → 00:05 remaining
Round 100 (locked)  → 00:01 remaining
Round 100 (locked)  → 00:00 remaining
[2 second processing gap]
Round 101 (betting) → 03:00 remaining [New round starts]
```

### After Server Restart:
```
Server Stop (Round 100 at 01:30 remaining)
   ↓
[Server Down]
   ↓
Server Start
   ↓
Recovery: Complete Round 100 immediately
   ↓
Round 101 created within 3 seconds
```

---

## 📝 Test Results Template

Copy and fill out:

```
Date: _______________
Tester: _____________

Test 1 - Countdown Never Freezes: [ PASS / FAIL ]
Notes: _________________________________

Test 2 - Server Restart Recovery: [ PASS / FAIL ]
Notes: _________________________________

Test 3 - No Duplicate Rounds: [ PASS / FAIL ]
Notes: _________________________________

Test 4 - Betting Window: [ PASS / FAIL ]
Notes: _________________________________

Test 5 - Timing Accuracy: [ PASS / FAIL ]
Notes: _________________________________

Test 6 - Pause/Resume: [ PASS / FAIL ]
Notes: _________________________________

Test 7 - Manual Override: [ PASS / FAIL ]
Notes: _________________________________

Overall System Status: [ PRODUCTION READY / NEEDS FIXES ]
```

---

**If all tests pass: The system is production-ready! 🎉**