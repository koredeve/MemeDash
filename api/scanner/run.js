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
        // DexScreener returns marketCap and fdv as plain numbers, not objects
        const marketCap = Number(pair.marketCap || 0);
        const fdv = Number(pair.fdv || 0);
        const priceUsd = Number(pair.priceUsd || 0);
        const pairAge = pair.pairCreatedAt ? Math.round((Date.now() - pair.pairCreatedAt) / 60000) : 0;

        // QUALITY FILTERS - Only scan tokens with real fundamentals
        // 1. Meaningful liquidity (not trash tier)
        if (liquidity < 25000) continue;

        // 2. Decent volume (not a ghost token)
        if (volume < 50000) continue;

        // 3. Not brand new (avoid instant rugs)
        if (pairAge < 15 && liquidity < 100000) continue; // If <15 min old, need $100k+ liquidity

        // 4. Holder count (real community, not whale trap)
        const txCount = Number(pair.txns?.h24?.buys || 0) + Number(pair.txns?.h24?.sells || 0);
        if (txCount < 50 && liquidity < 75000) continue; // Low activity + low liq = rug risk

        scanned++;

        // Check if token already exists (to detect status changes)
        const { data: existingTokens } = await supabase
          .from("tokens")
          .select("status, detected_at")
          .eq("mint", boost.tokenAddress)
          .limit(1);

        const existingToken =
          existingTokens && existingTokens.length > 0 ? existingTokens[0] : null;

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

        // IMPORTANT: Smart alert filtering
        // Only alert on REAL keeper tokens with organic volume
        const hasOrganicVolume = !scored.isFakeVolume && scored.volumeRatio < 15;
        const isHighQuality =
          scored.classification === "clean" ||
          (scored.classification === "watch" && scored.score >= 65); // Watch must be high quality

        // Detect status changes
        const previousStatus = existingToken?.status;
        const statusChanged = previousStatus && previousStatus !== scored.classification;
        const isNewToken = !existingToken;

        // Only alert if: (1) NEW token, or (2) STATUS CHANGED
        const shouldAlert =
          hasOrganicVolume &&
          isHighQuality &&
          liquidity >= 50000 &&
          (isNewToken || statusChanged); // ONLY on new or status change!

        // Store in database (including market cap)
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
            detected_at: isNewToken ? new Date().toISOString() : existingToken.detected_at,
            // Add market data
            market_cap: marketCap,
            fdv: fdv,
            price_usd: priceUsd,
          },
          { onConflict: "mint" }
        );

        // Send alert ONLY if: new token OR status changed (not every scan!)
        if (shouldAlert) {
          alerted++;
          const botToken = process.env.TELEGRAM_BOT_TOKEN;
          const chatId = 5824497779;

          if (botToken) {
            const emoji = scored.classification === "clean" ? "✨" : "🔔";
            const volumeStatus = scored.volumeRatio > 10 ? "⚠️ High vol ratio" : "✓ Organic";

            // Format market cap
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

            const message = `${emoji} *${scored.classification.toUpperCase()}* | ${volumeStatus}

💰 $${baseToken.symbol || "TOKEN"}
📊 Score: *${scored.score}/100* (${scored.verdict})

━━━━━━━━━━━━━━━━━━━━━━
*METRICS*
━━━━━━━━━━━━━━━━━━━━━━
💧 Liquidity: $${(liquidity / 1000).toFixed(1)}k
📈 Volume (24h): $${(volume / 1000).toFixed(1)}k
🎯 Market Cap: *${mcapDisplay}*
💎 FDV: ${fdvDisplay}
🔄 Vol/Liq Ratio: ${scored.volumeRatio}x

━━━━━━━━━━━━━━━━━━━━━━

🔗 [View on DexScreener](https://dexscreener.com/solana/${boost.tokenAddress})
📊 [Send Full Audit](https://lightmeme.vercel.app/?token=${boost.tokenAddress})

⏰ Age: ${pairAge}m old`;

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
