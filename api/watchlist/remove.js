const { supabase } = require('../../lib/supabase');

/**
 * DELETE /api/watchlist/remove
 * Remove token from user's watchlist
 */
module.exports = async (req, res) => {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token_mint, user_id } = req.body;

    if (!token_mint || !user_id) {
      return res.status(400).json({ error: 'Missing token_mint or user_id' });
    }

    // Remove from watchlist
    const { error } = await supabase
      .from('watchlist')
      .delete()
      .eq('user_id', user_id)
      .eq('token_mint', token_mint);

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Token removed from watchlist'
    });
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
