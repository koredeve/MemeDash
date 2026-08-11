const { supabase } = require('../../lib/supabase');

/**
 * GET /api/dashboard/status
 * Get dashboard overview status
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

    // Get scanner status
    const { data: scannerStatus } = await supabase
      .from('scanner_status')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single();

    // Get user's alert rules
    const { data: rules } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('user_id', user_id)
      .single();

    // Count watchlist
    const { count: watchlistCount } = await supabase
      .from('watchlist')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id);

    // Get today's alerts
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: alertsToday } = await supabase
      .from('alert_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .gte('sent_at', today.toISOString());

    res.status(200).json({
      success: true,
      status: {
        scanner: {
          healthy: scannerStatus?.is_healthy || false,
          last_scan: scannerStatus?.last_scan_time,
          tokens_today: scannerStatus?.tokens_detected_today || 0
        },
        user: {
          watchlist_count: watchlistCount || 0,
          alerts_today: alertsToday || 0,
          rules_enabled: rules?.enabled || false
        }
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
