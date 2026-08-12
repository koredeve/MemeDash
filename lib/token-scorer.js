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
  const concentrationPenalty = data.topTen > 32 ? 18 : data.topTen > 24 ? 9 : 0;
  const fakePenalty = data.fakeVolume ? 22 : 0;
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
      authorityPenalty -
      freezePenalty -
      deployerPenalty,
    8,
    96
  );

  return {
    score,
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
        score: data.fakeVolume
          ? 24
          : clamp(Math.round(feeRatio * 16000), 35, 92),
        note: data.fakeVolume ? "Flagged" : "Organic",
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
    ],
  };
}

function verdictFor(score, fakeVolume, deployerRugs) {
  if (score >= 78 && !fakeVolume && deployerRugs === 0) return "Clean";
  if (score >= 62) return "Watch";
  if (fakeVolume) return "Fake volume";
  if (deployerRugs > 0) return "Risky";
  return "Avoid";
}

function classifyToken(token) {
  if (token.score >= 75 && !token.fakeVolume && token.deployerRugs === 0)
    return "clean";
  if (token.score >= 55 && token.smartHits > 0) return "watch";
  if (token.score < 45 || token.fakeVolume || token.deployerRugs > 1)
    return "avoid";
  return "neutral";
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
    m5Volume: Number(tokenData.m5Volume || 0),
    priceChangeM5: Number(tokenData.priceChangeM5 || 0),
    buysM5: Number(tokenData.buysM5 || 0),
    sellsM5: Number(tokenData.sellsM5 || 0),
  };

  data.fomoPressure = fomoPressure(data);
  const result = buildFactors(data);

  return {
    score: result.score,
    verdict: verdictFor(result.score, data.fakeVolume, data.deployerRugs),
    classification: classifyToken({ ...data, score: result.score }),
    factors: result.factors,
    fomoPressure: data.fomoPressure,
  };
}

module.exports = { scoreToken, verdictFor, classifyToken, buildFactors };
