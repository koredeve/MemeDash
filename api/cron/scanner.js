/**
 * Vercel Cron: Cloud-Based Memecoin Scanner
 * Runs every minute automatically
 * Fetches new tokens from DexScreener
 * Scores them and sends alerts
 *
 * Configuration in vercel.json:
 * "crons": [{ "path": "/api/cron/scanner", "schedule": "* * * * *" }]
 */

const { supabase } = require('../../lib/supabase');
const { scoreToken, fetchNewTokens, formatAlertMessage } = require('../../lib/dexscreener');

// Track seen tokens in memory (persists across invocations in same instance)
let seenTokens = new Set();

/**
 * Send alert via Telegram
 */
async function sendTelegramAlert(telegramId, msg) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('[TELEGRAM] No bot token provided');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramId,
        text: msg,
        parse_mode: 'Markdown'
      })
    });

    if (response.ok) {
      console.log(`[TELEGRAM] Alert sent to ${telegramId}`);
      return true;
    } else {
      console.error(`[TELEGRAM] Failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`[TELEGRAM] Error: ${error.message}`);
    return false;
  }
}

/**
 * Store token in Supabase
 */
async function storeToken(pair, score, confidence, patterns) {
  try {
    const baseToken = pair.baseToken || {};
    const { error } = await supabase
      .from('tokens')
      .upsert(
        {
          mint: baseToken.address,
          name: baseToken.name,
          symbol: baseToken.symbol,
          score: score,
          liquidity: parseFloat(pair.liquidity?.usd) || 0,
          volume_5m: parseFloat(pair.volume?.m5) || 0,
          volume_24h: parseFloat(pair.volume?.h24) || 0,
          fdv: parseFloat(pair.fdv) || 0,
          age_minutes: 1,
          fomo_score: score,
          detected_at: new Date().toISOString(),
          last_updated: new Date().toISOString()
        },
        { onConflict: 'mint' }
      );

    if (error) {
      console.error(`[DB] Store error: ${error.message}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[DB] Error: ${error.message}`);
    return false;
  }
}

/**
 * Check alert rules and send alerts to all matching users
 */
async function checkAndSendAlerts(pair, score, confidence, patterns) {
  if (score < 70) return;

  try {
    const { data: users } = await supabase
      .from('users')
      .select('*');

    if (!users || users.length === 0) return;

    for (const user of users) {
      const { data: rules } = await supabase
        .from('alert_rules')
        .select('*')
        .eq('user_id', user.id)
        .eq('enabled', true);

      if (!rules) continue;

      for (const rule of rules) {
        const liquidity = parseFloat(pair.liquidity?.usd) || 0;
        const meetsScore = score >= (rule.min_score || 70);
        const meetsLiquidity = liquidity >= (rule.min_liquidity || 50000);

        if (meetsScore && meetsLiquidity && user.telegram_id) {
          const msg = formatAlertMessage(pair, score, confidence, patterns);
          await sendTelegramAlert(user.telegram_id, msg);

          await supabase.from('alert_history').insert({
            user_id: user.id,
            token_mint: pair.baseToken?.address,
            token_name: pair.baseToken?.name,
            token_symbol: pair.baseToken?.symbol,
            score: score,
            liquidity: liquidity,
            alert_type: 'score_match',
            channels_sent: ['telegram'],
            sent_at: new Date().toISOString()
          });
        }
      }
    }
  } catch (error) {
    console.error(`[ALERTS] Error: ${error.message}`);
  }
}

/**
 * Update scanner status
 */
async function updateScannerStatus(tokensDetected, alertsSent) {
  try {
    await supabase
      .from('scanner_status')
      .upsert(
        {
          id: 1,
          last_scan_time: new Date().toISOString(),
          tokens_detected_today: tokensDetected,
          alerts_sent_today: alertsSent,
          is_healthy: true,
          error_message: null,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      );
  } catch (error) {
    console.error(`[STATUS] Error: ${error.message}`);
  }
}

/**
 * Main cron handler
 */
module.exports = async (req, res) => {
  // Vercel cron requests come from internal services
  console.log('\n' + '='.repeat(70));
  console.log('[SCANNER] Cloud Scanner Cron Executing...');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  try {
    console.log('[SCANNER] Fetching tokens from DexScreener...');
    const tokens = await fetchNewTokens(seenTokens);
    console.log(`[SCANNER] Found ${tokens.length} new tokens`);

    let tokensStored = 0;
    let alertsSent = 0;

    for (const token of tokens.slice(0, 10)) {
      const baseToken = token.baseToken || {};
      const { score, confidence, patterns } = scoreToken(token);

      console.log(`[TOKEN] ${baseToken.symbol}: Score ${score}/100`);

      if (await storeToken(token, score, confidence, patterns)) {
        tokensStored++;
      }

      if (score >= 70) {
        await checkAndSendAlerts(token, score, confidence, patterns);
        alertsSent++;
      }
    }

    await updateScannerStatus(tokensStored, alertsSent);

    console.log(`[SCANNER] Complete: Stored ${tokensStored}, Alerts ${alertsSent}`);
    console.log('='.repeat(70) + '\n');

    res.status(200).json({
      success: true,
      tokensFound: tokens.length,
      tokensStored,
      alertsSent,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[SCANNER] Fatal error: ${error.message}`);

    try {
      await supabase
        .from('scanner_status')
        .upsert(
          {
            id: 1,
            is_healthy: false,
            error_message: error.message,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'id' }
        );
    } catch (dbError) {
      console.error(`[STATUS] Failed to update error: ${dbError.message}`);
    }

    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
