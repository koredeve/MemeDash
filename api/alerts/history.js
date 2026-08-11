const { supabase } = require('../../lib/supabase');

/**
 * GET /api/alerts/history
 * Get user's alert history
 */
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_id, limit = 50, offset = 0 } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id query parameter' });
    }

    const { data: history, error, count } = await supabase
      .from('alert_history')
      .select('*', { count: 'exact' })
      .eq('user_id', user_id)
      .order('sent_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) throw error;

    res.status(200).json({
      success: true,
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset),
      history: history || []
    });
  } catch (error) {
    console.error('Error fetching alert history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
