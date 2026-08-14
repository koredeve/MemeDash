/**
 * POST /api/telegram/connect
 * Telegram bot sends user info when they authorize MemeDash
 * Called from Telegram webhook when user clicks "Connect" button
 */

const { supabase } = require("../../lib/supabase");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "POST") {
    try {
      const { user_id, first_name, last_name, chat_id } = req.body;

      if (!user_id || !chat_id) {
        return res.status(400).json({
          error: "Missing user_id or chat_id",
        });
      }

      // Save connection with user_id as session identifier
      const sessionId = `tg_${user_id}`;
      const displayName = `${first_name}${last_name ? " " + last_name : ""}`;

      console.log(`[TELEGRAM CONNECT] User ${displayName} (${user_id}) connected`);

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
        return res.status(500).json({
          error: error.message,
        });
      }

      console.log(`[TELEGRAM CONNECT] ✓ User ${user_id} saved to database`);

      return res.status(200).json({
        success: true,
        message: `Welcome ${displayName}! Alerts will be sent to your Telegram.`,
        session_id: sessionId,
        display_name: displayName,
      });
    } catch (error) {
      console.error("[TELEGRAM CONNECT] Error:", error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  // GET: Check if session is connected
  if (req.method === "GET") {
    try {
      const { session_id } = req.query;

      if (!session_id) {
        return res.status(400).json({ error: "session_id required" });
      }

      const { data, error } = await supabase
        .from("user_telegram_bots")
        .select("*")
        .eq("session_id", session_id)
        .limit(1);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      const connection = data && data.length > 0 ? data[0] : null;

      return res.status(200).json({
        success: true,
        is_connected: !!connection,
        connection: connection
          ? {
              display_name: `${connection.first_name}${connection.last_name ? " " + connection.last_name : ""}`,
              chat_id: connection.chat_id,
              connected_at: connection.connected_at,
            }
          : null,
      });
    } catch (error) {
      console.error("[TELEGRAM CONNECT CHECK] Error:", error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
