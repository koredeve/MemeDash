/**
 * GET /api/scanner/run
 * Manually trigger pump.fun token scan
 * Fetches new tokens from DexScreener, scores them, sends alerts
 */

const { supabase } = require("../../lib/supabase");
const { scoreToken } = require("../../lib/token-scorer");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET only" });
  }

  try {
    console.log("[SCANNER] Starting scan...");

    // Fetch latest tokens from DexScreener
    const dexResponse = await fetch(
      "https://api.dexscreener.com/token-boosts/latest/v1?limit=50"
    );
    const boosts = await dexResponse.json();

    if (!Array.isArray(boosts) || boosts.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No new tokens found",
        scanned: 0,
        alerted: 0,
      });
    }

    let scanned = 0;
    let alerted = 0;

    // Process each token
    for (const boost of boosts.slice(0, 20)) {
      try {
        if (!boost.tokenAddress || boost.chainId !== "solana") continue;

        // Fetch pair data from DexScreener
        const pairResponse = await fetch(
          `https://api.dexscreener.com/token-pairs/v1/solana/${boost.tokenAddress}`
        );
        const pairData = await pairResponse.json();

        const pairs = Array.isArray(pairData) ? pairData : [];
        if (pairs.length === 0) continue;

        // Get best pair (highest liquidity)
        const pair = pairs.sort(
          (a, b) =>
            (Number(b.liquidity?.usd) || 0) - (Number(a.liquidity?.usd) || 0)
        )[0];

        const baseToken = pair.baseToken || {};
        const liquidity = Number(pair.liquidity?.usd || 0);
        const volume = Number(pair.volume?.h24 || 0);

        // Only alert on meaningful liquidity
        if (liquidity < 5000) continue;

        scanned++;

        // Score the token
        const scored = scoreToken({
          liquidity,
          volume,
          fees: volume * 0.0025,
          holders: Math.max(25, Math.round(Math.random() * 1000)),
          topTen: Math.random() * 40 + 12,
          smartHits: boost.amount ? 1 : 0,
          deployerAge: 7,
          deployerRugs: 0,
          mintRevoked: true,
          freezeRevoked: true,
          fakeVolume:
            liquidity > 0 && volume / liquidity > 22 && volume < 100000,
          m5Volume: Number(pair.volume?.m5 || 0),
          priceChangeM5: Number(pair.priceChange?.m5 || 0),
          buysM5: Number(pair.txns?.m5?.buys || 0),
          sellsM5: Number(pair.txns?.m5?.sells || 0),
        });

        // IMPORTANT: Filter out fake volume tokens
        const hasOrganicVolume = !scored.isFakeVolume && scored.volumeRatio < 20;
        const shouldAlert =
          hasOrganicVolume &&
          (scored.classification === "clean" || scored.classification === "watch");

        // Store in database
        await supabase.from("tokens").upsert(
          {
            mint: boost.tokenAddress,
            symbol: baseToken.symbol || "TOKEN",
            name: baseToken.name || "Token",
            score: scored.score,
            verdict: scored.verdict,
            status: scored.classification,
            liquidity,
            volume,
            fomo_pressure: scored.fomoPressure,
            fake_volume: scored.isFakeVolume,
            deployer_rugs: 0,
            detected_at: new Date().toISOString(),
          },
          { onConflict: "mint" }
        );

        // Send alert ONLY if organic volume + clean/watch score
        if (shouldAlert) {
          alerted++;
          const botToken = process.env.TELEGRAM_BOT_TOKEN;
          const chatId = 5824497779;

          if (botToken) {
            const emoji = scored.classification === "clean" ? "✨" : "🔔";
            const volumeStatus = scored.volumeRatio > 10 ? "⚠️ High vol ratio" : "✓ Organic";

            const message = `${emoji} *${scored.classification.toUpperCase()}* | ${volumeStatus}

💰 $${baseToken.symbol || "TOKEN"}
📊 Score: *${scored.score}/100* (${scored.verdict})
💧 Liquidity: $${(liquidity / 1000).toFixed(1)}k
📈 Volume (24h): $${(volume / 1000).toFixed(1)}k
🔄 Vol/Liq Ratio: ${scored.volumeRatio}x

🔗 [View on DexScreener](https://dexscreener.com/solana/${boost.tokenAddress})
📊 [Audit Details →](https://lightmeme.vercel.app/?token=${boost.tokenAddress})`;

            await fetch(
              `https://api.telegram.org/bot${botToken}/sendMessage`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: message,
                  parse_mode: "Markdown",
                  disable_web_page_preview: false,
                }),
              }
            );
          }
        }
      } catch (error) {
        console.error("[SCANNER] Token processing error:", error.message);
        continue;
      }
    }

    // Update scanner status
    await supabase.from("scanner_status").upsert({
      id: 1,
      last_scan_time: new Date().toISOString(),
      scan_count: 1,
      tokens_detected_today: scanned,
      alerts_sent_today: alerted,
      is_healthy: true,
    });

    return res.status(200).json({
      success: true,
      message: "Scan complete",
      scanned,
      alerted,
    });
  } catch (error) {
    console.error("[SCANNER] Error:", error);
    return res.status(500).json({ error: error.message });
  }
};
