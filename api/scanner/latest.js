const { supabase } = require('../../lib/supabase');
const { pollScanner } = require('../../lib/scanner-poller');

/**
 * GET /api/scanner/latest
 * Fetch latest tokens from scanner cache
 */
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Poll scanner for fresh data
    await pollScanner();

    // Get latest cached tokens (last 50)
    const { data: tokens, error } = await supabase
      .from('tokens')
      .select('*')
      .order('detected_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: tokens.length,
      tokens: tokens
    });
  } catch (error) {
    console.error('Error fetching latest tokens:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
