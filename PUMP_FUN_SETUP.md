# Pump.fun Real-Time Scanner Setup

This guide sets up real-time token detection from pump.fun launches.

## What It Does

- 🚀 Connects to pump.fun websocket
- 🎯 Detects NEW token launches in real-time
- 📊 Scores each token using MemeDash algorithm
- 🔔 Sends Telegram alerts for quality tokens
- 📈 Stores metrics in Supabase

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

Create a `.env.local` file with:

```env
# Supabase (required for backend)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key

# Optional: Override API endpoint
MEMEDASH_API=https://lightmeme.vercel.app
```

### 3. Run the Scanner Locally

```bash
node pump-fun-scanner.js
```

You should see:
```
🚀 Pump.fun Real-Time Scanner Starting...
📊 Connecting to: wss://pumpportal.fun/api/data
📡 Sending tokens to: https://lightmeme.vercel.app
✅ Connected to pump.fun websocket
📻 Subscribed to token launches
```

### 4. It's Running! 

When new tokens launch, you'll see:

```
✨ [NEW TOKEN] BABYSHIB (Baby Shiba Inu)
   Mint: 8LHFZY9e1d2a3f...
   🔍 Sending to MemeDash for scoring...
   ✅ ALERT SENT! Score: 82/100 (clean)
```

---

## How It Works

### Architecture

```
Pump.fun Websocket
       ↓
pump-fun-scanner.js (local process)
       ↓
POST /api/scanner/process-token (Vercel backend)
       ↓
DexScreener API (fetch pair data)
       ↓
Token Scorer (calculate score)
       ↓
Telegram Bot (send alerts)
```

### Data Flow

1. **pump-fun-scanner.js** (Local)
   - Maintains persistent websocket connection
   - Listens for new token launches
   - Sends mint address to backend

2. **process-token endpoint** (Vercel)
   - Fetches full pair data from DexScreener
   - Scores the token
   - Stores in Supabase
   - Sends Telegram alerts

3. **MemeDash Dashboard**
   - Shows all detected tokens
   - Filters by status (clean/watch/avoid)
   - Real-time updates

---

## Running 24/7

### Option A: Keep Terminal Open (Development)

Simple: just leave the terminal running.

```bash
node pump-fun-scanner.js
```

### Option B: macOS LaunchAgent (Production)

Create `~/Library/LaunchAgents/com.memedash.pump-fun.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.memedash.pump-fun</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Users/mac/Documents/Projects/memedash/pump-fun-scanner.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/pump-fun-scanner.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/pump-fun-scanner-error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>SUPABASE_URL</key>
        <string>your_supabase_url</string>
        <key>SUPABASE_ANON_KEY</key>
        <string>your_supabase_key</string>
        <key>MEMEDASH_API</key>
        <string>https://lightmeme.vercel.app</string>
    </dict>
</dict>
</plist>
```

Then:
```bash
launchctl load ~/Library/LaunchAgents/com.memedash.pump-fun.plist
```

Monitor:
```bash
tail -f /tmp/pump-fun-scanner.log
```

### Option C: Docker (For VPS/Cloud)

```dockerfile
FROM node:24

WORKDIR /app
COPY . .
RUN npm install

ENV MEMEDASH_API=https://lightmeme.vercel.app

CMD ["node", "pump-fun-scanner.js"]
```

---

## Monitoring

### Check if Running

```bash
ps aux | grep pump-fun-scanner
```

### View Logs (LaunchAgent)

```bash
tail -100 /tmp/pump-fun-scanner.log
```

### Health Stats

The scanner prints stats every 30 seconds:
```
📈 [12:34:56 PM] Messages: 1523 | Last activity: 2.3s ago | ✅ HEALTHY
```

---

## Troubleshooting

### "Connection error" / Reconnecting constantly

- Check internet connection
- Verify pump.fun is online: https://pumpfun.solana.com
- Restart scanner

### No tokens being detected

- Normal if no new tokens are launching
- Monitor the message count in health stats
- Check the logs for errors

### Tokens detected but no alerts

- Token quality doesn't meet threshold
- Check score in MemeDash dashboard
- Adjust filters in `process-token.js` if needed

### Telegram alerts not sending

- Verify bot is connected: `curl https://lightmeme.vercel.app/api/telegram/auth`
- Check Telegram chat ID is correct
- Verify bot token is valid

---

## Dashboard Integration

Once running, tokens appear in real-time on:

```
https://lightmeme.vercel.app/
```

- ✨ Clean tokens (high quality)
- 🔔 Watch tokens (need attention)  
- ⚠️ Avoid tokens (detected issues)

---

## Performance Notes

- **Memory:** ~100-200MB steady state
- **CPU:** Minimal (< 5%)
- **Network:** ~50-100 KB/s incoming from pump.fun
- **API Calls:** ~0.1-0.5 per second (when tokens launch)

---

## Next Steps

1. **Run locally** for 1 hour to verify it's working
2. **Set up LaunchAgent** or Docker for 24/7 operation
3. **Monitor logs** for the first day
4. **Adjust filters** in `process-token.js` if too many false positives

Questions? Check the logs!
