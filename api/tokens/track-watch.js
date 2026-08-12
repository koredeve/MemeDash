/**
 * POST /api/tokens/track-watch
 * Track when a "Watch" token graduates to "Clean"
 * Alerts user when a watched token becomes buyable
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

    // Fetch token from database
    const { data: tokens, error: dbError } = await supabase
      .from("tokens")
      .select("*")
      .eq("mint", tokenAddress)
      .limit(1);

    if (dbError || !tokens || tokens.length === 0) {
      return res.status(404).json({ error: "Token not found" });
    }

    const token = tokens[0];
    const currentStatus = token.status;

    // Check if token is watch or better
    if (currentStatus === "avoid" || currentStatus === "neutral") {
      return res.status(400).json({
        error: "Token must be Watch or Clean status",
        currentStatus,
      });
    }

    // Add to watchlist (no user_id constraint for simplicity)
    const { data: watchlistData, error: watchError } = await supabase
      .from("watchlist")
      .upsert(
        {
          token_mint: tokenAddress,
          added_at: new Date().toISOString(),
          source: "dashboard",
          notes: `Tracked: ${currentStatus} status on ${new Date().toLocaleDateString()}`,
        },
        { onConflict: "token_mint" }
      );

    if (watchError) {
      console.error("Watchlist error:", watchError);
      return res.status(500).json({ error: watchError.message });
    }

    // Send Telegram notification
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = 5824497779;

    if (botToken) {
      const watchedMessage = `📌 *TOKEN TRACKED FOR GRADUATION*

💰 $${symbol || "TOKEN"}
🎯 Current Status: ${currentStatus.toUpperCase()}
📊 Score: ${Math.round(token.score || 0)}/100

━━━━━━━━━━━━━━━━━━━━━━━━
*WATCH CRITERIA*
━━━━━━━━━━━━━━━━━━━━━━━━

✅ Will alert when status improves to: *CLEAN*
✅ Tracking liquid, volume, and holders
✅ Monitoring for deployer activity

━━━━━━━━━━━━━━━━━━━━━━━━

Current Metrics:
💧 Liquidity: $${Math.round(token.liquidity || 0).toLocaleString()}
📈 Volume (24h): $${Math.round(token.volume || 0).toLocaleString()}
🎯 Market Cap: $${(Number(token.market_cap || 0) / 1000000).toFixed(1)}M
🔥 FOMO: ${token.fomo_pressure || 0}%

🔗 [View on DexScreener](https://dexscreener.com/solana/${tokenAddress})

⏰ You'll get alerts if this token graduates to CLEAN status!`;

      await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: watchedMessage,
            parse_mode: "Markdown",
            disable_web_page_preview: false,
          }),
        }
      );
    }

    return res.status(200).json({
      success: true,
      message: `Now tracking $${symbol}`,
      watchedToken: {
        mint: tokenAddress,
        symbol,
        status: currentStatus,
        score: token.score,
      },
    });
  } catch (error) {
    console.error("Track watch error:", error);
    return res.status(500).json({ error: error.message });
  }
};
