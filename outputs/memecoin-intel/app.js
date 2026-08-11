const STORAGE_KEYS = {
  wallets: "chainlens.wallets",
  journal: "chainlens.journal",
  source: "chainlens.source"
};

const API = {
  dexscreener: "https://api.dexscreener.com",
  dexscanner: "https://dexscanner.io",
  solanaRpc: "https://api.mainnet-beta.solana.com"
};

const tokenNames = [
  ["MONK", "Laser Monk"],
  ["BONSAI", "Bonsai CTO"],
  ["MINTY", "Minty Dog"],
  ["WAVE", "Wave Runner"],
  ["GLOW", "Glow Cat"],
  ["NOVA", "Nova Hat"],
  ["DUST", "Dust Protocol"],
  ["BOLT", "Bolt Frog"],
  ["PLUTO", "Pluto CTO"],
  ["FABLE", "Fable Coin"]
];

const narratives = [
  "CTO revival",
  "AI agent",
  "TikTok meme",
  "Telegram raid",
  "Old wallet rotation",
  "Pump migration",
  "Celebrity derivative",
  "Local culture meme"
];

const defaultWallets = [
  {
    address: "7e4K9pQnJ2aPzS8rMxYbV1hCdLm3tNqR6u",
    label: "Early accumulator",
    wins: 18,
    entries: 31,
    avgHold: "3.8h"
  },
  {
    address: "C9vN1qL4xT7bRy2sGhP8mWkQeY6uZaFn0",
    label: "Migration watcher",
    wins: 12,
    entries: 22,
    avgHold: "7.1h"
  },
  {
    address: "H3sV8aNpQx2Lm4BrT9yJdK6cWfZ1eRu5",
    label: "Fast scalper",
    wins: 27,
    entries: 49,
    avgHold: "42m"
  }
];

let pairs = [];
let selectedPairId = null;
let auditResult = null;
let lastSourceStatus = "Demo";
let lastRefreshAt = null;

const els = {
  sectionLinks: document.querySelectorAll("[data-section-link]"),
  sections: document.querySelectorAll("[data-section]"),
  pairTable: document.getElementById("pair-table"),
  scannerDetail: document.getElementById("scanner-detail"),
  dataSource: document.getElementById("data-source"),
  dataSourceStatus: document.getElementById("data-source-status"),
  lastRefresh: document.getElementById("last-refresh"),
  sourceMode: document.getElementById("source-mode"),
  sourceCopy: document.getElementById("source-copy"),
  scannerFilter: document.getElementById("scanner-filter"),
  refreshScan: document.getElementById("refresh-scan"),
  scanCount: document.getElementById("scan-count"),
  alertCount: document.getElementById("alert-count"),
  watchCount: document.getElementById("watch-count"),
  medianSafety: document.getElementById("median-safety"),
  fakeVolumeCount: document.getElementById("fake-volume-count"),
  smartHitCount: document.getElementById("smart-hit-count"),
  liquidityCount: document.getElementById("liquidity-count"),
  auditForm: document.getElementById("audit-form"),
  contractInput: document.getElementById("contract-input"),
  gauge: document.getElementById("score-gauge"),
  auditVerdict: document.getElementById("audit-verdict"),
  auditScore: document.getElementById("audit-score"),
  auditSummary: document.getElementById("audit-summary"),
  factorList: document.getElementById("factor-list"),
  walletForm: document.getElementById("wallet-form"),
  walletInput: document.getElementById("wallet-input"),
  walletLabel: document.getElementById("wallet-label"),
  walletGrid: document.getElementById("wallet-grid"),
  journalForm: document.getElementById("journal-form"),
  journalToken: document.getElementById("journal-token"),
  journalThesis: document.getElementById("journal-thesis"),
  journalInvalid: document.getElementById("journal-invalid"),
  journalRisk: document.getElementById("journal-risk"),
  journalList: document.getElementById("journal-list")
};

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(random, min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatMoney(value) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${Math.round(value)}`;
}

function formatAge(minutes) {
  if (!minutes && minutes !== 0) return "--";
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

function shortAddress(value) {
  if (!value) return "--";
  if (value.length <= 12) return value;
  return `${value.slice(0, 5)}...${value.slice(-5)}`;
}

function pumpFunUrl(address) {
  return address && address.toLowerCase().endsWith("pump")
    ? `https://pump.fun/coin/${address}`
    : "";
}

function scoreTone(score) {
  if (score >= 72) return "good";
  if (score >= 48) return "warn";
  return "bad";
}

function verdictFor(score, fakeVolume, deployerRugs) {
  if (score >= 78 && !fakeVolume && deployerRugs === 0) return "Clean candidate";
  if (score >= 62) return "Watch closely";
  if (fakeVolume) return "Possible fake volume";
  if (deployerRugs > 0) return "Risky deployer";
  return "Avoid for now";
}

function fomoPressure(pair) {
  const m5Volume = Number(pair.m5Volume || 0);
  const change = Number(pair.priceChangeM5 || 0);
  const buys = Number(pair.buysM5 || 0);
  const sells = Number(pair.sellsM5 || 0);
  const buyPressure = buys + sells ? buys / (buys + sells) : 0.5;
  const raw = 35 + Math.min(28, m5Volume / 650) + Math.max(-18, Math.min(24, change * 2)) + (buyPressure - 0.5) * 42;
  return clamp(Math.round(raw), 0, 100);
}

function classifyPair(pair) {
  if (pair.score >= 75 && !pair.fakeVolume && pair.deployerRugs === 0) return "clean";
  if (pair.score >= 55 && pair.smartHits > 0) return "watch";
  if (pair.score < 45 || pair.fakeVolume || pair.deployerRugs > 1) return "avoid";
  return "all";
}

function buildFactors(data) {
  const feeRatio = data.fees / Math.max(data.volume, 1);
  const concentrationPenalty = data.topTen > 32 ? 18 : data.topTen > 24 ? 9 : 0;
  const fakePenalty = data.fakeVolume ? 22 : 0;
  const authorityPenalty = data.mintRevoked ? 0 : 12;
  const freezePenalty = data.freezeRevoked ? 0 : 8;
  const deployerPenalty = data.deployerRugs * 11 + (data.deployerAge < 5 ? 8 : 0);
  const smartBonus = Math.min(14, data.smartHits * 5);
  const liquidityScore = clamp(Math.round(data.liquidity / 350), 0, 18);
  const holderScore = clamp(Math.round(data.holders / 35), 0, 14);
  const feeQualityBonus = feeRatio > 0.0018 && feeRatio < 0.009 ? 12 : feeRatio <= 0.0012 ? -12 : 4;

  const score = clamp(
    50 + liquidityScore + holderScore + smartBonus + feeQualityBonus -
      concentrationPenalty - fakePenalty - authorityPenalty - freezePenalty - deployerPenalty,
    8,
    96
  );

  return {
    score,
    factors: [
      {
        name: "Liquidity",
        score: clamp(45 + liquidityScore * 3, 0, 100),
        note: `${formatMoney(data.liquidity)} available; lower pools are easier to trap.`
      },
      {
        name: "Authorities",
        score: data.mintRevoked && data.freezeRevoked ? 88 : data.mintRevoked ? 64 : 32,
        note: data.mintRevoked && data.freezeRevoked ? "Mint and freeze controls are revoked." : "One or more token controls remain active."
      },
      {
        name: "Holder spread",
        score: clamp(100 - data.topTen * 2, 5, 95),
        note: `Top 10 holders control ${data.topTen}% of supply.`
      },
      {
        name: "Volume quality",
        score: data.fakeVolume ? 24 : clamp(Math.round(feeRatio * 16000), 35, 92),
        note: data.fakeVolume ? "Volume rhythm and fees look manufactured." : "Fees and transaction cadence look more organic."
      },
      {
        name: "Deployer",
        score: clamp(86 - data.deployerRugs * 24 - (data.deployerAge < 5 ? 14 : 0), 5, 92),
        note: `${data.deployerRugs} suspicious prior launch${data.deployerRugs === 1 ? "" : "es"}; deployer age ${data.deployerAge}d.`
      },
      {
        name: "Smart money",
        score: clamp(45 + data.smartHits * 14, 20, 96),
        note: `${data.smartHits} tracked wallet hit${data.smartHits === 1 ? "" : "s"} detected.`
      }
    ]
  };
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 12000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function pairFromDex(pair, boost = {}) {
  const baseToken = pair.baseToken || {};
  const pairAgeMinutes = pair.pairCreatedAt
    ? Math.max(1, Math.round((Date.now() - pair.pairCreatedAt) / 60000))
    : 0;
  const buys = Number(pair.txns?.h24?.buys || pair.txns?.h1?.buys || 0);
  const sells = Number(pair.txns?.h24?.sells || pair.txns?.h1?.sells || 0);
  const buysM5 = Number(pair.txns?.m5?.buys || 0);
  const sellsM5 = Number(pair.txns?.m5?.sells || 0);
  const txCount = buys + sells;
  const liquidity = Number(pair.liquidity?.usd || 0);
  const volume = Number(pair.volume?.h24 || pair.volume?.h6 || pair.volume?.h1 || 0);
  const feeEstimate = Math.max(0, volume * 0.0025);
  const buySellImbalance = txCount ? Math.abs(buys - sells) / txCount : 0;
  const data = {
    id: pair.pairAddress || baseToken.address || boost.tokenAddress,
    address: baseToken.address || boost.tokenAddress,
    pairAddress: pair.pairAddress,
    url: pair.url || boost.url,
    symbol: baseToken.symbol || "TOKEN",
    name: baseToken.name || "Live Solana Pair",
    ageMinutes: pairAgeMinutes,
    liquidity,
    volume,
    m5Volume: Number(pair.volume?.m5 || 0),
    priceChangeM5: Number(pair.priceChange?.m5 || 0),
    buysM5,
    sellsM5,
    fees: feeEstimate,
    holders: Math.max(25, Math.round(txCount * 1.7)),
    topTen: clamp(Math.round(48 - Math.min(22, Math.log10(Math.max(liquidity, 10)) * 4) + buySellImbalance * 18), 12, 68),
    smartHits: Number(boost.totalAmount || boost.amount || 0) > 0 ? 1 : 0,
    deployerAge: pairAgeMinutes > 1440 ? 30 : Math.max(0, Math.round(pairAgeMinutes / 60)),
    deployerRugs: 0,
    mintRevoked: true,
    freezeRevoked: true,
    bundled: clamp(Math.round(buySellImbalance * 35), 0, 40),
    narrative: boost.description ? "Dexscreener boosted" : pair.dexId || "Live pair",
    fakeVolume: liquidity > 0 && volume / liquidity > 22 && txCount < 220
  };
  data.fomoPressure = fomoPressure(data);
  const result = buildFactors(data);
  return { ...data, score: result.score, factors: result.factors, verdict: verdictFor(result.score, data.fakeVolume, data.deployerRugs) };
}

async function fetchDexscannerFeed(type) {
  const cacheBust = Date.now();
  const feed = await fetchJson(`${API.dexscanner}/api/feed?type=${type}&chain=solana&_=${cacheBust}`);
  if (!Array.isArray(feed) || !feed.length) {
    throw new Error(`DexScanner ${type} feed returned no pairs`);
  }
  return feed
    .filter((pair) => pair.chainId === "solana" && pair.baseToken?.address)
    .slice(0, 14)
    .map((pair) => ({ ...pairFromDex(pair), sourceLabel: `DexScanner ${type}` }));
}

async function fetchLiveBoostedPairs() {
  const boosts = await fetchJson(`${API.dexscreener}/token-boosts/latest/v1`);
  const seenAddresses = new Set();
  const solanaBoosts = boosts
    .filter((boost) => {
      if (boost.chainId !== "solana" || !boost.tokenAddress || seenAddresses.has(boost.tokenAddress)) {
        return false;
      }
      seenAddresses.add(boost.tokenAddress);
      return true;
    })
    .slice(0, 12);

  if (!solanaBoosts.length) {
    throw new Error("No Solana boosted tokens returned");
  }

  const pairLists = await Promise.all(solanaBoosts.map(async (boost) => {
    try {
      const pairsForToken = await fetchJson(`${API.dexscreener}/token-pairs/v1/solana/${boost.tokenAddress}`);
      const bestPair = Array.isArray(pairsForToken)
        ? pairsForToken
          .filter((pair) => pair.chainId === "solana")
          .sort((a, b) => Number(b.liquidity?.usd || 0) - Number(a.liquidity?.usd || 0))[0]
        : null;
      return bestPair ? pairFromDex(bestPair, boost) : null;
    } catch (error) {
      return null;
    }
  }));

  const livePairs = pairLists.filter(Boolean);
  if (!livePairs.length) {
    throw new Error("No usable live pairs returned");
  }
  return livePairs.map((pair) => ({ ...pair, sourceLabel: "Dexscreener boosted" }));
}

async function rpcGetParsedAccountInfo(address) {
  return fetchJson(API.solanaRpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "chainlens-mint",
      method: "getParsedAccountInfo",
      params: [address, { encoding: "jsonParsed", commitment: "confirmed" }]
    }),
    timeoutMs: 9000
  });
}

async function enrichMintControls(result) {
  try {
    const account = await rpcGetParsedAccountInfo(result.address);
    const parsed = account?.result?.value?.data?.parsed;
    const info = parsed?.info;
    if (!info || parsed?.type !== "mint") return result;
    const mintRevoked = info.mintAuthority === null;
    const freezeRevoked = info.freezeAuthority === null;
    const enriched = { ...result, mintRevoked, freezeRevoked };
    const rebuilt = buildFactors(enriched);
    return {
      ...enriched,
      score: rebuilt.score,
      factors: rebuilt.factors,
      verdict: verdictFor(rebuilt.score, enriched.fakeVolume, enriched.deployerRugs)
    };
  } catch (error) {
    return result;
  }
}

function makePair(seedText, index) {
  const random = mulberry32(hashString(`${seedText}-${index}`));
  const name = tokenNames[index % tokenNames.length];
  const address = `${hashString(seedText + index).toString(36)}${hashString(name[0] + seedText).toString(36)}pump`;
  const liquidity = randInt(random, 1800, 72000);
  const volume = randInt(random, 12000, 980000);
  const fees = Math.max(12, Math.round(volume * (0.0008 + random() * 0.008)));
  const fakeVolume = (volume / Math.max(liquidity, 1) > 19 && fees / volume < 0.0022) || random() > 0.84;
  const data = {
    address,
    symbol: name[0],
    name: name[1],
    ageMinutes: randInt(random, 3, 480),
    liquidity,
    volume,
    fees,
    holders: randInt(random, 37, 2300),
    topTen: randInt(random, 13, 61),
    smartHits: randInt(random, 0, 4),
    deployerAge: randInt(random, 0, 120),
    deployerRugs: randInt(random, 0, 3),
    mintRevoked: random() > 0.22,
    freezeRevoked: random() > 0.28,
    bundled: randInt(random, 0, 38),
    m5Volume: randInt(random, 50, 26000),
    priceChangeM5: randInt(random, -12, 48),
    buysM5: randInt(random, 0, 120),
    sellsM5: randInt(random, 0, 90),
    narrative: narratives[randInt(random, 0, narratives.length - 1)],
    fakeVolume
  };
  data.fomoPressure = fomoPressure(data);
  const result = buildFactors(data);
  const verdict = verdictFor(result.score, fakeVolume, data.deployerRugs);
  return { ...data, id: address, score: result.score, factors: result.factors, verdict };
}

function generatePairs() {
  const nowSeed = String(Math.floor(Date.now() / 30000));
  pairs = Array.from({ length: 14 }, (_, index) => ({ ...makePair(nowSeed, index), sourceLabel: "demo simulator" }));
  selectedPairId = pairs[0]?.id || null;
  lastSourceStatus = "Demo";
  lastRefreshAt = new Date();
}

async function loadPairs() {
  const source = els.dataSource.value;
  localStorage.setItem(STORAGE_KEYS.source, source);
  if (source === "demo") {
    generatePairs();
    return;
  }
  lastSourceStatus = "Loading";
  renderMetrics();
  try {
    let livePairs;
    try {
      livePairs = await fetchDexscannerFeed("new");
      lastSourceStatus = "Live new feed";
    } catch (newFeedError) {
      try {
        livePairs = await fetchDexscannerFeed("latest");
        lastSourceStatus = "Live latest feed";
      } catch (latestFeedError) {
        livePairs = await fetchLiveBoostedPairs();
        lastSourceStatus = "Live boosted feed";
      }
    }
    pairs = livePairs;
    selectedPairId = pairs[0]?.id || null;
    lastRefreshAt = new Date();
  } catch (error) {
    generatePairs();
    lastSourceStatus = "Demo fallback";
  }
}

function tokenFromContract(contract) {
  const clean = contract.trim() || "demo-token-pump";
  const random = mulberry32(hashString(clean));
  const data = {
    address: clean,
    symbol: clean.slice(0, 4).toUpperCase(),
    name: "Manual Audit",
    ageMinutes: randInt(random, 2, 900),
    liquidity: randInt(random, 1200, 125000),
    volume: randInt(random, 6000, 1600000),
    fees: randInt(random, 20, 9000),
    holders: randInt(random, 18, 5000),
    topTen: randInt(random, 8, 72),
    smartHits: randInt(random, 0, 5),
    deployerAge: randInt(random, 0, 365),
    deployerRugs: randInt(random, 0, 4),
    mintRevoked: random() > 0.18,
    freezeRevoked: random() > 0.24,
    bundled: randInt(random, 0, 42),
    m5Volume: randInt(random, 50, 26000),
    priceChangeM5: randInt(random, -12, 48),
    buysM5: randInt(random, 0, 120),
    sellsM5: randInt(random, 0, 90),
    narrative: narratives[randInt(random, 0, narratives.length - 1)]
  };
  data.fakeVolume = (data.volume / Math.max(data.liquidity, 1) > 20 && data.fees / data.volume < 0.002) || data.bundled > 31;
  data.fomoPressure = fomoPressure(data);
  const result = buildFactors(data);
  return {
    ...data,
    score: result.score,
    factors: result.factors,
    verdict: verdictFor(result.score, data.fakeVolume, data.deployerRugs)
  };
}

function getWallets() {
  const saved = localStorage.getItem(STORAGE_KEYS.wallets);
  return saved ? JSON.parse(saved) : defaultWallets;
}

function saveWallets(wallets) {
  localStorage.setItem(STORAGE_KEYS.wallets, JSON.stringify(wallets));
}

function getJournal() {
  const saved = localStorage.getItem(STORAGE_KEYS.journal);
  return saved ? JSON.parse(saved) : [];
}

function saveJournal(entries) {
  localStorage.setItem(STORAGE_KEYS.journal, JSON.stringify(entries));
}

function renderNav(sectionId) {
  els.sectionLinks.forEach((link) => link.classList.toggle("active", link.dataset.sectionLink === sectionId));
  els.sections.forEach((section) => section.classList.toggle("active", section.dataset.section === sectionId));
}

function renderScoreBar(score) {
  const tone = scoreTone(score);
  return `<div class="score-bar" aria-label="Score ${score}"><span class="${tone}" style="width:${score}%"></span></div>`;
}

function renderScanner() {
  const filter = els.scannerFilter.value;
  const filteredPairs = pairs.filter((pair) => {
    if (filter === "all") return true;
    return classifyPair(pair) === filter;
  });

  els.pairTable.innerHTML = filteredPairs.map((pair) => {
    const tone = pair.fakeVolume || pair.score < 45 ? "bad" : pair.score >= 72 ? "good" : "warn";
    return `
      <tr data-pair-id="${pair.id}" class="${pair.id === selectedPairId ? "selected" : ""}">
        <td class="token-cell"><strong>${pair.symbol}</strong><span>${pair.name} · ${formatAge(pair.ageMinutes)} old</span></td>
        <td><span class="badge ${tone}">${pair.verdict}</span></td>
        <td>${renderScoreBar(pair.score)}</td>
        <td>${formatMoney(pair.liquidity)}</td>
        <td>${pair.fakeVolume ? "<span class='badge bad'>Flagged</span>" : "<span class='badge good'>Natural</span>"}</td>
        <td>${pair.smartHits} hits · FOMO ${pair.fomoPressure || "--"}</td>
        <td><button type="button" class="small-action" data-audit-pair="${pair.id}">Audit</button></td>
      </tr>
    `;
  }).join("");

  const selected = pairs.find((pair) => pair.id === selectedPairId) || filteredPairs[0] || pairs[0];
  if (selected) {
    selectedPairId = selected.id;
    renderScannerDetail(selected);
  }
  renderMetrics();
}

function renderMetrics() {
  const scores = pairs.map((pair) => pair.score).sort((a, b) => a - b);
  const median = scores.length ? scores[Math.floor(scores.length / 2)] : 0;
  const alerts = pairs.filter((pair) => pair.score >= 68 || pair.fakeVolume || pair.deployerRugs > 1).length;
  const wallets = getWallets();

  els.scanCount.textContent = String(pairs.length);
  els.alertCount.textContent = String(alerts);
  els.watchCount.textContent = String(wallets.length);
  els.medianSafety.textContent = `${median}/100`;
  els.fakeVolumeCount.textContent = String(pairs.filter((pair) => pair.fakeVolume).length);
  els.smartHitCount.textContent = String(pairs.reduce((sum, pair) => sum + pair.smartHits, 0));
  els.liquidityCount.textContent = String(pairs.filter((pair) => pair.liquidity > 25000).length);
  els.dataSourceStatus.textContent = lastSourceStatus;
  els.lastRefresh.textContent = lastRefreshAt
    ? lastRefreshAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "--";
  els.sourceMode.textContent = lastSourceStatus;
  els.sourceCopy.textContent = lastSourceStatus.startsWith("Live")
    ? "Reading free public feeds. Pair stats are live; deep holder and deployer history still needs indexed chain data."
    : "Using local simulation because demo mode is selected or live data was unavailable.";
}

function renderScannerDetail(pair) {
  const flags = [
    {
      tone: pair.mintRevoked && pair.freezeRevoked ? "good" : "bad",
      text: pair.mintRevoked && pair.freezeRevoked ? "Authorities are revoked" : "Token controls need caution"
    },
    {
      tone: pair.fakeVolume ? "bad" : "good",
      text: pair.fakeVolume ? "Fee-to-volume pattern suggests fake volume" : "Volume quality looks organic"
    },
    {
      tone: pair.topTen > 32 ? "warn" : "good",
      text: `Top 10 holders control ${pair.topTen}%`
    },
    {
      tone: pair.deployerRugs > 0 ? "bad" : "good",
      text: pair.deployerRugs > 0 ? "Deployer has suspicious history" : "No suspicious deployer history in simulation"
    },
    {
      tone: pair.smartHits > 0 ? "good" : "warn",
      text: `${pair.smartHits} tracked wallet hit${pair.smartHits === 1 ? "" : "s"}`
    }
  ];

  els.scannerDetail.innerHTML = `
    <span class="badge ${scoreTone(pair.score)}">${pair.verdict}</span>
    <h3>${pair.symbol} · ${pair.name}</h3>
    <p>${shortAddress(pair.address)} is a ${pair.narrative.toLowerCase()} setup from ${pair.sourceLabel || "demo data"}. The scanner is weighing whether momentum is supported by real liquidity, clean controls, and believable wallet behavior.</p>
    <div class="detail-kpis">
      <div><span>Safety</span><strong>${pair.score}/100</strong></div>
      <div><span>Liquidity</span><strong>${formatMoney(pair.liquidity)}</strong></div>
      <div><span>Volume</span><strong>${formatMoney(pair.volume)}</strong></div>
      <div><span>Age</span><strong>${formatAge(pair.ageMinutes)}</strong></div>
      <div><span>FOMO</span><strong>${pair.fomoPressure || "--"}/100</strong></div>
    </div>
    <button type="button" class="small-action" data-audit-pair="${pair.id}">Open in Audit</button>
    ${pair.url ? `<a class="external-link" href="${pair.url}" target="_blank" rel="noreferrer">View on Dexscreener</a>` : ""}
    ${pumpFunUrl(pair.address) ? `<a class="external-link" href="${pumpFunUrl(pair.address)}" target="_blank" rel="noreferrer">Open Pump.fun</a>` : ""}
    <ul class="flag-list">
      ${flags.map((flag) => `<li class="${flag.tone}">${flag.text}</li>`).join("")}
    </ul>
  `;
}

function drawGauge(score) {
  const ctx = els.gauge.getContext("2d");
  const width = els.gauge.width;
  const height = els.gauge.height;
  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = 18;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#303640";
  ctx.beginPath();
  ctx.arc(width / 2, height - 18, 96, Math.PI, 0);
  ctx.stroke();

  const tone = scoreTone(score);
  ctx.strokeStyle = tone === "good" ? "#37c871" : tone === "warn" ? "#f0b84f" : "#ef6a5b";
  ctx.beginPath();
  ctx.arc(width / 2, height - 18, 96, Math.PI, Math.PI + Math.PI * (score / 100));
  ctx.stroke();

  ctx.fillStyle = "#eef2f5";
  ctx.font = "700 28px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(`${score}/100`, width / 2, height - 42);
}

function renderAudit(result) {
  auditResult = result;
  drawGauge(result.score);
  els.auditVerdict.textContent = result.verdict;
  els.auditScore.textContent = `${result.score}/100`;
  els.auditSummary.textContent = `${shortAddress(result.address)} shows ${result.fakeVolume ? "manufactured-volume risk" : "a usable volume pattern"}, ${result.smartHits} smart-wallet hit${result.smartHits === 1 ? "" : "s"}, and ${result.deployerRugs} deployer warning${result.deployerRugs === 1 ? "" : "s"}.`;
  els.factorList.innerHTML = result.factors.map((factor) => `
    <div class="factor">
      <div>
        <strong>${factor.name}</strong>
        <p>${factor.note}</p>
      </div>
      ${renderScoreBar(factor.score)}
      <span>${factor.score}</span>
    </div>
  `).join("");
}

function renderWallets() {
  const wallets = getWallets();
  els.walletGrid.innerHTML = wallets.map((wallet, index) => {
    const winRate = Math.round((wallet.wins / Math.max(wallet.entries, 1)) * 100);
    return `
      <article class="wallet-card">
        <strong>${shortAddress(wallet.address)}</strong>
        <span>${wallet.label}</span>
        <div class="wallet-stats">
          <div><small>Wins</small><b>${wallet.wins}</b></div>
          <div><small>Entries</small><b>${wallet.entries}</b></div>
          <div><small>Win rate</small><b>${winRate}%</b></div>
        </div>
        <ul class="flag-list">
          <li class="${winRate >= 55 ? "good" : "warn"}">Average hold ${wallet.avgHold}</li>
          <li class="good">Alert when this wallet enters a fresh pair</li>
        </ul>
        <button type="button" class="small-action" data-remove-wallet="${index}">Remove</button>
      </article>
    `;
  }).join("");
  renderMetrics();
}

function renderJournal() {
  const entries = getJournal();
  if (!entries.length) {
    els.journalList.innerHTML = `<div class="journal-entry"><p>No entries yet. The useful habit is to write the invalidation before entering.</p></div>`;
    return;
  }
  els.journalList.innerHTML = entries.map((entry, index) => `
    <article class="journal-entry">
      <header>
        <div>
          <strong>${entry.token}</strong>
          <p>${entry.createdAt}</p>
        </div>
        <span class="badge ${Number(entry.risk) <= 2 ? "good" : Number(entry.risk) <= 5 ? "warn" : "bad"}">${entry.risk}% risk</span>
      </header>
      <p><strong>Thesis:</strong> ${entry.thesis}</p>
      <p><strong>Invalidation:</strong> ${entry.invalid}</p>
      <button type="button" class="small-action" data-remove-journal="${index}">Delete</button>
    </article>
  `).join("");
}

function wireEvents() {
  els.sectionLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      renderNav(link.dataset.sectionLink);
    });
  });

  els.scannerFilter.addEventListener("change", renderScanner);
  els.dataSource.addEventListener("change", async () => {
    await loadPairs();
    renderScanner();
  });
  els.refreshScan.addEventListener("click", async () => {
    await loadPairs();
    renderScanner();
  });

  els.pairTable.addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-pair-id]");
    const auditButton = event.target.closest("[data-audit-pair]");
    const id = auditButton?.dataset.auditPair || row?.dataset.pairId;
    if (!id) return;
    const pair = pairs.find((item) => item.id === id);
    if (!pair) return;
    selectedPairId = pair.id;
    renderScanner();
    if (auditButton) {
      renderAudit(pair);
      els.contractInput.value = pair.address;
      renderNav("audit");
    }
  });

  els.scannerDetail.addEventListener("click", (event) => {
    const button = event.target.closest("[data-audit-pair]");
    if (!button) return;
    const pair = pairs.find((item) => item.id === button.dataset.auditPair);
    if (!pair) return;
    renderAudit(pair);
    els.contractInput.value = pair.address;
    renderNav("audit");
  });

  els.auditForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const contract = els.contractInput.value.trim();
    let result = tokenFromContract(contract);
    if (els.dataSource.value === "live" && contract) {
      try {
        const pairsForToken = await fetchJson(`${API.dexscreener}/token-pairs/v1/solana/${contract}`);
        const bestPair = Array.isArray(pairsForToken)
          ? pairsForToken.sort((a, b) => Number(b.liquidity?.usd || 0) - Number(a.liquidity?.usd || 0))[0]
          : null;
        if (bestPair) {
          result = pairFromDex(bestPair, { tokenAddress: contract });
        }
        result = await enrichMintControls(result);
      } catch (error) {
        result.verdict = `${result.verdict} · demo fallback`;
      }
    }
    renderAudit(result);
  });

  els.walletForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const address = els.walletInput.value.trim();
    if (!address) return;
    const random = mulberry32(hashString(address));
    const wallets = getWallets();
    wallets.unshift({
      address,
      label: els.walletLabel.value.trim() || "Tracked wallet",
      wins: randInt(random, 3, 29),
      entries: randInt(random, 9, 54),
      avgHold: `${randInt(random, 20, 480)}m`
    });
    saveWallets(wallets);
    els.walletInput.value = "";
    els.walletLabel.value = "";
    renderWallets();
  });

  els.walletGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-wallet]");
    if (!button) return;
    const wallets = getWallets();
    wallets.splice(Number(button.dataset.removeWallet), 1);
    saveWallets(wallets);
    renderWallets();
  });

  els.journalForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const token = els.journalToken.value.trim();
    const thesis = els.journalThesis.value.trim();
    const invalid = els.journalInvalid.value.trim();
    if (!token || !thesis || !invalid) return;
    const entries = getJournal();
    entries.unshift({
      token,
      thesis,
      invalid,
      risk: els.journalRisk.value || "1",
      createdAt: new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
    });
    saveJournal(entries);
    els.journalForm.reset();
    els.journalRisk.value = "1";
    renderJournal();
  });

  els.journalList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-journal]");
    if (!button) return;
    const entries = getJournal();
    entries.splice(Number(button.dataset.removeJournal), 1);
    saveJournal(entries);
    renderJournal();
  });
}

async function init() {
  els.dataSource.value = localStorage.getItem(STORAGE_KEYS.source) || "live";
  wireEvents();
  await loadPairs();
  renderScanner();
  renderAudit(tokenFromContract("7bX9DemoPumpAddress"));
  renderWallets();
  renderJournal();
}

init();
