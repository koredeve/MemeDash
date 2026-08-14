/**
 * POST /api/telegram/save-config
 * Save user's Telegram bot token and chat ID
 * Each user (identified by session ID) can have their own bot
 */

const { supabase } = require("../../lib/supabase");

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const { session_id, bot_token, chat_id } = req.body;

    if (!session_id || !bot_token || !chat_id) {
      return res.status(400).json({
        error: "Missing required fields: session_id, bot_token, chat_id",
      });
    }

    // Validate bot token format (should start with numbers:)
    if (!bot_token.includes(":")) {
      return res.status(400).json({ error: "Invalid bot token format" });
    }

    // Validate chat ID is a number
    if (isNaN(chat_id)) {
      return res.status(400).json({ error: "Chat ID must be a number" });
    }

    console.log(
      `[TELEGRAM CONFIG] Saving config for session: ${session_id.slice(0, 8)}...`
    );

    // Save or update user's telegram config
    const { data, error } = await supabase.from("user_telegram_bots").upsert(
      {
        session_id,
        bot_token,
        chat_id: parseInt(chat_id),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id" }
    );

    if (error) {
      console.error("Config save error:", error);
      return res.status(500).json({
        error: error.message,
        hint: "Make sure user_telegram_bots table exists in Supabase",
      });
    }

    console.log(`[TELEGRAM CONFIG] ✓ Config saved for session`);

    return res.status(200).json({
      success: true,
      message: "Telegram bot config saved",
      session_id,
    });
  } catch (error) {
    console.error("[TELEGRAM CONFIG] Error:", error.message);
    return res.status(500).json({
      error: error.message,
    });
  }
};
