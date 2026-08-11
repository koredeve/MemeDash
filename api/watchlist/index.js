const { supabase } = require('../../lib/supabase');

/**
 * GET /api/watchlist
 * Get user's entire watchlist
 */
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id query parameter' });
    }

    // Get watchlist with token details
    const { data: watchlist, error } = await supabase
      .from('watchlist')
      .select(`
        id,
        token_mint,
        added_at,
        source,
        tokens (
          name,
          symbol,
          score,
          liquidity,
          volume_5m,
          age_minutes
        )
      `)
      .eq('user_id', user_id)
      .order('added_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: watchlist.length,
      watchlist
    });
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
