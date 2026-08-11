const { supabase } = require('../../lib/supabase');

/**
 * GET /api/scanner/latest
 * Fetch latest tokens from cloud scanner (Supabase)
 * Updated to work with Vercel Cron-based scanner
 */
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get latest tokens from Supabase (cloud scanner continuously updates this)
    const { data: tokens, error } = await supabase
      .from('tokens')
      .select('*')
      .order('detected_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: tokens.length,
      tokens: tokens || [],
      source: 'vercel-cron-scanner',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching latest tokens:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
