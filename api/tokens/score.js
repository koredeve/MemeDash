/**
 * POST /api/tokens/score
 * Score a token and track state changes
 * Returns score, verdict, and state change (if any) for Telegram alerts
 */

const { supabase } = require("../../lib/supabase");
const { scoreToken } = require("../../lib/token-scorer");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const {
      tokenAddress,
      symbol,
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
    } = req.body;

    if (!tokenAddress) {
      return res.status(400).json({ error: "tokenAddress required" });
    }

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
  } catch (error) {
    console.error("Score error:", error);
    return res.status(500).json({ error: error.message });
  }
};
