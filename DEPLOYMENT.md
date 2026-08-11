# MemeDash Vercel Deployment Guide

## Prerequisites

- Vercel account (sign up at https://vercel.com)
- Git repository with memedash code
- Supabase account and project created
- Memecoin scanner running locally or accessible via API
- Telegram bot token (from @BotFather)

## Step 1: Prepare Supabase Project

### Create Supabase Project
1. Go to https://supabase.com
2. Create new project
3. Wait for initialization

### Run Schema
1. Go to SQL Editor in Supabase dashboard
2. Copy entire content from `supabase-schema.sql`
3. Paste into SQL editor and execute
4. Verify all 6 tables created:
   - `users`
   - `tokens`
   - `watchlist`
   - `alert_rules`
   - `alert_history`
   - `scanner_status`

### Get Credentials
In Supabase Settings → API:
- Copy `URL` → `SUPABASE_URL`
- Copy `anon public` key → `SUPABASE_ANON_KEY`
- Copy `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY`

Save these — you'll need them for Vercel.

## Step 2: Prepare GitHub Repository

### Push Code to GitHub
```bash
cd /Users/mac/Documents/Projects/memedash
git init
git add .
git commit -m "Initial MemeDash backend commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/memedash.git
git push -u origin main
```

### Create .env.local (Local Only)
Do NOT push to GitHub. Create locally:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SCANNER_API_URL=http://localhost:3001
TELEGRAM_BOT_TOKEN=1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh
NODE_ENV=development
```

## Step 3: Deploy to Vercel

### Option A: Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Click "Add New..." → "Project"
3. Select your GitHub repository
4. Configure project:
   - **Framework**: Node.js
   - **Root Directory**: . (default)
   - **Build Command**: `npm run build` (or leave blank if no build needed)
   - **Install Command**: `npm install`
   - **Start Command**: `npm start` (or leave blank)

5. Click "Deploy"

### Option B: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel@latest

# Login
vercel login

# Deploy
cd /Users/mac/Documents/Projects/memedash
vercel

# Follow prompts to link project
```

## Step 4: Set Environment Variables on Vercel

### In Vercel Dashboard:

1. Go to your project
2. Settings → Environment Variables
3. Add each variable:

| Key | Value | Environments |
|-----|-------|--------------|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` | Production, Preview, Development |
| `SUPABASE_ANON_KEY` | `eyJ...` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Production, Preview, Development |
| `SCANNER_API_URL` | `http://localhost:3001` or your scanner URL | Production, Preview, Development |
| `TELEGRAM_BOT_TOKEN` | `1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh` | Production |

**Important**: Only set `TELEGRAM_BOT_TOKEN` in Production if you have a real bot token. For testing, leave blank or use a test bot.

## Step 5: Configure Telegram Webhook

### Get Your Vercel Domain

After deployment, you'll have a domain like:
```
https://memedash-xxxxx.vercel.app
```

### Set Telegram Webhook

Use curl or Telegram Bot API directly:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"url": "https://memedash-xxxxx.vercel.app/api/telegram/webhook"}' \
  https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook
```

Replace:
- `memedash-xxxxx.vercel.app` with your actual Vercel domain
- `<TELEGRAM_BOT_TOKEN>` with your bot token

### Verify Webhook

```bash
curl https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo
```

You should see:
```json
{
  "ok": true,
  "result": {
    "url": "https://memedash-xxxxx.vercel.app/api/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

## Step 6: Test API Endpoints

### Test Scanner Endpoint

```bash
curl "https://memedash-xxxxx.vercel.app/api/scanner/latest"
```

Expected response:
```json
{
  "success": true,
  "count": 20,
  "tokens": [...]
}
```

### Test Watchlist Endpoint

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user-123", "token_mint": "SomeTokenMint"}' \
  "https://memedash-xxxxx.vercel.app/api/watchlist/add"
```

### Test Dashboard

```bash
curl "https://memedash-xxxxx.vercel.app/api/dashboard/status?user_id=user-123"
```

## Step 7: Test Telegram Bot

### Start Bot Conversation

1. Find your bot on Telegram (search username or open bot link)
2. Click "Start" or send `/start`
3. Expected response: Welcome message with commands

### Test Commands

```
/add SOL
/watchlist
/rules
/history
/pause
/resume
```

## Troubleshooting

### Issue: "Module not found" errors

**Solution**: Ensure all dependencies in `package.json`:
```bash
npm install
```

Verify `node_modules` is NOT in `.gitignore`, but `.env` IS.

### Issue: Telegram webhook returns 403

**Possible causes**:
1. Bot token incorrect
2. Webhook URL has typo
3. Firewall blocking Telegram IPs

**Solution**:
1. Double-check bot token
2. Verify domain is reachable: `curl https://your-domain.vercel.app/api/scanner/latest`
3. Check Vercel function logs

### Issue: Supabase connection errors

**Solution**:
1. Verify environment variables are set correctly
2. Check Supabase project is active
3. Verify API keys have correct permissions
4. Check firewall allows Supabase IPs

### Issue: Scanner API returns 404

**Possible causes**:
1. `SCANNER_API_URL` incorrect
2. Local scanner not running
3. Port wrong in URL

**Solution**:
1. Verify scanner is running: `curl http://localhost:3001/latest-tokens`
2. If running on different machine, use correct IP/hostname
3. Update environment variable and redeploy

## Monitoring & Logs

### View Vercel Logs

```bash
vercel logs --follow
```

Or in dashboard: Deployments → Function Logs

### Check Telegram Webhook Status

```bash
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

### Monitor Supabase Activity

In Supabase dashboard: Settings → Logs

## Auto-Deployments

Vercel automatically deploys when you push to main branch:

```bash
# Make changes
git add .
git commit -m "Update API endpoint"
git push origin main

# Vercel automatically builds and deploys
# Check dashboard for deployment status
```

## Next: Phase 2 Setup

Once deployed, Phase 2 requires:

1. **Scanner Poller Job** (Vercel Cron)
   - Scheduled function to poll scanner every 30s
   - Evaluate alert rules
   - Send Telegram alerts

2. **Dashboard Frontend**
   - Connect React/HTML to API endpoints
   - Real-time data polling
   - Watchlist management UI

3. **Integration Testing**
   - End-to-end testing pipeline
   - Mock scanner for testing

## Quick Deployment Checklist

- [ ] Supabase project created and schema applied
- [ ] GitHub repository set up
- [ ] Vercel project linked to GitHub
- [ ] Environment variables set in Vercel dashboard
- [ ] Deployment successful (no errors)
- [ ] Telegram webhook configured
- [ ] Test endpoints working
- [ ] Telegram bot responding to commands
- [ ] Logs showing no errors
- [ ] Ready for Phase 2

---

**Deployed Endpoints After Setup:**

- `GET /api/scanner/latest` - Latest tokens
- `GET /api/scanner/status` - Scanner health
- `POST /api/watchlist/add` - Add to watchlist
- `DELETE /api/watchlist/remove` - Remove from watchlist
- `GET /api/watchlist` - Get watchlist
- `POST /api/rules` - Create rule
- `GET /api/rules` - Get rules
- `PUT /api/rules` - Update rule
- `GET /api/alerts/history` - Alert history
- `POST /api/telegram/webhook` - Telegram commands
- `POST /api/telegram/send` - Send alert
- `GET /api/dashboard/status` - Dashboard status
- `GET /api/dashboard/tokens` - Dashboard tokens
- `GET /api/dashboard/stats` - Dashboard stats
