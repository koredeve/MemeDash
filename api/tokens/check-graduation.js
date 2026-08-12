/**
 * GET /api/tokens/check-graduation
 * Check if any watched tokens have graduated from Watch → Clean
 * Send alerts for tokens ready to enter
 */

const { supabase } = require("../../lib/supabase");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET only" });
  }

  try {
    // Get all watched tokens
    const { data: watchlist, error: watchError } = await supabase
      .from("watchlist")
      .select("token_mint");

    if (watchError || !watchlist) {
      return res.status(200).json({ success: true, graduated: 0 });
    }

    const watchedMints = watchlist.map((w) => w.token_mint);
    if (watchedMints.length === 0) {
      return res
        .status(200)
        .json({ success: true, message: "No watched tokens", graduated: 0 });
    }

    // Check status of all watched tokens
    const { data: tokens, error: tokenError } = await supabase
      .from("tokens")
      .select("mint, symbol, score, status, liquidity, volume, market_cap, fomo_pressure")
      .in("mint", watchedMints);

    if (tokenError) {
      return res.status(500).json({ error: tokenError.message });
    }

    let graduatedCount = 0;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = 5824497779;

    // Check each token for graduation (Watch → Clean)
    for (const token of tokens || []) {
      if (token.status === "clean") {
        graduatedCount++;

        // Send graduation alert
        if (botToken) {
          const graduationMessage = `🎓 *TOKEN GRADUATED TO CLEAN!*

💰 $${token.symbol}
🟢 Status: *CLEAN* ← Ready to enter!
📊 Score: *${Math.round(token.score)}/100*

━━━━━━━━━━━━━━━━━━━━━━━━
*ENTRY METRICS*
━━━━━━━━━━━━━━━━━━━━━━━━

💧 Liquidity: $${(token.liquidity / 1000).toFixed(1)}k ✅
📈 Volume (24h): $${(token.volume / 1000).toFixed(1)}k
🎯 Market Cap: $${(token.market_cap / 1000000).toFixed(1)}M
🔥 FOMO Pressure: ${token.fomo_pressure}% ${
            token.fomo_pressure > 70
              ? "⚠️ FOMO HIGH"
              : "✅ STABLE"
          }

━━━━━━━━━━━━━━━━━━━━━━━━
*WHAT THIS MEANS*
━━━━━━━━━━━━━━━━━━━━━━━━

✅ Token passed ALL quality checks
✅ Organic volume confirmed
✅ Authorities revoked (safe from rugs)
✅ Deployer has clean history
✅ Good holder distribution

🎯 *THIS IS A GOOD ENTRY POINT*

⚠️ Still verify on-chain before buying
🔗 [View DexScreener](https://dexscreener.com/solana/${token.mint})
📊 [Full Audit](https://lightmeme.vercel.app/?token=${token.mint})

Congratulations! 🚀`;

          await fetch(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: graduationMessage,
                parse_mode: "Markdown",
                disable_web_page_preview: false,
              }),
            }
          );
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Checked ${tokens.length} watched tokens`,
      graduated: graduatedCount,
      graduatedTokens: tokens.filter((t) => t.status === "clean").map((t) => ({
        symbol: t.symbol,
        score: t.score,
      })),
    });
  } catch (error) {
    console.error("Check graduation error:", error);
    return res.status(500).json({ error: error.message });
  }
};
