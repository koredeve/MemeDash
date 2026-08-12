/**
 * POST /api/wallets/track
 * Track a smart wallet for activity monitoring
 */

const { supabase } = require("../../lib/supabase");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const { walletAddress, label, description } = req.body;

    if (!walletAddress || walletAddress.length < 32) {
      return res.status(400).json({ error: "Valid wallet address required" });
    }

    // Create tracked_wallets table if it doesn't exist
    // Add wallet to tracking
    const { data, error } = await supabase
      .from("tracked_wallets")
      .upsert(
        {
          address: walletAddress,
          label: label || "Smart Wallet",
          description: description || "Tracked wallet",
          added_at: new Date().toISOString(),
        },
        { onConflict: "address" }
      );

    if (error) throw error;

    // Send Telegram notification
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = 5824497779;

    if (botToken) {
      const walletMessage = `👛 *WALLET TRACKED*

💰 Address: \`${walletAddress.slice(0, 20)}...\`
📌 Label: ${label || "Smart Wallet"}
📝 Note: ${description || "Monitoring wallet activity"}

━━━━━━━━━━━━━━━━━━━━━━━━

You'll now get alerts when this wallet:
✅ Buys tokens you're watching
✅ Sells positions
✅ Exits trades

This helps you learn from smart money moves! 🧠`;

      await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: walletMessage,
            parse_mode: "Markdown",
          }),
        }
      );
    }

    return res.status(200).json({
      success: true,
      message: `Now tracking wallet: ${label || "Smart Wallet"}`,
      wallet: {
        address: walletAddress,
        label,
      },
    });
  } catch (error) {
    console.error("Wallet track error:", error);
    return res.status(500).json({ error: error.message });
  }
};
