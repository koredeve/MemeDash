/**
 * POST /api/telegram/auth
 * Consolidated endpoint handling:
 * - POST: Save bot config OR process user connection from bot
 * - GET: Get user config OR list all bots
 *
 * Query params:
 * ?action=get-config&session_id=xxx - Get user's saved config
 * ?action=list-bots - Get all registered user bots for scanner
 */

const { supabase } = require("../../lib/supabase");

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ============= POST: Save config or process connection =============
  if (req.method === "POST") {
    try {
      const { session_id, bot_token, chat_id, user_id, first_name, last_name } = req.body;

      // Two types of POST:
      // 1. User connecting via bot button (has user_id, first_name, etc.)
      // 2. User entering bot config manually (has session_id, bot_token, chat_id)

      if (user_id) {
        // Type 1: Bot connection callback
        if (!chat_id) {
          return res.status(400).json({ error: "Missing chat_id" });
        }

        const sessionId = `tg_${user_id}`;
        const displayName = `${first_name}${last_name ? " " + last_name : ""}`;

        console.log(`[TELEGRAM AUTH] User ${displayName} (${user_id}) connected`);

        const { data, error } = await supabase.from("user_telegram_bots").upsert(
          {
            session_id: sessionId,
            user_id: user_id,
            chat_id: parseInt(chat_id),
            first_name,
            last_name,
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "session_id" }
        );

        if (error) {
          console.error("Connection save error:", error);
          return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({
          success: true,
          message: `Welcome ${displayName}! Alerts will be sent to your Telegram.`,
          session_id: sessionId,
          display_name: displayName,
        });
      } else if (session_id && bot_token && chat_id) {
        // Type 2: Manual bot config entry
        if (!session_id.includes("session") && !session_id.startsWith("tg_")) {
          return res.status(400).json({ error: "Invalid session ID format" });
        }

        if (!bot_token.includes(":")) {
          return res.status(400).json({ error: "Invalid bot token format" });
        }

        if (isNaN(chat_id)) {
          return res.status(400).json({ error: "Chat ID must be a number" });
        }

        console.log(`[TELEGRAM AUTH] Saving config for session: ${session_id.slice(0, 8)}...`);

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
          });
        }

        return res.status(200).json({
          success: true,
          message: "Telegram bot config saved",
          session_id,
        });
      } else {
        return res.status(400).json({
          error: "Missing required fields",
        });
      }
    } catch (error) {
      console.error("[TELEGRAM AUTH] POST Error:", error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  // ============= GET: Retrieve config or list bots =============
  if (req.method === "GET") {
    try {
      const { session_id, action } = req.query;

      // Get single user's config
      if (action === "get-config" && session_id) {
        const { data, error } = await supabase
          .from("user_telegram_bots")
          .select("*")
          .eq("session_id", session_id)
          .limit(1);

        if (error) {
          return res.status(500).json({ error: error.message });
        }

        const config = data && data.length > 0 ? data[0] : null;

        return res.status(200).json({
          success: true,
          is_connected: !!config,
          connection: config
            ? {
                display_name: `${config.first_name}${config.last_name ? " " + config.last_name : ""}`,
                chat_id: config.chat_id,
                connected_at: config.connected_at,
              }
            : null,
        });
      }

      // List all bots (for scanner)
      if (action === "list-bots") {
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
      }

      return res.status(400).json({
        error: "Missing action parameter: use ?action=get-config or ?action=list-bots",
      });
    } catch (error) {
      console.error("[TELEGRAM AUTH] GET Error:", error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
