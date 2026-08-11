const { supabase } = require('../../lib/supabase');

/**
 * GET /api/rules
 * Get user's alert rules
 */
async function handleGet(req, res) {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id query parameter' });
    }

    const { data: rules, error } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('user_id', user_id);

    if (error) throw error;

    res.status(200).json({
      success: true,
      rules: rules || []
    });
  } catch (error) {
    console.error('Error fetching rules:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * PUT /api/rules
 * Update user's alert rules
 */
async function handlePut(req, res) {
  try {
    const { user_id, rule_id, min_score, min_liquidity, max_age_minutes, alert_channels, enabled } = req.body;

    if (!user_id || !rule_id) {
      return res.status(400).json({ error: 'Missing user_id or rule_id' });
    }

    const { data, error } = await supabase
      .from('alert_rules')
      .update({
        min_score: min_score ?? undefined,
        min_liquidity: min_liquidity ?? undefined,
        max_age_minutes: max_age_minutes ?? undefined,
        alert_channels: alert_channels ?? undefined,
        enabled: enabled ?? undefined
      })
      .eq('id', rule_id)
      .eq('user_id', user_id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Rule updated',
      rule: data[0]
    });
  } catch (error) {
    console.error('Error updating rule:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * POST /api/rules
 * Create new alert rule for user
 */
async function handlePost(req, res) {
  try {
    const { user_id, min_score, min_liquidity, max_age_minutes, alert_channels } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }

    const { data, error } = await supabase
      .from('alert_rules')
      .insert({
        user_id,
        min_score: min_score || 70,
        min_liquidity: min_liquidity || 50000,
        max_age_minutes: max_age_minutes || 5,
        alert_channels: alert_channels || ['telegram'],
        enabled: true
      })
      .select();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Rule created',
      rule: data[0]
    });
  } catch (error) {
    console.error('Error creating rule:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = async (req, res) => {
  switch (req.method) {
    case 'GET':
      return handleGet(req, res);
    case 'PUT':
      return handlePut(req, res);
    case 'POST':
      return handlePost(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
};
