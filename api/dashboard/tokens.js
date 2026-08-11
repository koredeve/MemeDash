const { supabase } = require('../../lib/supabase');

/**
 * GET /api/dashboard/tokens
 * Get tokens for dashboard display (latest + user's watchlist)
 */
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_id, limit = 20 } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id query parameter' });
    }

    // Get latest tokens
    const { data: latestTokens } = await supabase
      .from('tokens')
      .select('*')
      .order('detected_at', { ascending: false })
      .limit(parseInt(limit));

    // Get user's watchlist tokens
    const { data: watchlistTokens } = await supabase
      .from('watchlist')
      .select('tokens(*)')
      .eq('user_id', user_id);

    const watchlistMints = watchlistTokens?.map(w => w.tokens.mint) || [];

    // Mark which tokens are in watchlist
    const tokensWithWatchlist = (latestTokens || []).map(token => ({
      ...token,
      in_watchlist: watchlistMints.includes(token.mint)
    }));

    res.status(200).json({
      success: true,
      latest_count: tokensWithWatchlist.length,
      watchlist_count: watchlistTokens?.length || 0,
      tokens: tokensWithWatchlist
    });
  } catch (error) {
    console.error('Error fetching dashboard tokens:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
