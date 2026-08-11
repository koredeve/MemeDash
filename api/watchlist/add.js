const { supabase } = require('../../lib/supabase');

/**
 * POST /api/watchlist/add
 * Add token to user's watchlist
 */
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token_mint, user_id } = req.body;

    if (!token_mint || !user_id) {
      return res.status(400).json({ error: 'Missing token_mint or user_id' });
    }

    // Add to watchlist
    const { data, error } = await supabase
      .from('watchlist')
      .insert({
        user_id,
        token_mint,
        source: 'dashboard',
        added_at: new Date().toISOString()
      });

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Token already in watchlist' });
      }
      throw error;
    }

    res.status(201).json({
      success: true,
      message: 'Token added to watchlist',
      data
    });
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
