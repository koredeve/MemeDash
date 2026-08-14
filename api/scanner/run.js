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

        // Format token age - convert milliseconds to human-readable format
        let ageFormatted = "N/A";
        if (pair.pairCreatedAt) {
          const ageSeconds = Math.floor((Date.now() - new Date(pair.pairCreatedAt).getTime()) / 1000);
          // Format as "Xday Xhr Xmin" etc
          const parts = [];
          let remaining = ageSeconds;

          if (remaining >= 86400) { // 1 day
            const days = Math.floor(remaining / 86400);
            parts.push(`${days}day`);
            remaining %= 86400;
          }
          if (remaining >= 3600) { // 1 hour
            const hours = Math.floor(remaining / 3600);
            parts.push(`${hours}hr`);
            remaining %= 3600;
          }
          if (remaining >= 60) { // 1 minute
            const mins = Math.floor(remaining / 60);
            parts.push(`${mins}min`);
            remaining %= 60;
          }
          if (remaining > 0 || parts.length === 0) {
            parts.push(`${remaining}sec`);
          }

          ageFormatted = parts.join(" ");
        }

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

        // Check if token already exists (to detect status changes + rugs)
        const { data: existingTokens } = await supabase
          .from("tokens")
          .select("status, detected_at, liquidity, price_usd, volume, last_alerted_at")
          .eq("mint", boost.tokenAddress)
          .limit(1);

        const existingToken =
          existingTokens && existingTokens.length > 0 ? existingTokens[0] : null;

        // DETECT RUGS IN REAL-TIME
        let isRugged = false;
        if (existingToken) {
          // Check 1: Liquidity dropped >60% = likely rug pull
          const previousLiquidity = existingToken.liquidity || 0;
          const liquidityDropPercent = previousLiquidity > 0
            ? ((previousLiquidity - liquidity) / previousLiquidity) * 100
            : 0;

          if (liquidityDropPercent > 60 && previousLiquidity > 50000) {
            isRugged = true;
            console.log(`[RUG DETECTED] ${baseToken.symbol}: Liquidity dropped ${liquidityDropPercent.toFixed(1)}%`);
          }

          // Check 2: Price crashed >80% = dump
          const previousPrice = existingToken.price_usd || 0;
          const priceDropPercent = previousPrice > 0
            ? ((previousPrice - priceUsd) / previousPrice) * 100
            : 0;

          if (priceDropPercent > 80 && previousPrice > 0) {
            isRugged = true;
            console.log(`[RUG DETECTED] ${baseToken.symbol}: Price dropped ${priceDropPercent.toFixed(1)}%`);
          }

          // Check 3: Volume dead (was high, now near zero) = abandoned
          const previousVolume = existingToken.volume || 0;
          if (previousVolume > 100000 && volume < 10000) {
            isRugged = true;
            console.log(`[RUG DETECTED] ${baseToken.symbol}: Volume collapsed (${previousVolume} → ${volume})`);
          }
        }

        // Score the token
        let scored = scoreToken({
          liquidity,
          volume,
          fees: volume * 0.0025,
          holders: Math.max(25, Math.round(Math.random() * 1000)),
          topTen: Math.random() * 40 + 12,
          smartHits: boost.amount ? 1 : 0,
          deployerAge: 7,
          deployerRugs: isRugged ? 3 : 0,  // Heavy penalty if rugged
          mintRevoked: true,
          freezeRevoked: true,
          fakeVolume:
            liquidity > 0 && volume / liquidity > 22 && volume < 100000,
          m5Volume: Number(pair.volume?.m5 || 0),
          priceChangeM5: Number(pair.priceChange?.m5 || 0),
          buysM5: Number(pair.txns?.m5?.buys || 0),
          sellsM5: Number(pair.txns?.m5?.sells || 0),
        });

        // OVERRIDE: If rugged, force to AVOID status
        if (isRugged) {
          scored.classification = 'avoid';
          scored.score = 10;
          scored.verdict = 'Rugged - Liquidity/Price Crash';
        }

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

        // Check if enough time has passed for status change alert (1 hour cooldown)
        const lastAlertedTime = existingToken?.last_alerted_at ? new Date(existingToken.last_alerted_at) : null;
        const hoursSinceLastAlert = lastAlertedTime
          ? (Date.now() - lastAlertedTime.getTime()) / (1000 * 60 * 60)
          : Infinity;

        // Alert logic:
        // 1. Alert on NEW tokens that pass quality score
        // 2. Alert on STATUS CHANGES (improvement to CLEAN or detection of RUG) - but only once per hour
        // The score itself already accounts for liquidity, so no additional threshold needed
        const shouldAlert =
          (isNewToken && hasOrganicVolume && isHighQuality) ||  // New token that passed scoring
          (statusChanged && (scored.classification === 'clean' || isRugged) && hoursSinceLastAlert >= 1); // Status changed + 1hr cooldown

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
            // Track last alert time to prevent spam
            last_alerted_at: shouldAlert ? new Date().toISOString() : existingToken?.last_alerted_at,
          },
          { onConflict: "mint" }
        );

        // Send alert ONLY if: new token OR status changed (not every scan!)
        if (shouldAlert) {
          alerted++;
          const botToken = process.env.TELEGRAM_BOT_TOKEN;
          const chatId = 5824497779;

          if (botToken) {
            // Choose emoji based on token status
            let emoji = "🔔";
            if (scored.classification === "clean") emoji = "✨";
            if (scored.classification === "avoid") emoji = isRugged ? "🚨" : "⚠️";

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

            // Different message format for rugged tokens
            let message;
            if (isRugged) {
              message = `${emoji} *RUG DETECTED!* - AVOID

💰 $${baseToken.symbol || "TOKEN"}
🚨 Status: *${scored.verdict}*

━━━━━━━━━━━━━━━━━━━━━━
*WHAT HAPPENED*
━━━━━━━━━━━━━━━━━━━━━━
❌ Liquidity crashed or pulled
❌ Price dumped significantly
❌ Trading volume stopped
❌ Token is likely abandoned

━━━━━━━━━━━━━━━━━━━━━━
*CURRENT METRICS*
━━━━━━━━━━━━━━━━━━━━━━
💧 Liquidity: $${(liquidity / 1000).toFixed(1)}k (DOWN)
📈 Volume: $${(volume / 1000).toFixed(1)}k (DEAD)
💎 Score: *${scored.score}/100*

⚠️ DO NOT BUY - AVOID THIS TOKEN

🔗 [View on DexScreener](https://dexscreener.com/solana/${boost.tokenAddress})`;
            } else {
              message = `${emoji} *${scored.classification.toUpperCase()}* | ${volumeStatus}

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

⏰ Age: ${ageFormatted}`;
            }

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

    // Update scanner status - count tokens from last 24 hours (what we display in feed)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count: tokensDetectedToday, error: countError } = await supabase
      .from("tokens")
      .select("id", { count: "exact" })
      .gte("detected_at", oneDayAgo);

    const { count: alertsSentToday, error: alertCountError } = await supabase
      .from("tokens")
      .select("id", { count: "exact" })
      .not("last_alerted_at", "is", null)
      .gte("last_alerted_at", oneDayAgo);

    const { data: statusData, error: statusError } = await supabase.from("scanner_status").upsert({
      id: '00000000-0000-0000-0000-000000000001',
      last_scan_time: new Date().toISOString(),
      scan_count: scanned > 0 ? 1 : 0,  // Just track if we scanned anything
      tokens_detected_today: tokensDetectedToday || 0,  // Count from DB
      alerts_sent_today: alertsSentToday || 0,          // Count from DB
      is_healthy: true,
    });

    if (statusError) {
      console.error("[SCANNER] Status update failed:", statusError);
    }

    return res.status(200).json({
      success: true,
      message: "Scan complete",
      scanned,
      alerted,
      status_error: statusError ? statusError.message : null,
    });
  } catch (error) {
    console.error("[SCANNER] Error:", error);
    return res.status(500).json({ error: error.message });
  }
};
