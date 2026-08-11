const { supabase } = require('../../lib/supabase');

/**
 * GET /api/dashboard/stats
 * Get statistics for dashboard (alerts, tokens, trends)
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

    // Time ranges
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    // Alerts today
    const { count: alertsToday } = await supabase
      .from('alert_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .gte('sent_at', today.toISOString());

    // Alerts yesterday
    const { count: alertsYesterday } = await supabase
      .from('alert_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .gte('sent_at', yesterday.toISOString())
      .lt('sent_at', today.toISOString());

    // Alerts last week
    const { count: alertsWeek } = await supabase
      .from('alert_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .gte('sent_at', lastWeek.toISOString());

    // Unique tokens alerted today
    const { data: tokensAlertedToday } = await supabase
      .from('alert_history')
      .select('token_mint')
      .eq('user_id', user_id)
      .gte('sent_at', today.toISOString());

    const uniqueTokensToday = new Set(tokensAlertedToday?.map(a => a.token_mint)).size;

    // Average score of alerts
    const { data: alertScores } = await supabase
      .from('alert_history')
      .select('score')
      .eq('user_id', user_id)
      .gte('sent_at', lastWeek.toISOString());

    const avgScore = alertScores?.length > 0
      ? (alertScores.reduce((sum, a) => sum + a.score, 0) / alertScores.length).toFixed(1)
      : 0;

    // Watchlist count
    const { count: watchlistCount } = await supabase
      .from('watchlist')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id);

    // Avg liquidity of watchlist tokens
    const { data: watchlistTokens } = await supabase
      .from('watchlist')
      .select('tokens(liquidity)')
      .eq('user_id', user_id);

    const avgLiquidity = watchlistTokens?.length > 0
      ? watchlistTokens.reduce((sum, w) => sum + (w.tokens?.liquidity || 0), 0) / watchlistTokens.length
      : 0;

    res.status(200).json({
      success: true,
      stats: {
        alerts: {
          today: alertsToday || 0,
          yesterday: alertsYesterday || 0,
          week: alertsWeek || 0,
          trend: ((alertsToday - alertsYesterday) / Math.max(alertsYesterday, 1) * 100).toFixed(0) + '%'
        },
        tokens: {
          unique_today: uniqueTokensToday,
          avg_score: parseFloat(avgScore),
          watchlist_count: watchlistCount || 0,
          avg_watchlist_liquidity: Math.round(avgLiquidity)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
