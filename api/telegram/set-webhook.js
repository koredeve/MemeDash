/**
 * POST /api/telegram/set-webhook
 * Configure Telegram webhook
 * Call this ONCE to set up the webhook
 */

module.exports = async (req, res) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const webhookUrl = `https://lightmeme.vercel.app/api/telegram/webhook`;

  if (!botToken) {
    return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN not set' });
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl })
      }
    );

    const data = await response.json();

    if (!data.ok) {
      return res.status(400).json({ error: data.description });
    }

    res.status(200).json({
      success: true,
      message: 'Webhook configured',
      webhook_url: webhookUrl,
      telegram_response: data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
