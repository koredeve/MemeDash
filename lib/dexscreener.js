/**
 * DexScreener Scanner
 * Fetches new Solana tokens and scores them
 * Converts Python scanner logic to JavaScript
 */

// Use native fetch (Node 18+) or fallback to node-fetch
const fetch = globalThis.fetch || require('node-fetch');

const SKIP_TOKENS = new Set([
  'SOL', 'USDC', 'USDT', 'WSOL', 'USDC.e',
  'Solana', 'Wrapped SOL', 'USD Coin', 'Tether USD'
]);

/**
 * Score token based on metrics
 * VOLUME IS A HARD REQUIREMENT: < $50k = score 0
 * Base: 50, Volume: +15, Liquidity: +10, FDV: +10 = Max 100
 */
function scoreToken(pair) {
  const patterns = [];
  const baseToken = pair.baseToken || {};

  // HARD REQUIREMENT: Volume (5m) > $50k
  const vol5m = parseFloat(pair.volume?.m5) || 0;

  if (vol5m < 50000) {
    patterns.push(`✗ REJECTED: Low Volume ($${vol5m.toLocaleString('en-US', { maximumFractionDigits: 0 })})`);
    return { score: 0, confidence: 0, patterns };
  }

  // Volume passed - start scoring
  let score = 50;
  let confidence = 0;

  // Volume bonus (we know vol > $50k)
  score += 15;
  confidence += 0.68 * 0.35;
  patterns.push(`✓ Early Volume ($${vol5m.toLocaleString('en-US', { maximumFractionDigits: 0 })})`);

  // Liquidity check (> $50k is good)
  const liquidity = parseFloat(pair.liquidity?.usd) || 0;
  if (liquidity > 50000) {
    score += 10;
    confidence += 0.60 * 0.30;
    patterns.push(`✓ Good Liquidity ($${liquidity.toLocaleString('en-US', { maximumFractionDigits: 0 })})`);
  } else {
    patterns.push(`✗ Low Liquidity ($${liquidity.toLocaleString('en-US', { maximumFractionDigits: 0 })})`);
  }

  // FDV check (reasonable range: $100k to $100M)
  const fdv = parseFloat(pair.fdv) || 0;
  if (fdv > 100000 && fdv < 100000000) {
    score += 10;
    confidence += 0.65 * 0.35;
    patterns.push(`✓ Reasonable FDV ($${fdv.toLocaleString('en-US', { maximumFractionDigits: 0 })})`);
  } else {
    patterns.push(`✗ FDV ($${fdv.toLocaleString('en-US', { maximumFractionDigits: 0 })})`);
  }

  confidence = Math.min(confidence, score / 100);
  return {
    score: Math.min(score, 100),
    confidence: Math.round(confidence * 100),
    patterns
  };
}

/**
 * Fetch new tokens from DexScreener
 * Returns array of token pairs
 */
async function fetchNewTokens(seenTokens = new Set()) {
  try {
    const url = "https://api.dexscreener.com/latest/dex/search?q=SOL&chainId=solana&limit=100";
    const response = await fetch(url, { timeout: 10000 });

    if (response.status !== 200) {
      console.error(`[FETCH] DexScreener returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    const pairs = data.pairs || [];

    const newTokens = [];
    for (const pair of pairs) {
      const mint = pair.baseToken?.address;
      const symbol = pair.baseToken?.symbol || '';
      const name = pair.baseToken?.name || '';

      // Skip known tokens
      if (SKIP_TOKENS.has(symbol) || SKIP_TOKENS.has(name)) {
        continue;
      }

      // Skip if already seen
      if (mint && !seenTokens.has(mint)) {
        seenTokens.add(mint);
        newTokens.push(pair);
      }
    }

    return newTokens;
  } catch (error) {
    console.error(`[FETCH] Error: ${error.message}`);
    return [];
  }
}

/**
 * Format alert message for Telegram
 */
function formatAlertMessage(pair, score, confidence, patterns) {
  const baseToken = pair.baseToken || {};
  const vol5m = parseFloat(pair.volume?.m5) || 0;
  const liquidity = parseFloat(pair.liquidity?.usd) || 0;
  const fdv = parseFloat(pair.fdv) || 0;
  const price = parseFloat(pair.priceUsd) || 0;

  let msg = `🚀 NEW TOKEN DETECTED - REAL-TIME\n\n`;
  msg += `📋 Token: *${baseToken.symbol}* (${baseToken.name})\n`;
  msg += `Contract: \`${baseToken.address?.substring(0, 16)}...\`\n\n`;
  msg += `🎯 Score: *${score}/100*\n`;
  msg += `Confidence: ${confidence}%\n\n`;
  msg += `✅ Patterns:\n`;
  patterns.forEach(p => {
    msg += `  ${p}\n`;
  });
  msg += `\n💰 Metrics:\n`;
  msg += `• Volume (5m): $${vol5m.toLocaleString('en-US', { maximumFractionDigits: 0 })}\n`;
  msg += `• Liquidity: $${liquidity.toLocaleString('en-US', { maximumFractionDigits: 0 })}\n`;
  msg += `• FDV: $${fdv.toLocaleString('en-US', { maximumFractionDigits: 0 })}\n`;
  msg += `• Price: $${price}\n\n`;
  msg += `⚠️ Do your own research`;

  return msg;
}

module.exports = {
  scoreToken,
  fetchNewTokens,
  formatAlertMessage,
  SKIP_TOKENS
};
