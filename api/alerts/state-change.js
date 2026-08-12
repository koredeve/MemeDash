/**
 * POST /api/alerts/state-change
 * Send alert when a token changes state
 * Example: Watch Closely → Clean, Avoid → Watch, etc.
 */

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || 5824497779;

  if (!botToken) {
    return res.status(400).json({ error: "TELEGRAM_BOT_TOKEN not set" });
  }

  try {
    const {
      tokenAddress,
      symbol,
      score,
      previousStatus,
      currentStatus,
      verdict,
    } = req.body;

    if (!tokenAddress || !currentStatus) {
      return res.status(400).json({ error: "tokenAddress and currentStatus required" });
    }

    // Format emoji based on status
    const statusEmoji = {
      clean: "✨",
      watch: "🔔",
      avoid: "⚠️",
      neutral: "❓",
    };

    // Only send alert if there's a meaningful change
    const stateImprovements = {
      avoid: ["watch", "clean"],
      watch: ["clean"],
      neutral: ["watch", "clean"],
    };

    const previousEmoji = statusEmoji[previousStatus] || "❓";
    const currentEmoji = statusEmoji[currentStatus] || "❓";

    let shouldAlert = false;
    let alertType = "";

    if (!previousStatus) {
      // New token
      alertType = "New token found";
      shouldAlert = currentStatus === "clean" || currentStatus === "watch";
    } else if (previousStatus !== currentStatus) {
      // Status changed
      if (
        stateImprovements[previousStatus]?.includes(currentStatus)
      ) {
        alertType = `${previousEmoji} ${previousStatus} → ${currentEmoji} ${currentStatus}`;
        shouldAlert = true;
      } else if (currentStatus === "clean") {
        alertType = `Upgraded to ${currentEmoji} Clean`;
        shouldAlert = true;
      }
    }

    if (!shouldAlert) {
      return res.status(200).json({
        success: true,
        message: "No alert needed",
        reason: `Status ${previousStatus} → ${currentStatus}`,
      });
    }

    const message = `${currentEmoji} *${alertType}*

🔹 Token: $${symbol || "TOKEN"}
🔗 Address: \`${tokenAddress.slice(0, 8)}...\`
📊 Score: *${score}/100* (${verdict})
🎯 Status: ${currentStatus.toUpperCase()}

👉 [View on DexScreener](https://dexscreener.com/solana/${tokenAddress})`;

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      }
    );

    const data = await response.json();

    if (!data.ok) {
      return res.status(400).json({
        error: "Failed to send alert",
        telegram_error: data.description,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Alert sent",
      alertType,
      messageId: data.result.message_id,
    });
  } catch (error) {
    console.error("Alert error:", error);
    return res.status(500).json({ error: error.message });
  }
};
