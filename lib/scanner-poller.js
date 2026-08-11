const fetch = require('node-fetch');
const { supabase } = require('./supabase');

const SCANNER_API_URL = process.env.SCANNER_API_URL || 'http://localhost:3001';
const POLL_INTERVAL = parseInt(process.env.SCANNER_POLL_INTERVAL) || 30;

/**
 * Poll the local memecoin scanner for new tokens
 */
async function pollScanner() {
  try {
    // Fetch latest tokens from scanner
    const response = await fetch(`${SCANNER_API_URL}/latest-tokens`, { timeout: 10000 });

    if (!response.ok) {
      throw new Error(`Scanner API returned ${response.status}`);
    }

    const data = await response.json();
    const tokens = data.tokens || [];

    // Cache tokens in database
    for (const token of tokens) {
      const { error } = await supabase
        .from('tokens')
        .upsert({
          mint: token.mint,
          name: token.name,
          symbol: token.symbol,
          score: token.score,
          liquidity: token.liquidity,
          volume_5m: token.volume_5m,
          volume_24h: token.volume_24h,
          fdv: token.fdv,
          age_minutes: token.age_minutes,
          fomo_score: token.fomo_score,
          detected_at: token.detected_at,
          last_updated: new Date().toISOString()
        }, { onConflict: 'mint' });

      if (error) console.error(`Error caching token ${token.mint}:`, error);
    }

    // Update scanner status
    await updateScannerStatus(tokens.length);

    return tokens;
  } catch (error) {
    console.error('Scanner poll error:', error);
    await updateScannerStatus(0, error.message);
    throw error;
  }
}

/**
 * Update scanner health status
 */
async function updateScannerStatus(tokenCount, errorMsg = null) {
  const { error } = await supabase
    .from('scanner_status')
    .upsert({
      id: '00000000-0000-0000-0000-000000000001', // Fixed ID for singleton
      last_scan_time: new Date().toISOString(),
      scan_count: (await supabase.from('scanner_status').select('scan_count').single())?.data?.scan_count || 0 + 1,
      tokens_detected_today: tokenCount,
      is_healthy: !errorMsg,
      error_message: errorMsg,
      updated_at: new Date().toISOString()
    });

  if (error) console.error('Error updating scanner status:', error);
}

/**
 * Evaluate if a token should trigger alerts
 */
async function evaluateToken(token, userId) {
  // Get user's alert rules
  const { data: rules } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!rules || !rules.enabled) return false;

  // Check if score meets threshold
  if (token.score < rules.min_score) return false;

  // Check if liquidity meets threshold
  if (token.liquidity < rules.min_liquidity) return false;

  // Check if token age is within limit
  if (token.age_minutes > rules.max_age_minutes) return false;

  return true;
}

/**
 * Send alert to user
 */
async function sendAlert(userId, token, channels = ['telegram']) {
  try {
    // Log alert in history
    const { error } = await supabase
      .from('alert_history')
      .insert({
        user_id: userId,
        token_mint: token.mint,
        token_name: token.name,
        token_symbol: token.symbol,
        score: token.score,
        liquidity: token.liquidity,
        alert_type: 'rule_match',
        channels_sent: channels
      });

    if (error) throw error;

    // Send via selected channels
    if (channels.includes('telegram')) {
      // Will be called by telegram endpoint
      await sendTelegramAlert(userId, token);
    }

    return true;
  } catch (error) {
    console.error('Error sending alert:', error);
    return false;
  }
}

/**
 * Send Telegram alert
 */
async function sendTelegramAlert(userId, token) {
  // Get user's Telegram ID
  const { data: user } = await supabase
    .from('users')
    .select('telegram_id')
    .eq('id', userId)
    .single();

  if (!user?.telegram_id) return false;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = user.telegram_id;

  const message = `
🚀 NEW WATCH CANDIDATE

$${token.symbol}
Score: ${token.score}/100
Liquidity: $${(token.liquidity / 1000).toFixed(1)}k
Age: ${token.age_minutes}m
FOMO: ${token.fomo_score}/100

Why:
- Fresh pair
- Strong volume
- Rising pressure

Links:
🔗 Dexscreener | Pump.fun
  `;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Telegram send error:', error);
    return false;
  }
}

module.exports = {
  pollScanner,
  evaluateToken,
  sendAlert,
  sendTelegramAlert,
  updateScannerStatus
};
