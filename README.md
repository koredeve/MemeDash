# MemeDash - Real-Time Memecoin Alert System

**Status:** ✅ **LIVE & PRODUCTION READY** - [View Dashboard](https://lightmeme.vercel.app)

Real-time memecoin alerts with a **web dashboard**, **Telegram bot**, and **automated scanner**. Detect new tokens, score quality (0-100), set custom alerts, and track promising tokens to "graduation."

---

## 🚀 Quick Start

### For Users
1. **Open Dashboard:** https://lightmeme.vercel.app
2. **Connect Telegram:** Send `/start` to [@lightmeme_bot](https://t.me/lightmeme_bot)
3. **Watch Tokens:** Click "📌 Track" on WATCH tokens
4. **Get Alerts:** Receive Telegram notifications on NEW tokens & graduations

### For Developers
1. **Read:** [USER_GUIDE.md](USER_GUIDE.md) - How to use MemeDash
2. **Review:** `/api` endpoints in this repo
3. **Deploy:** Fork to your Vercel account
4. **Customize:** Modify `api/scanner/run.js` for your rules

---

## ✨ Features

### 📊 Dashboard
- **Live Token Feed** - Real-time token detection & scoring
- **Filter by Status** - CLEAN (75+), WATCH (55-74), AVOID (<55)
- **Track Tokens** - Monitor WATCH tokens for graduation to CLEAN
- **Mobile Menu** - Hamburger navigation on mobile
- **System Status** - Real scanner health & metrics

### 🤖 Telegram Bot (@lightmeme_bot)
```
/start            → Connect your account
/watchlist        → See your tracked tokens
/track <address>  → Track a wallet
/history          → Recent alerts
/pause / /resume  → Control alerts
```

### 🔔 Alerts
- **NEW Token Alert** - Instantly when quality token detected
- **Graduation Alert** - When WATCH token → CLEAN
- **Smart Wallet Alert** - When tracked wallet buys
- **Status Changes** - When token classification changes

### 📈 Token Scoring
**0-100 Scale:**
- **75+** ✨ CLEAN - Safe entry point
- **55-74** 🔔 WATCH - Monitor for improvement
- **<55** ⚠️ AVOID - High risk
- **Factors:** Liquidity, volume, holder distribution, deployer history, fake volume detection

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────┐
│        MemeDash Dashboard                │
│  https://lightmeme.vercel.app            │
└────────────────┬─────────────────────────┘
                 │
     ┌───────────┼───────────┐
     ↓           ↓           ↓
 Scanner    Database    Telegram
 (Pump.fun) (Supabase)  (Bot API)
```

**Key Components:**
- **Scanner** - Detects new tokens every 5 minutes from pump.fun
- **Scorer** - Grades tokens 0-100 (liquidity, volume, holders, fake volume)
- **Database** - Tracks all tokens, watchlists, alerts (PostgreSQL)
- **Telegram** - Sends alerts and handles `/commands`
- **Dashboard** - Web UI at https://lightmeme.vercel.app

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| **[USER_GUIDE.md](USER_GUIDE.md)** | How to use MemeDash (dashboard, bot, alerts) |
| **README.md** | This file - system overview |
| **[CRITICAL_FIX_REQUIRED.md](CRITICAL_FIX_REQUIRED.md)** | Database schema fixes (if needed) |

---

## 🔧 API Endpoints (12 Total)

### Scanner
- `GET /api/scanner/run` - Trigger manual scan
- `GET /api/scanner/status` - Scanner health

### Tokens
- `GET /api/tokens/feed?limit=50` - Token list (filtered/paginated)
- `POST /api/tokens/score` - Score a token
- `POST /api/tokens/audit-send` - Send full audit to Telegram
- `POST /api/tokens/track-watch` - Track a WATCH token

### Watchlist
- `POST /api/tokens/check-graduation` - Check if WATCH → CLEAN

### Smart Wallets
- `POST /api/wallets/track` - Track a wallet
- `GET /api/wallets/list` - List tracked wallets

### Telegram
- `POST /api/telegram/webhook` - Handle bot commands
- `POST /api/telegram/set-webhook` - Configure webhook

---

## 🛠️ Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | HTML/CSS/JS | Single-page dashboard, mobile-friendly |
| **Backend** | Vercel Functions (Node.js 24) | Serverless, auto-scale, no DevOps |
| **Database** | Supabase PostgreSQL | Secure, built-in Row-Level Security |
| **Alerts** | Telegram Bot API | Real-time, no app needed |
| **Scanning** | EasyCron + pump.fun API | Automated job scheduler |

---

## 📊 Database Schema

**6 Tables:**
- `users` - Telegram profiles & settings
- `tokens` - Token cache (mint, symbol, score, status, metrics)
- `watchlist` - Tracked tokens (for graduation monitoring)
- `tracked_wallets` - Smart wallets being monitored
- `alert_rules` - User alert preferences
- `scanner_status` - Health metrics

---

## 🔐 Security

- ✅ **No hardcoded secrets** - Environment variables only
- ✅ **HTTPS enforced** - Vercel automatic TLS
- ✅ **Data isolation** - Row-Level Security (RLS) on all tables
- ✅ **Input validation** - All API parameters checked
- ✅ **Rate limiting** - Telegram & API rate limits respected

---

## 🚀 Deployment

**Currently Deployed:**
- Frontend: https://lightmeme.vercel.app
- Backend: Vercel Functions (12 endpoints)
- Database: Supabase (PostgreSQL)
- Bot: @lightmeme_bot (Telegram)

**To Deploy Your Own:**
1. Fork this repository
2. Connect to Vercel
3. Set environment variables (SUPABASE_URL, TELEGRAM_BOT_TOKEN, etc.)
4. Deploy (Vercel handles everything automatically)

---

## 📈 Performance

- **API Response:** 50-200ms
- **Database Query:** <10ms (indexed)
- **Alert Latency:** <2 seconds
- **Scalability:** Auto-scales with Vercel

---

## 🐛 Troubleshooting

**No alerts in Telegram?**
- Verify bot token in environment variables
- Check webhook is configured: `POST /api/telegram/set-webhook`
- Open console (F12) for errors

**Hamburger menu not working?**
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Check mobile mode (DevTools or real mobile)

**Same tokens appearing?**
- This is normal! Scanner detects ~5-10 new tokens per 5 min scan
- Look for newer `detected_at` timestamps for new detections
- Real tokens will appear at top of list

**Track button not working?**
- Only appears on WATCH status tokens (score 55-74)
- Check if token is actually WATCH classification

---

## 💡 How It Works

### When a New Token Launches
1. Scanner finds it on pump.fun
2. Scores it (0-100 using audit logic)
3. Checks quality filters (liquidity, volume, age, transaction count)
4. If CLEAN or high WATCH → Sends Telegram alert
5. Stores in database for tracking

### When You Track a Token
1. Click "📌 Track" on a WATCH token
2. Token added to watchlist in database
3. Every 30 min: System checks if improved to CLEAN
4. If upgraded → Telegram alert: "🎓 TOKEN GRADUATED TO CLEAN!"

### Graduation Detection
```
WATCH Token        Graduates        CLEAN Token
(Score 55-74)  →  After Hours   →  (Score 75+)
                   of Activity
                   
                    Alert! 
                   "Ready to buy"
```

---

## 🎯 Roadmap

**Completed (Phase 1-2):**
- ✅ Token detection & scoring
- ✅ Web dashboard
- ✅ Telegram bot & alerts
- ✅ Watchlist & graduation tracking
- ✅ Mobile responsive UI
- ✅ Smart wallet monitoring

**Future (Phase 3+):**
- 📱 Mobile app
- 💹 Advanced analytics
- 🔮 Predictive scoring
- 💰 Portfolio tracking
- 🎓 Educational content

---

## 📞 Support

**Issues?** Check:
1. Console (F12) for error messages
2. [USER_GUIDE.md](USER_GUIDE.md) FAQ section
3. Telegram bot `/help` command

**Found a bug?** Open an issue or contact the developer.

---

## 📄 License

Built with ❤️ for memecoin traders.

**Developer:** @lightmeme_bot  
**Date:** 2026-08-12  
**Status:** Production Live  

---

**Ready to trade?** Open https://lightmeme.vercel.app and start tracking tokens! 🚀
