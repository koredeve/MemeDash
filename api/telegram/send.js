const { supabase } = require('../../lib/supabase');

/**
 * POST /api/telegram/send
 * Send alert via Telegram (called by alert engine)
 */
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_id, token_mint, token_name, token_symbol, score, liquidity } = req.body;

    if (!user_id || !token_symbol) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get user's Telegram ID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('telegram_id')
      .eq('id', user_id)
      .single();

    if (userError || !user?.telegram_id) {
      return res.status(404).json({ error: 'User not found or not connected to Telegram' });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(500).json({ error: 'Bot token not configured' });
    }

    const chatId = user.telegram_id;

    // Format message
    const dexscreenerUrl = `https://dexscreener.com/solana/${token_mint}`;
    const pumpUrl = `https://pump.fun/${token_mint}`;

    const message = `
🚀 NEW OPPORTUNITY

$${token_symbol}
${token_name}

📊 Metrics:
• Score: ${score}/100
• Liquidity: $${(liquidity / 1000).toFixed(1)}k

🔍 Links:
[Dexscreener](${dexscreenerUrl}) | [Pump.fun](${pumpUrl})

⏰ ${new Date().toLocaleTimeString()}
    `;

    // Send via Telegram API
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message.trim(),
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Telegram API error: ${error}`);
    }

    res.status(200).json({
      success: true,
      message: 'Alert sent to Telegram'
    });
  } catch (error) {
    console.error('Error sending telegram alert:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
