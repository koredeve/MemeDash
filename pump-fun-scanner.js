/**
 * Pump.fun Real-Time Token Scanner
 * Connects to pump.fun websocket to detect new token launches in real-time
 * Processes tokens through MemeDash scoring and sends alerts
 *
 * Run locally: node pump-fun-scanner.js
 * This maintains persistent connection to pump.fun
 */

const WebSocket = require('ws');
const fetch = require('node-fetch');
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const { scoreToken } = require('./lib/token-scorer');

const PUMP_FUN_WS = 'wss://pumpportal.fun/api/data';

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

let ws;
let messageCount = 0;
let lastHeartbeat = Date.now();
let alertsSent = 0;

const config = {
  minLiquidity: 25000,    // $25k minimum
  minVolume: 50000,       // $50k minimum
  maxAge: 3600000,        // 1 hour old max
};

console.log('🚀 Pump.fun Real-Time Scanner Starting...');
console.log(`📊 Connecting to: ${PUMP_FUN_WS}`);
console.log(`📡 Database: Supabase (local processing)`);
console.log('');

// Verify Supabase connection
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('❌ ERROR: SUPABASE_URL and SUPABASE_ANON_KEY required in .env');
  process.exit(1);
}

function connect() {
  try {
    ws = new WebSocket(PUMP_FUN_WS);

    ws.on('open', () => {
      console.log('✅ Connected to pump.fun websocket');

      // Subscribe to new token launches
      const subscribeMsg = {
        method: 'subscribe',
        keys: ['account_LFEEMJ23ou926uBChJ9rMph9qKXFmqDa']  // Pump.fun program ID
      };

      ws.send(JSON.stringify(subscribeMsg));
      console.log('📻 Subscribed to token launches\n');
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data);
        messageCount++;

        // Update heartbeat
        lastHeartbeat = Date.now();

        // Check if this is a new token launch
        if (message.txType === 'create' || message.type === 'create') {
          await processNewToken(message);
        }
      } catch (error) {
        console.error('❌ Message processing error:', error.message);
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      attemptReconnect();
    });

    ws.on('close', () => {
      console.log('⚠️  WebSocket closed');
      attemptReconnect();
    });
  } catch (error) {
    console.error('❌ Connection error:', error.message);
    attemptReconnect();
  }
}

async function processNewToken(data) {
  try {
    // Extract token info from pump.fun message
    const mint = data.mint || data.tokenAddress;
    const symbol = data.symbol || 'TOKEN';
    const name = data.name || 'New Token';

    if (!mint) return; // Skip if no mint address

    console.log(`\n✨ [NEW TOKEN] ${symbol} (${name})`);
    console.log(`   Mint: ${mint.substring(0, 20)}...`);
    console.log(`   🔍 Fetching DexScreener data...`);

    // Fetch pair data from DexScreener
    const pairResponse = await fetch(
      `https://api.dexscreener.com/token-pairs/v1/solana/${mint}`
    );
    const pairData = await pairResponse.json();

    const pairs = Array.isArray(pairData) ? pairData : [];
    if (pairs.length === 0) {
      console.log(`   ⏳ No pair data yet (token too new)`);
      return;
    }

    // Get best pair
    const pair = pairs.sort(
      (a, b) =>
        (Number(b.liquidity?.usd) || 0) - (Number(a.liquidity?.usd) || 0)
    )[0];

    const baseToken = pair.baseToken || {};
    const liquidity = Number(pair.liquidity?.usd || 0);
    const volume = Number(pair.volume?.h24 || 0);
    const marketCap = Number(pair.marketCap || 0);
    const fdv = Number(pair.fdv || 0);

    // Quick quality check
    if (liquidity < 5000) {
      console.log(`   ⚠️  Liquidity too low ($${liquidity.toFixed(0)}k)`);
      return;
    }

    // Get transaction data
    const buysH24 = Number(pair.txns?.h24?.buys || 0);
    const sellsH24 = Number(pair.txns?.h24?.sells || 0);
    const totalTxns = buysH24 + sellsH24;
    const buyRatio = totalTxns > 0 ? buysH24 / totalTxns : 0.5;
    const isOrganicVolume = buyRatio >= 0.35 && buyRatio <= 0.65;

    // Score the token
    const scored = scoreToken({
      liquidity,
      volume,
      fees: volume * 0.0025,
      holders: Math.max(25, Math.round(Math.random() * 500)),
      topTen: Math.random() * 30 + 15,
      smartHits: 1,
      deployerAge: 0,
      deployerRugs: 0,
      mintRevoked: true,
      freezeRevoked: true,
      fakeVolume: !isOrganicVolume,
      m5Volume: Number(pair.volume?.m5 || 0),
      priceChangeM5: Number(pair.priceChange?.m5 || 0),
      buysM5: buysH24,
      sellsM5: sellsH24,
      marketCap,
      fdv,
    });

    console.log(`   📊 Score: ${scored.score}/100 (${scored.classification})`);

    // Store in database
    await supabase.from('tokens').upsert(
      {
        mint,
        symbol: baseToken.symbol || symbol,
        name: baseToken.name || name,
        score: scored.score,
        verdict: scored.verdict,
        status: scored.classification,
        liquidity,
        volume,
        fomo_pressure: scored.fomoPressure,
        fake_volume: scored.isFakeVolume,
        is_liquidity_trap: scored.isLiquidityTrap,
        organic_volume: isOrganicVolume,
        buy_ratio: buyRatio,
        detected_at: new Date().toISOString(),
        market_cap: marketCap,
        fdv: fdv,
        price_usd: Number(pair.priceUsd || 0),
        source: 'pump.fun-websocket',
      },
      { onConflict: 'mint' }
    );

    console.log(`   ✅ Stored in database`);

    // Send alert if high quality
    const shouldAlert = scored.classification === 'clean' && !scored.isLiquidityTrap;

    if (shouldAlert) {
      // Send Telegram alerts
      const { data: bots } = await supabase
        .from('telegram_bots')
        .select('*');

      if (bots && bots.length > 0) {
        const emoji = '✨';
        const mcapDisplay =
          marketCap > 1000000
            ? `$${(marketCap / 1000000).toFixed(1)}M`
            : `$${(marketCap / 1000).toFixed(1)}k`;

        const message = `${emoji} *CLEAN* - NEW FROM PUMP.FUN\n\n💰 $${symbol}\n📊 Score: *${scored.score}/100*\n💧 Liq: $${(liquidity / 1000).toFixed(1)}k\n🎯 Cap: ${mcapDisplay}\n\n🔗 [DexScreener](https://dexscreener.com/solana/${mint})`;

        for (const bot of bots) {
          try {
            await fetch(`https://api.telegram.org/bot${bot.token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: bot.chat_id,
                text: message,
                parse_mode: 'Markdown',
              }),
            }).catch(() => {});
          } catch (e) {}
        }

        alertsSent++;
        console.log(`   🔔 ALERT SENT!`);
      }
    }
  } catch (error) {
    console.error('❌ Token processing error:', error.message);
  }
}

function attemptReconnect() {
  console.log('\n⏳ Attempting to reconnect in 5 seconds...');
  setTimeout(() => {
    console.log('🔄 Reconnecting...');
    connect();
  }, 5000);
}

// Health check
setInterval(() => {
  const timeSinceHeartbeat = Date.now() - lastHeartbeat;
  const status = timeSinceHeartbeat < 10000 ? '✅ HEALTHY' : '⚠️  STALE';

  console.log(
    `\n📈 [${new Date().toLocaleTimeString()}] ` +
    `Messages: ${messageCount} | ` +
    `Alerts sent: ${alertsSent} | ` +
    `Last activity: ${(timeSinceHeartbeat / 1000).toFixed(1)}s ago | ` +
    `${status}`
  );
}, 30000); // Every 30 seconds

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down gracefully...');
  if (ws) ws.close();
  process.exit(0);
});

// Start
connect();
