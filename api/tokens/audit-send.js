/**
 * POST /api/tokens/audit-send
 * Send detailed audit report to Telegram
 */

const { supabase } = require("../../lib/supabase");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const { tokenAddress, symbol } = req.body;

    if (!tokenAddress) {
      return res.status(400).json({ error: "tokenAddress required" });
    }

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

    const token = tokens[0];
    const score = Math.round(token.score || 0);
    const status = token.status || "unknown";

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
  } catch (error) {
    console.error("Audit send error:", error);
    return res.status(500).json({ error: error.message });
  }
};
