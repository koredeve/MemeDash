const { supabase } = require('../../lib/supabase');

/**
 * GET /api/scanner/status
 * Get scanner health status
 */
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data: status, error } = await supabase
      .from('scanner_status')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single();

    if (error && error.code === 'PGRST116') {
      // No rows found, return healthy default
      return res.status(200).json({
        success: true,
        status: {
          is_healthy: true,
          last_scan_time: null,
          scan_count: 0,
          tokens_detected_today: 0,
          alerts_sent_today: 0,
          error_message: null
        }
      });
    }

    if (error) throw error;

    res.status(200).json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Error fetching scanner status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
