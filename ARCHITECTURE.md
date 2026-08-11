# MemeDash - Complete System Architecture

**Date:** 2026-08-11  
**Status:** Architecture locked before implementation  
**Author:** Senior Development Plan

---

## 1. SYSTEM OVERVIEW

```
┌─────────────────────────────────────────────────────────────┐
│                    REAL-TIME MEMECOIN ALERT SYSTEM           │
└─────────────────────────────────────────────────────────────┘

REAL-TIME DATA SOURCE
│
├─ Pump.fun Websocket
│  └─ Live token creation events
│     └─ Memecoin Scanner (running 24/7)
│        └─ Detects: name, mint, liquidity, volume, FDV
│
├─────────────────────────────────────────────────────────────
│
PROCESSING LAYER (Vercel Backend)
│
├─ Scanner Poller (every 15-30s)
│  └─ Fetches latest tokens from scanner
│  └─ Caches results in database
│  └─ Applies alert rules
│  └─ Triggers alerts
│
├─ Alert Rules Engine
│  └─ Reads rules from database
│  └─ Evaluates: watchlist, score, liquidity, age, etc.
│  └─ Determines: send alert? to which channels?
│
├─ Webhook Handler (Telegram)
│  └─ Receives: /start, /add, /remove, /rules commands
│  └─ Updates database with user preferences
│  └─ Sends alerts back through bot
│
├─────────────────────────────────────────────────────────────
│
OUTPUT CHANNELS
│
├─ Telegram Bot (Primary Alert)
│  ├─ Sends real-time alerts when tokens match rules
│  ├─ Receives commands from user (/add token, /remove, etc.)
│  ├─ Bidirectional sync with database
│  └─ Works 24/7 even when dashboard closed
│
├─ Vercel Dashboard (Control Center)
│  ├─ Shows scanner status (tokens scanned, alerts sent)
│  ├─ Displays watchlist + history
│  ├─ Configure alert rules
│  ├─ View token audit trail
│  ├─ Real-time updates via polling or websocket
│  └─ Reflects Telegram bot actions
│
├─ Database (Single Source of Truth)
│  ├─ Watchlists (user's tracked tokens)
│  ├─ Alert Rules (score threshold, liquidity min, etc.)
│  ├─ Alert History (what was sent, when, to whom)
│  ├─ Token Data (cached from scanner)
│  └─ User Preferences (Telegram ID, alert settings)
│
└─────────────────────────────────────────────────────────────
```

---

## 2. DATA FLOW - Step by Step

### FLOW A: Token Detection → Alert

```
1. SCAN (Every 30s)
   Memecoin Scanner detects new token
   └─ Example: KEDAENG (score: 81, liq: $18.5k, age: 4m)

2. PROCESS
   Vercel backend polls scanner
   └─ Fetches: name, mint, score, liquidity, volume, age
   └─ Stores in database (cache layer)

3. EVALUATE
   Alert Rules Engine checks:
   ├─ Is token on watchlist? → YES/NO
   ├─ Does score >= threshold? → YES/NO
   ├─ Is liquidity >= minimum? → YES/NO
   ├─ Is age within range? → YES/NO
   └─ Result: ALERT or SKIP

4. SEND
   If ALERT:
   ├─ Telegram Bot sends message with token details
   ├─ Dashboard updates in real-time (new alert appears)
   └─ Database logs: who got alert, when, which token

5. USER SEES
   ├─ Telegram: Push notification on phone
   └─ Dashboard: Alert appears in timeline
```

### FLOW B: User Adds to Watchlist (Dashboard)

```
1. USER ACTION
   Click "Add to Watchlist" in dashboard for token XYZ

2. SEND TO BACKEND
   Dashboard calls: POST /api/watchlist/add
   ├─ Payload: { token_mint: "ABC...", user_id: "..." }
   └─ Auth: User session token

3. DATABASE UPDATE
   Backend stores:
   ├─ watchlist table: (user_id, token_mint, added_at)
   └─ Alert history: "User added XYZ to watchlist"

4. IMMEDIATE EFFECT
   ├─ Future scans now include XYZ in alert evaluation
   ├─ If XYZ appears again with high score → alert sent
   └─ Both bot and dashboard see the same watchlist
```

### FLOW C: User Commands via Telegram

```
1. USER TEXTS BOT
   /add KEDAENG
   or
   /remove MOON

2. BOT RECEIVES
   Telegram webhook triggers backend
   ├─ Parse command and token
   └─ Identify user (Telegram ID from database)

3. BACKEND PROCESSES
   ├─ Validate token exists
   ├─ Update database (watchlist table)
   └─ Send confirmation to bot

4. BOT RESPONDS
   "✅ Added KEDAENG to watchlist"

5. DASHBOARD UPDATES
   ├─ Next refresh shows KEDAENG in watchlist
   └─ User sees bot action reflected in web UI
```

---

## 3. DATABASE SCHEMA

### Table: tokens (cached scanner data)
```sql
CREATE TABLE tokens (
  id UUID PRIMARY KEY,
  mint VARCHAR UNIQUE,
  name VARCHAR,
  symbol VARCHAR,
  score FLOAT,
  liquidity DECIMAL,
  volume_5m DECIMAL,
  age_minutes INT,
  fomo_score INT,
  detected_at TIMESTAMP,
  last_updated TIMESTAMP
)
```

### Table: watchlist (user's tracked tokens)
```sql
CREATE TABLE watchlist (
  id UUID PRIMARY KEY,
  user_id VARCHAR,           -- Telegram ID or dashboard user
  token_mint VARCHAR,
  added_at TIMESTAMP,
  source VARCHAR             -- 'telegram', 'dashboard'
)
```

### Table: alert_rules (user preferences)
```sql
CREATE TABLE alert_rules (
  id UUID PRIMARY KEY,
  user_id VARCHAR,
  min_score INT,            -- e.g., 70
  min_liquidity DECIMAL,    -- e.g., $50k
  max_age_minutes INT,      -- e.g., 30 (only new tokens)
  alert_channels ARRAY,     -- ['telegram', 'dashboard']
  enabled BOOLEAN,
  created_at TIMESTAMP
)
```

### Table: alert_history (audit trail)
```sql
CREATE TABLE alert_history (
  id UUID PRIMARY KEY,
  user_id VARCHAR,
  token_mint VARCHAR,
  token_name VARCHAR,
  score FLOAT,
  liquidity DECIMAL,
  alert_type VARCHAR,       -- 'watchlist_match', 'rule_match', etc.
  channels_sent ARRAY,      -- ['telegram']
  sent_at TIMESTAMP
)
```

### Table: users (bot/dashboard users)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  telegram_id VARCHAR UNIQUE,
  dashboard_user_id VARCHAR UNIQUE,
  created_at TIMESTAMP,
  settings JSON             -- alert preferences, etc.
)
```

---

## 4. API ENDPOINTS (Vercel Backend)

### Scanner Integration
- `GET /api/scanner/latest` → Last N tokens from scanner
- `GET /api/scanner/status` → Scanner health + scan count

### Watchlist Management
- `POST /api/watchlist/add` → Add token to user's list
- `DELETE /api/watchlist/remove/{mint}` → Remove token
- `GET /api/watchlist` → Get user's entire watchlist
- `GET /api/watchlist/{mint}` → Check if token is watched

### Alert Rules
- `GET /api/rules` → Get user's alert rules
- `PUT /api/rules` → Update rules (score threshold, etc.)
- `GET /api/rules/evaluate?mint=ABC` → Test if token would alert

### Alerts & History
- `GET /api/alerts/history` → Recent alerts sent
- `GET /api/alerts/today` → Alerts sent today
- `GET /api/alerts/{id}` → Specific alert details

### Telegram Webhook
- `POST /api/telegram/webhook` → Receive bot messages/commands
- `POST /api/telegram/send` → Send message via bot (internal)

### Dashboard Status
- `GET /api/dashboard/status` → Scanner + alert stats
- `GET /api/dashboard/tokens` → List of recent tokens
- `GET /api/dashboard/stats` → Charts data

---

## 5. TELEGRAM BOT COMMANDS

```
/start               → Initialize user, store Telegram ID in database
/add <token>        → Add token to watchlist
/remove <token>     → Remove token from watchlist
/watchlist          → Show current watchlist
/rules              → Show current alert rules
/setrule score:70   → Update minimum score threshold
/history            → Show recent alerts
/pause              → Disable alerts temporarily
/resume             → Re-enable alerts
```

---

## 6. VERCEL DASHBOARD FEATURES

### Scanner Section
- Live scan counter
- Recent tokens detected (last 10)
- Real-time status (connected/disconnected)

### Watchlist Section
- List all tokens being watched
- Add new token by mint/name
- Remove token
- Search/filter

### Alert Rules Section
- Set minimum score threshold
- Set minimum liquidity
- Set maximum token age
- Enable/disable alerts
- Choose channels (Telegram, Dashboard, etc.)

### Token Audit Section
- Full history of detected tokens
- Score, liquidity, volume, FDV for each
- Why it did/didn't alert

### Journal Section
- Timeline of all alerts sent
- Which tokens, when, why
- Quick links to Dexscreener/Pump.fun

### Settings Section
- Telegram Bot ID (read-only)
- API keys management
- Export watchlist/history
- Backup settings

---

## 7. INTEGRATION POINTS

### Scanner → Backend
```
Every 30s:
Backend polls memecoin scanner (running locally)
├─ Fetches latest tokens
├─ Caches in database
└─ Runs alert evaluation
```

### Backend → Telegram Bot
```
When alert triggers:
Backend calls Telegram Bot API
├─ sendMessage() to user's chat
└─ Includes: token details, score, liquidity, links
```

### Telegram Bot → Backend
```
When user sends command:
Telegram webhook hits /api/telegram/webhook
├─ Parse command
├─ Update database
└─ Send response back via bot
```

### Dashboard → Backend
```
User clicks action in web UI:
POST/GET to /api/* endpoints
├─ Add watchlist
├─ Update rules
├─ Fetch history
└─ Refresh status
```

### Backend → Dashboard (Real-time)
```
Dashboard polls /api/dashboard/status every 10s
OR uses WebSocket for live updates
├─ New tokens appear instantly
├─ Alerts show up as they're sent
└─ Watchlist updates immediately
```

---

## 8. DEPLOYMENT

### Vercel Frontend
- `/memedash` web dashboard (static + client-side JS)

### Vercel Backend
- `/api/*` serverless functions (Node.js)
- Environmental variables: Telegram token, DB connection, API keys

### Database
- Supabase PostgreSQL (free tier includes 2GB)
- OR: Firebase Firestore
- OR: Vercel KV + Postgres

### Memecoin Scanner
- Runs locally (already deployed)
- Backend polls it via HTTP or direct connection

### Telegram Bot
- Hosted by Telegram (serverless)
- Backend receives webhooks
- Backend sends messages via Telegram API

---

## 9. SECURITY & AUTH

### Telegram Users
- Telegram ID is the unique identifier
- No password needed (Telegram handles auth)
- Bot only responds to authorized users

### Dashboard Users
- Session-based or JWT tokens
- Only show user's own watchlist/alerts
- API validates user_id on each request

### Database
- Supabase row-level security (RLS) policies
- Each user sees only their own data
- Telegram bot verified via token

---

## 10. BUILD ORDER (RECOMMENDED)

### Phase 1: Backend Foundation (Week 1)
1. Set up Vercel project + environment
2. Create database schema (Supabase)
3. Build API endpoints (/scanner/*, /watchlist/*, /rules/*)
4. Implement scanner poller (every 30s)

### Phase 2: Telegram Integration (Week 2)
1. Create Telegram bot (user creates)
2. Build webhook receiver (/api/telegram/webhook)
3. Implement commands (/add, /remove, /watchlist, etc.)
4. Implement alert sending logic

### Phase 3: Dashboard Integration (Week 3)
1. Connect frontend to backend APIs
2. Real-time polling (every 10s)
3. Update watchlist UI
4. Update alert rules UI
5. Sync with Telegram bot data

### Phase 4: Refinement (Week 4)
1. Performance tuning
2. Error handling
3. Logging
4. User testing

---

## 11. SUCCESS CRITERIA

✅ Scanner detects token → Database cached within 30s  
✅ Alert rule matches → Telegram alert sent within 5s  
✅ User adds token in dashboard → Bot respects immediately  
✅ User sends /add command → Dashboard shows watchlist update  
✅ Dashboard closed → Alerts still work via Telegram  
✅ Browser refreshed → All user data persists  
✅ Multiple users → No data leakage between users  

---

**STATUS: Architecture locked. Ready to build phase-by-phase.**

**NEXT STEP:** Approval to begin Phase 1 (Backend Foundation)
