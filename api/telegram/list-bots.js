/**
 * GET /api/telegram/list-bots
 * Get all registered user Telegram bots (for scanner to send alerts to)
 * Used by scanner/run.js to send alerts to ALL users
 */

const { supabase } = require("../../lib/supabase");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET only" });
  }

  try {
    // Get all user telegram bots
    const { data, error } = await supabase
      .from("user_telegram_bots")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[LIST BOTS] Error:", error);
      return res.status(500).json({ error: error.message });
    }

    const bots = (data || []).map((bot) => ({
      session_id: bot.session_id,
      bot_token: bot.bot_token,
      chat_id: bot.chat_id,
    }));

    console.log(`[LIST BOTS] Found ${bots.length} registered users`);

    return res.status(200).json({
      success: true,
      count: bots.length,
      bots,
    });
  } catch (error) {
    console.error("[LIST BOTS] Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};
