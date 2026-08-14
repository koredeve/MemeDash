/**
 * GET /api/telegram/get-config?session_id=xxx
 * Get user's saved Telegram bot config
 */

const { supabase } = require("../../lib/supabase");

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET only" });
  }

  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ error: "session_id query param required" });
    }

    // Get user's config
    const { data, error } = await supabase
      .from("user_telegram_bots")
      .select("*")
      .eq("session_id", session_id)
      .limit(1);

    if (error) {
      console.error("Config fetch error:", error);
      return res.status(500).json({ error: error.message });
    }

    const config = data && data.length > 0 ? data[0] : null;

    return res.status(200).json({
      success: true,
      has_config: !!config,
      config: config
        ? {
            chat_id: config.chat_id,
            bot_token: config.bot_token.slice(0, 10) + "...", // Hide most of token
            updated_at: config.updated_at,
          }
        : null,
    });
  } catch (error) {
    console.error("[GET CONFIG] Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};
