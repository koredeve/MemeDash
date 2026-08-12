/**
 * GET /api/cron/graduation-check
 * Vercel Cron Job - Runs every 30 minutes
 * Checks if any WATCH tokens have upgraded to CLEAN status
 */

const { supabase } = require("../../lib/supabase");

module.exports = async (req, res) => {
  // Verify this is a cron request
  if (req.headers["x-vercel-cron"] !== "true") {
    return res.status(401).json({ error: "Unauthorized - Not a Vercel Cron request" });
  }

  try {
    console.log("[CRON GRADUATION] Checking for watch→clean upgrades...");

    // Get all watched tokens
    const { data: watchlist } = await supabase
      .from("watchlist")
      .select("token_mint, symbol");

    if (!watchlist || watchlist.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No tokens in watchlist",
        graduated: 0,
      });
    }

    let graduated = 0;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = 5824497779;

    // Check each watched token
    for (const watched of watchlist) {
      try {
        // Get current token status
        const { data: tokens } = await supabase
          .from("tokens")
          .select("status, score, liquidity, volume, symbol")
          .eq("mint", watched.token_mint)
          .single();

        if (!tokens) continue;

        // If upgraded to CLEAN, send alert
        if (tokens.status === "clean") {
          graduated++;

          if (botToken) {
            const message = `🎓 **${tokens.symbol} GRADUATED TO CLEAN!**\n\n📊 Score: ${tokens.score}/100\n💰 Liquidity: $${(tokens.liquidity / 1000).toFixed(1)}k\n📈 Volume (24h): $${(tokens.volume / 1000).toFixed(1)}k\n\n✅ Ready to buy!`;

            try {
              await fetch("https://api.telegram.org/bot" + botToken + "/sendMessage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: message,
                  parse_mode: "Markdown",
                }),
              });
              console.log(`[GRADUATION ALERT] ${tokens.symbol} graduated`);

              // Remove from watchlist since it graduated
              await supabase
                .from("watchlist")
                .delete()
                .eq("token_mint", watched.token_mint);
            } catch (err) {
              console.error(`[GRADUATION ERROR] ${tokens.symbol}:`, err.message);
            }
          }
        }
      } catch (err) {
        console.error(`[GRADUATION CHECK ERROR] ${watched.symbol}:`, err.message);
        continue;
      }
    }

    console.log(`[CRON GRADUATION] Completed: ${graduated} tokens graduated`);

    return res.status(200).json({
      success: true,
      graduated,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[CRON GRADUATION ERROR]", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};
