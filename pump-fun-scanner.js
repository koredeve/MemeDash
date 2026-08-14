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

const PUMP_FUN_WS = 'wss://pumpportal.fun/api/data';
const MEMEDASH_API = process.env.MEMEDASH_API || 'http://localhost:3000';

let ws;
let messageCount = 0;
let lastHeartbeat = Date.now();

const config = {
  minLiquidity: 25000,    // $25k minimum
  minVolume: 50000,       // $50k minimum
  maxAge: 3600000,        // 1 hour old max
};

console.log('🚀 Pump.fun Real-Time Scanner Starting...');
console.log(`📊 Connecting to: ${PUMP_FUN_WS}`);
console.log(`📡 Sending tokens to: ${MEMEDASH_API}`);
console.log('');

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
    console.log(`   🔍 Sending to MemeDash for scoring...`);

    // Send to MemeDash for scoring and alerts
    const response = await fetch(`${MEMEDASH_API}/api/scanner/process-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mint,
        symbol,
        name,
        source: 'pump.fun-websocket',
        timestamp: Date.now()
      })
    });

    if (response.ok) {
      const result = await response.json();
      if (result.alerted) {
        console.log(`   ✅ ALERT SENT! Score: ${result.score}/100 (${result.status})`);
      } else {
        console.log(`   📊 Processed. Score: ${result.score}/100 (${result.status})`);
      }
    } else {
      console.log(`   ⚠️  Score check failed: ${response.status}`);
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
