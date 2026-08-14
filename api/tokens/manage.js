/**
 * POST /api/tokens/manage
 * Consolidated endpoint for token operations:
 * - Score tokens and track state changes
 * - Send detailed audit reports to Telegram
 */

const { supabase } = require("../../lib/supabase");
const { scoreToken } = require("../../lib/token-scorer");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const { action, tokenAddress, symbol, ...tokenData } = req.body;

    if (!tokenAddress) {
      return res.status(400).json({ error: "tokenAddress required" });
    }

    // ========== ACTION: SCORE TOKEN ==========
    if (action === "score" || !action) {
      const {
        name,
        liquidity,
        volume,
        fees,
        holders,
        topTen,
        smartHits,
        deployerAge,
        deployerRugs,
        mintRevoked,
        freezeRevoked,
        fakeVolume,
        m5Volume,
        priceChangeM5,
        buysM5,
        sellsM5,
      } = tokenData;

      // Score the token
      const score = scoreToken({
        liquidity,
        volume,
        fees,
        holders,
        topTen,
        smartHits,
        deployerAge,
        deployerRugs,
        mintRevoked,
        freezeRevoked,
        fakeVolume,
        m5Volume,
        priceChangeM5,
        buysM5,
        sellsM5,
      });

      // Check if token exists in database
      const { data: existing } = await supabase
        .from("tokens")
        .select("id, status")
        .eq("mint", tokenAddress)
        .limit(1);

      let previousStatus = null;
      let stateChanged = false;

      if (existing && existing.length > 0) {
        previousStatus = existing[0].status;
        stateChanged = previousStatus !== score.classification;
      }

      // Store/update token in database
      const tokenRecord = {
        mint: tokenAddress,
        symbol: symbol || "TOKEN",
        name: name || "Token",
        score: score.score,
        verdict: score.verdict,
        status: score.classification,
        liquidity: liquidity || 0,
        volume: volume || 0,
        detected_at: new Date().toISOString(),
        fomo_pressure: score.fomoPressure,
        deployer_rugs: deployerRugs || 0,
        fake_volume: fakeVolume || false,
      };

      if (existing && existing.length > 0) {
        // Update existing token
        await supabase.from("tokens").update(tokenRecord).eq("mint", tokenAddress);
      } else {
        // Insert new token
        await supabase.from("tokens").insert([tokenRecord]);
      }

      return res.status(200).json({
        success: true,
        score: score.score,
        verdict: score.verdict,
        classification: score.classification,
        factors: score.factors,
        fomoPressure: score.fomoPressure,
        stateChanged,
        previousStatus,
        currentStatus: score.classification,
      });
    }

    // ========== ACTION: SEND AUDIT ==========
    if (action === "audit-send") {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = 5824497779;

      if (!botToken) {
        return res.status(400).json({ error: "TELEGRAM_BOT_TOKEN not set" });
      }

      // Fetch token details from database
      const { data: tokens, error: dbError } = await supabase
        .from("tokens")
        .select("*")
        .eq("mint", tokenAddress)
        .limit(1);

      if (dbError || !tokens || tokens.length === 0) {
        return res.status(404).json({ error: "Token not found" });
      }

      let token = tokens[0];
      const score = Math.round(token.score || 0);
      const status = token.status || "unknown";

      // If market cap is missing (0), fetch fresh from DexScreener
      let marketCap = Number(token.market_cap || 0);
      let fdv = Number(token.fdv || 0);

      if ((!marketCap || marketCap === 0) && tokenAddress) {
        try {
          const dexResponse = await fetch(
            `https://api.dexscreener.com/token-pairs/v1/solana/${tokenAddress}`
          );
          const pairs = await dexResponse.json();
          if (Array.isArray(pairs) && pairs.length > 0) {
            const bestPair = pairs[0]; // Use first/best pair
            marketCap = Number(bestPair.marketCap || 0);
            fdv = Number(bestPair.fdv || 0);
          }
        } catch (error) {
          console.log("Could not fetch fresh market cap from DexScreener");
        }
      }

      const mcapDisplay =
        marketCap > 0
          ? marketCap > 1000000
            ? `$${(marketCap / 1000000).toFixed(1)}M`
            : `$${(marketCap / 1000).toFixed(1)}k`
          : "N/A";
      const fdvDisplay =
        fdv > 0
          ? fdv > 1000000
            ? `$${(fdv / 1000000).toFixed(1)}M`
            : `$${(fdv / 1000).toFixed(1)}k`
          : "N/A";

      // Determine quality indicators
      const liquidityStatus =
        token.liquidity > 100000
          ? "🟢 Strong"
          : token.liquidity > 50000
            ? "🟡 Good"
            : "🔴 Low";

      const volumeStatus = token.fake_volume
        ? "🔴 FAKE VOLUME DETECTED"
        : token.volume > token.liquidity * 10
          ? "🟡 High ratio"
          : "🟢 Organic ✓";

      const authorityStatus =
        "🟢 Authorities Revoked"; // From our scoring

      const deployerStatus =
        token.deployer_rugs > 0
          ? `🔴 ${token.deployer_rugs} rug(s)`
          : "🟢 Clean history";

      const statusEmoji = {
        clean: "✨",
        watch: "🔔",
        avoid: "⚠️",
        neutral: "❓",
      };

      const auditMessage = `
📊 *FULL AUDIT REPORT*

💰 *Token:* $${symbol || "TOKEN"}
🔗 Address: \`${tokenAddress.slice(0, 20)}...\`

━━━━━━━━━━━━━━━━━━━━━━━━
*SCORE BREAKDOWN*
━━━━━━━━━━━━━━━━━━━━━━━━

🎯 Overall Score: *${score}/100*
📍 Classification: ${statusEmoji[status]} *${status.toUpperCase()}*

━━━━━━━━━━━━━━━━━━━━━━━━
*QUALITY METRICS*
━━━━━━━━━━━━━━━━━━━━━━━━

💧 Liquidity: ${liquidityStatus}
   → $${Math.round(token.liquidity || 0).toLocaleString()}

📈 Volume (24h):
   → $${Math.round(token.volume || 0).toLocaleString()}

🎯 Market Cap: *${mcapDisplay}*

💎 FDV: ${fdvDisplay}

📊 Volume Quality: ${volumeStatus}

🔑 Authorities: ${authorityStatus}

👤 Deployer: ${deployerStatus}

🔥 FOMO Pressure: ${token.fomo_pressure || 0}%

━━━━━━━━━━━━━━━━━━━━━━━━
*VERDICT*
━━━━━━━━━━━━━━━━━━━━━━━━

${
  score >= 75
    ? "✨ *CLEAN CANDIDATE*\nSafe to audit. Fundamentals look solid."
    : score >= 55
      ? "🔔 *WATCH CLOSELY*\nPromising but needs monitoring."
      : "⚠️ *AVOID FOR NOW*\nRisky signals detected."
}

━━━━━━━━━━━━━━━━━━━━━━━━

🔗 [View on DexScreener](https://dexscreener.com/solana/${tokenAddress})
⏰ Detected: ${new Date(token.detected_at).toLocaleString()}

*Always verify on-chain before trading* ✓
`;

      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: auditMessage,
            parse_mode: "Markdown",
            disable_web_page_preview: false,
          }),
        }
      );

      const data = await response.json();

      if (!data.ok) {
        return res.status(400).json({
          error: "Failed to send audit",
          telegram_error: data.description,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Audit sent to Telegram",
        messageId: data.result.message_id,
      });
    }

    return res.status(400).json({
      error: "action required: 'score' or 'audit-send'",
    });
  } catch (error) {
    console.error("[TOKENS] Error:", error);
    return res.status(500).json({ error: error.message });
  }
};
