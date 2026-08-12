# MemeDash User Guide

**Real-Time Memecoin Alert System for Pump.fun Tokens**

---

## 📱 Quick Start

### Access the Dashboard
Open **[MemeDash Web App](https://lightmeme.vercel.app)** in your browser (works on desktop and mobile).

### Connect Your Telegram
1. Open Telegram and search for **@lightmeme_bot**
2. Send `/start` to the bot
3. The bot will confirm it's connected to your account
4. You'll now receive real-time alerts about new tokens and status changes

---

## 🎯 Dashboard Features

### 1. Live Token Feed
The main dashboard shows all detected tokens in real-time:

- **Score (0-100)** — Quality rating of the token
  - **Green (75+)** — CLEAN tokens, safe to enter
  - **Yellow (55-74)** — WATCH tokens, promising but needs monitoring
  - **Red (<55)** — AVOID tokens, high risk

- **Verdict** — Human-readable quality summary
  - "Solid Fundamentals" — Good entry point
  - "Promising Watch" — Could be good later
  - "High Risk" — Stay away

- **Metrics**
  - 💧 Liquidity — Market depth ($k)
  - 📈 Volume — 24h trading volume ($k)
  - 🎯 Market Cap — Token's current valuation ($M)
  - 🔥 FOMO Pressure — How many people are buying (% scale)

### 2. Token Details & Audit
Click **"Send Full Audit"** on any token to get a detailed report that includes:

- **Scoring breakdown** — How the score was calculated
- **Quality factors** — Liquidity, volume, holder distribution
- **Safety checks** — Authority revocation, deployer history, mint/freeze status
- **Fake volume detection** — Flags suspicious trading patterns
- **DexScreener link** — View the token's complete on-chain data

This audit is sent to your Telegram chat immediately.

### 3. Watchlist (Graduation Alerts)
**Track promising tokens** as they grow. When a watched token graduates from WATCH → CLEAN status, you'll get an alert.

### 4. Mobile Menu
On mobile devices:
- Tap the **☰ hamburger icon** (top-right) to open the menu
- Select options:
  - 📊 Show Live Feed
  - ✅ Show Watchlist
  - ⏰ Show Status
  - 👛 Track Smart Wallet
  - ❓ Help & Commands
  - ⚙️ Settings

---

## 🤖 Telegram Bot Commands

Send these commands to **@lightmeme_bot** in Telegram:

### Core Commands

| Command | What It Does |
|---------|-------------|
| `/start` | Connect your account, receive all alerts |
| `/help` | Show all available commands |
| `/watchlist` | List tokens you're currently watching |
| `/history` | Show your recent token alerts |
| `/status` | Check if the scanner is running |

### Advanced Commands

| Command | What It Does |
|---------|-------------|
| `/add <token_mint>` | Add a token to your watchlist manually |
| `/remove <token_mint>` | Remove a token from watchlist |
| `/pause` | Temporarily stop receiving alerts |
| `/resume` | Resume receiving alerts |

### Setting Alert Rules (Optional)

| Command | What It Does |
|---------|-------------|
| `/setrule min_liquidity 50000` | Only alert tokens with $50k+ liquidity |
| `/setrule min_volume 25000` | Only alert tokens with $25k+ 24h volume |
| `/setrule min_score 65` | Only alert high-quality tokens (score 65+) |

---

## 🧠 Understanding the Scoring System

### Score Components (0-100 Scale)

**Base Score: 50** (neutral starting point)

#### Positive Factors
- ✅ **Liquidity Score** (+5 to +15) — More liquidity = more safety
- ✅ **Holder Distribution** (+5 to +10) — Many holders = healthy community
- ✅ **Volume Quality** (+5 to +10) — Organic vs suspicious trading patterns
- ✅ **Authority Checks** (+10) — Mint/freeze authority revoked?
- ✅ **Deployer History** (+5) — Is deployer trustworthy?
- ✅ **Smart Money** (+5) — Are smart wallets buying?

#### Negative Factors (Penalties)
- ❌ **Fake Volume** (-28) — Volume/Liquidity ratio > 28 suggests wash trading
- ❌ **Poor Liquidity** (-15) — Less than $25k liquidity
- ❌ **Low Volume** (-10) — Less than $50k 24h volume
- ❌ **Suspicious Patterns** (-10) — Bundled purchases, unusual fee patterns

### Classification

- **CLEAN (75+)** — Ready to enter with confidence
- **WATCH (55-74)** — Monitor for graduation to CLEAN
- **AVOID (<55)** — High risk, skip this token

---

## 📊 Alert Types

### 1. New Token Alert
Sent when a new token is detected and meets quality standards.

**Includes:**
- Token symbol and score
- Classification (CLEAN/WATCH/AVOID)
- Key metrics (liquidity, volume, market cap)
- DexScreener link for verification
- Age of token (minutes old)

### 2. Graduation Alert
Sent when a watched token improves from WATCH → CLEAN status.

**Includes:**
- "🎓 TOKEN GRADUATED TO CLEAN!" header
- Original entry metrics (when you watched it)
- New metrics (current state)
- Full audit link
- Recommendation to verify on-chain

### 3. Smart Wallet Alert
Sent when a tracked smart wallet buys a token you're monitoring.

**Includes:**
- Wallet address and label
- Token being purchased
- Entry price and amount
- Your portfolio impact

---

## 👛 Smart Wallet Tracking

Monitor what successful traders are doing:

1. **Identify a smart wallet** (from Twitter, Discord, on-chain trackers, etc.)
2. **Open MemeDash dashboard**
3. **Go to Mobile Menu → "Track Smart Wallet"** (or use Telegram)
4. **Enter wallet address** and optional label
5. **You'll get alerts** when they buy tokens

---

## ⚙️ Automated Scanning

MemeDash runs **continuous automated scanning**:

- **Every 5 minutes** — Scans pump.fun for new tokens, scores them
- **Every 30 minutes** — Checks if your watched tokens graduated
- **Real-time** — Telegram alerts sent immediately on new discoveries

You don't need to do anything — just receive alerts and act on them.

---

## 🎯 Best Practices

### Finding High-Quality Tokens
1. **Start in CLEAN tier** (score 75+) for safety
2. **Watch WATCH tokens** (score 55-74) for potential 10x-100x plays
3. **Avoid AVOID tokens** (score <55) unless you have strong conviction

### Using the Watchlist
1. **Add promising tokens** when they hit WATCH status
2. **Get graduation alerts** when they improve to CLEAN
3. **Track the improvement path** to understand timing

### Due Diligence
Always verify on-chain before trading:
1. Check the **[DexScreener link](https://dexscreener.com)** in the alert
2. Verify **liquidity is stable** (not dropping)
3. Check **holder distribution** (not whale trap)
4. Look at **transaction history** (organic buys vs pump bots)

### Setting Rules
Customize alerts to reduce noise:
```
/setrule min_score 70      # Only high-quality tokens
/setrule min_liquidity 75000  # Ignore low-liquidity tokens
/setrule min_volume 50000     # Require real volume
```

---

## 🚨 Red Flags (AVOID Immediately)

- ❌ **Fake Volume** — Volume/Liquidity ratio > 28 = wash trading
- ❌ **Low Liquidity** — Less than $25k (easy rug pull)
- ❌ **No Organic Volume** — Spiky 5m volume (pump bot activity)
- ❌ **Authority NOT Revoked** — Deployer can still mint/freeze
- ❌ **Deployer Red Flag** — History of rugged projects
- ❌ **Bundled Purchases** — Same buyer in multiple early transactions
- ❌ **Whale Trap** — 90%+ of tokens held by 1-2 wallets

---

## 📱 Mobile App Tips

### Layout
- **Header** — Shows scanner status and live metrics
- **Token List** — Scroll down to see all detected tokens
- **Hamburger Menu** — ☰ (top-right) for additional features
- **Actions** — Tap any token for quick audit or watch actions

### Touch Gestures
- **Scroll** — Browse token list
- **Tap Token** — View details
- **Tap Menu** — Open mobile menu
- **Tap "Send Full Audit"** — Get detailed report in Telegram

### Dark Mode
The dashboard automatically matches your device's theme (light/dark).

---

## 🔗 Useful Links

- **Dashboard:** https://lightmeme.vercel.app
- **Telegram Bot:** @lightmeme_bot
- **DexScreener:** https://dexscreener.com (for manual verification)
- **Pump.fun:** https://pump.fun (launch site)

---

## ❓ FAQ

### How often are tokens scanned?
Every 5 minutes, we check pump.fun for new tokens and score them.

### Why didn't I get an alert for a token?
The token was probably AVOID status (score <55) or had suspicious volume patterns.

### How is the score calculated?
50 base points + bonuses for liquidity/holders/volume/authorities - penalties for fake volume/poor fundamentals.

### Can I trust the score?
The score is one data point. Always do your own on-chain verification using the DexScreener link before trading.

### What's fake volume?
When volume looks inflated compared to liquidity. Example: $500k volume with only $25k liquidity = wash trading (volume/liquidity = 20x).

### How do I know if a token will moon?
You don't — nobody does. The score helps you find safer entry points, but risk is always present in memecoin trading.

### Can I adjust alert frequency?
Yes, use `/setrule` commands in Telegram to set minimum score/liquidity/volume thresholds.

### Does MemeDash guarantee profits?
No. This is a scanning tool to help you identify quality tokens earlier. Trading decisions are yours, and losses are possible.

### What if the bot isn't sending alerts?
1. Check you sent `/start` to @lightmeme_bot
2. Check your chat ID is registered (reply with `/start` again)
3. Verify the scanner is running (Dashboard → Status)

---

## 💡 Getting Help

**In Telegram:** Send `/help` to @lightmeme_bot

**Common Issues:**
- "No alerts received" → Send `/start` again to @lightmeme_bot
- "Old alerts only" → Wait 5 minutes for next scan cycle
- "Dashboard loads slow" → This is normal on first load (data fetching)

---

**Happy trading! 🚀**

*Last Updated: 2026-08-12*
