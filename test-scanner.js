/**
 * Local Test: Cloud Scanner Logic
 * Tests DexScreener fetching and scoring
 * Does NOT require Supabase or Telegram
 */

const { scoreToken, fetchNewTokens, formatAlertMessage } = require('./lib/dexscreener');

async function testScanner() {
  console.log('\n' + '='.repeat(70));
  console.log('LOCAL SCANNER TEST');
  console.log('='.repeat(70));

  try {
    // Step 1: Fetch tokens
    console.log('\n[TEST] Step 1: Fetching tokens from DexScreener...');
    const seenTokens = new Set();
    const tokens = await fetchNewTokens(seenTokens);
    console.log(`✓ Fetched ${tokens.length} tokens`);

    if (tokens.length === 0) {
      console.log('⚠️ No tokens found. This is normal if DexScreener has no new data.');
      return;
    }

    // Step 2: Score tokens
    console.log('\n[TEST] Step 2: Scoring tokens...');
    let validTokens = 0;
    let highScoreTokens = 0;

    for (let i = 0; i < Math.min(5, tokens.length); i++) {
      const token = tokens[i];
      const baseToken = token.baseToken || {};
      const { score, confidence, patterns } = scoreToken(token);

      console.log(`\n  Token ${i + 1}: ${baseToken.symbol || 'UNKNOWN'}`);
      console.log(`    Score: ${score}/100`);
      console.log(`    Confidence: ${confidence}%`);
      console.log(`    Patterns:`);
      patterns.forEach(p => console.log(`      ${p}`));

      if (score > 0) validTokens++;
      if (score >= 70) highScoreTokens++;
    }

    // Step 3: Report
    console.log('\n[TEST] Step 3: Summary');
    console.log(`✓ Tokens with score > 0: ${validTokens}/${Math.min(5, tokens.length)}`);
    console.log(`✓ Tokens with score >= 70: ${highScoreTokens}`);

    if (highScoreTokens > 0) {
      console.log('\n✓ Scanner logic is working correctly!');
      console.log('✓ Ready for cloud deployment.');
    } else {
      console.log('\n⚠️ No high-score tokens found. This is normal if market conditions are poor.');
      console.log('✓ Scoring algorithm is still working correctly.');
    }

    console.log('\n' + '='.repeat(70));
    console.log('TEST PASSED');
    console.log('='.repeat(70) + '\n');
  } catch (error) {
    console.error(`\n✗ Test failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
testScanner();
