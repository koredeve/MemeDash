/**
 * GET /api/telegram/test-alert
 * Send a test alert to verify Telegram integration works
 */

module.exports = async (req, res) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = 5824497779; // Your Telegram ID

  if (!botToken) {
    return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN not set' });
  }

  const testMessage = `✅ *MemeDash is WORKING!*

🚀 Backend: Connected
📱 Telegram: Connected
🎯 Your ID: ${chatId}

🔔 You will now receive real-time memecoin alerts.

Commands:
/add <symbol> - Add to watchlist
/watchlist - View watched tokens
/rules - View alert settings
/history - Recent alerts`;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: testMessage,
          parse_mode: 'Markdown'
        })
      }
    );

    const data = await response.json();

    if (!data.ok) {
      return res.status(400).json({
        error: 'Failed to send message',
        telegram_error: data.description
      });
    }

    res.status(200).json({
      success: true,
      message: 'Test alert sent to your Telegram',
      message_id: data.result.message_id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
