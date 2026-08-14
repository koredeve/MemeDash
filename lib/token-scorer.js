/**
 * Token Scoring Engine
 * Ports the excellent audit logic from the original dashboard
 * Used by both backend scanner and frontend display
 */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function fomoPressure(pair) {
  const m5Volume = Number(pair.m5Volume || 0);
  const change = Number(pair.priceChangeM5 || 0);
  const buys = Number(pair.buysM5 || 0);
  const sells = Number(pair.sellsM5 || 0);
  const buyPressure = buys + sells ? buys / (buys + sells) : 0.5;
  const raw =
    35 +
    Math.min(28, m5Volume / 650) +
    Math.max(-18, Math.min(24, change * 2)) +
    (buyPressure - 0.5) * 42;
  return clamp(Math.round(raw), 0, 100);
}

function buildFactors(data) {
  const feeRatio = data.fees / Math.max(data.volume, 1);
  const volumeRatio = data.liquidity > 0 ? data.volume / data.liquidity : 0;

  // ===== NEW: LIQUIDITY-TO-MARKETCAP RATIO CHECK =====
  // Flags tokens that look valuable but have TRAPPED liquidity (classic rug setup)
  // Healthy tokens: Market Cap / Liquidity should be 5-20x
  // Dangerous: >40x means 98% of value is illiquid
  const marketCapRatio = data.marketCap > 0 && data.liquidity > 0
    ? data.marketCap / data.liquidity
    : 0;

  const fdvRatio = data.fdv > 0 && data.liquidity > 0
    ? data.fdv / data.liquidity
    : 0;

  // RUGPULL detection: extreme liquidity mismatch
  const isLiquidityTrap =
    (marketCapRatio > 50 && data.marketCap > 1000000) || // $1M+ cap with <2% liquidity
    (fdvRatio > 100 && data.fdv > 2000000);              // $2M+ FDV with <1% liquidity

  // FAKE VOLUME DETECTION (Critical)
  // Flag if: volume/liquidity > 22 (extreme) OR fee ratio suspicious OR bundled purchases
  const isFakeVolume = data.fakeVolume ||
    (volumeRatio > 22 && data.volume < 100000) ||
    (feeRatio < 0.0008 && data.volume > 50000) ||
    (data.bundled > 35);

  const concentrationPenalty = data.topTen > 32 ? 18 : data.topTen > 24 ? 9 : 0;
  const fakePenalty = isFakeVolume ? 28 : 0; // INCREASED PENALTY
  const liquidityTrapPenalty = isLiquidityTrap ? 35 : 0; // SEVERE PENALTY for trapped liquidity
  const authorityPenalty = data.mintRevoked ? 0 : 12;
  const freezePenalty = data.freezeRevoked ? 0 : 8;
  const deployerPenalty =
    data.deployerRugs * 11 + (data.deployerAge < 5 ? 8 : 0);
  const smartBonus = Math.min(14, data.smartHits * 5);
  const liquidityScore = clamp(Math.round(data.liquidity / 350), 0, 18);
  const holderScore = clamp(Math.round(data.holders / 35), 0, 14);
  const feeQualityBonus =
    feeRatio > 0.0018 && feeRatio < 0.009
      ? 12
      : feeRatio <= 0.0012
        ? -12
        : 4;

  const score = clamp(
    50 +
      liquidityScore +
      holderScore +
      smartBonus +
      feeQualityBonus -
      concentrationPenalty -
      fakePenalty -
      liquidityTrapPenalty -
      authorityPenalty -
      freezePenalty -
      deployerPenalty,
    8,
    96
  );

  // Determine volume quality (for display)
  let volumeQuality = "Organic ✓";
  if (isFakeVolume) {
    volumeQuality = "⚠️ FAKE VOLUME DETECTED";
  } else if (volumeRatio > 15) {
    volumeQuality = "⚠️ High volume ratio";
  } else if (feeRatio < 0.001) {
    volumeQuality = "⚠️ Suspiciously low fees";
  }

  return {
    score,
    isFakeVolume,
    isLiquidityTrap,
    volumeRatio: Math.round(volumeRatio * 100) / 100,
    feeRatio: Math.round(feeRatio * 10000) / 10000,
    marketCapRatio: Math.round(marketCapRatio * 100) / 100,
    fdvRatio: Math.round(fdvRatio * 100) / 100,
    factors: [
      {
        name: "Liquidity",
        score: clamp(45 + liquidityScore * 3, 0, 100),
        note: `$${Math.round(data.liquidity)}k available`,
      },
      {
        name: "Authorities",
        score:
          data.mintRevoked && data.freezeRevoked
            ? 88
            : data.mintRevoked
              ? 64
              : 32,
        note:
          data.mintRevoked && data.freezeRevoked
            ? "Revoked"
            : "Active controls",
      },
      {
        name: "Holder spread",
        score: clamp(100 - data.topTen * 2, 5, 95),
        note: `Top 10: ${data.topTen}%`,
      },
      {
        name: "Volume quality",
        score: isFakeVolume ? 15 : clamp(Math.round(feeRatio * 16000), 35, 92),
        note: volumeQuality,
      },
      {
        name: "Deployer",
        score: clamp(
          86 - data.deployerRugs * 24 - (data.deployerAge < 5 ? 14 : 0),
          5,
          92
        ),
        note: `${data.deployerRugs} rugs`,
      },
      {
        name: "Smart money",
        score: clamp(45 + data.smartHits * 14, 20, 96),
        note: `${data.smartHits} hits`,
      },
      {
        name: "Liquidity Health",
        score: isLiquidityTrap ? 5 : clamp(95 - (marketCapRatio / 5), 20, 95),
        note: isLiquidityTrap
          ? `TRAP: Mcap/Liq ${marketCapRatio}x`
          : `Mcap/Liq: ${marketCapRatio}x (healthy: 5-20x)`,
      },
    ],
  };
}

function verdictFor(score, fakeVolume, deployerRugs, isLiquidityTrap) {
  if (isLiquidityTrap) return "Liquidity Trap";
  if (score >= 78 && !fakeVolume && deployerRugs === 0) return "Clean";
  if (score >= 62) return "Watch";
  if (fakeVolume) return "Fake volume";
  if (deployerRugs > 0) return "Risky";
  return "Avoid";
}

function classifyToken(token) {
  // RED FLAGS: Immediate avoid
  if (token.isLiquidityTrap) return "avoid";
  if (token.fakeVolume) return "avoid";
  if (token.deployerRugs >= 1) return "avoid";  // Even 1 rug is bad
  if (token.score < 45) return "avoid";

  // CLEAN: Only high-quality tokens
  if (token.score >= 75 && !token.fakeVolume && token.deployerRugs === 0)
    return "clean";

  // WATCH: Mid-tier tokens with smart money backing
  if (token.score >= 55 && token.smartHits > 0)
    return "watch";

  // Anything else falls to avoid (no middle ground for unvetted tokens)
  return "avoid";
}

/**
 * Main scoring function
 * Takes token data and returns score + verdict + factors
 */
function scoreToken(tokenData) {
  const data = {
    liquidity: Number(tokenData.liquidity || 0),
    volume: Number(tokenData.volume || 0),
    fees: Number(tokenData.fees || 0),
    holders: Number(tokenData.holders || 25),
    topTen: Number(tokenData.topTen || 30),
    smartHits: Number(tokenData.smartHits || 0),
    deployerAge: Number(tokenData.deployerAge || 0),
    deployerRugs: Number(tokenData.deployerRugs || 0),
    mintRevoked: tokenData.mintRevoked !== false,
    freezeRevoked: tokenData.freezeRevoked !== false,
    fakeVolume: tokenData.fakeVolume || false,
    bundled: Number(tokenData.bundled || 0),
    m5Volume: Number(tokenData.m5Volume || 0),
    priceChangeM5: Number(tokenData.priceChangeM5 || 0),
    buysM5: Number(tokenData.buysM5 || 0),
    sellsM5: Number(tokenData.sellsM5 || 0),
    marketCap: Number(tokenData.marketCap || 0),
    fdv: Number(tokenData.fdv || 0),
  };

  data.fomoPressure = fomoPressure(data);
  const result = buildFactors(data);

  return {
    score: result.score,
    verdict: verdictFor(result.score, result.isFakeVolume, data.deployerRugs, result.isLiquidityTrap),
    classification: classifyToken({ ...data, score: result.score, isLiquidityTrap: result.isLiquidityTrap }),
    factors: result.factors,
    fomoPressure: data.fomoPressure,
    isFakeVolume: result.isFakeVolume,
    isLiquidityTrap: result.isLiquidityTrap,
    volumeRatio: result.volumeRatio,
    feeRatio: result.feeRatio,
  };
}

module.exports = { scoreToken, verdictFor, classifyToken, buildFactors };
