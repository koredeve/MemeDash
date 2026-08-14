const { supabase } = require('../../lib/supabase');
const { sendAlert } = require('../../lib/scanner-poller');

/**
 * POST /api/telegram/webhook
 * Receive and process Telegram bot commands
 */
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, callback_query } = req.body;

    // Handle callback query (button clicks in Telegram)
    if (callback_query) {
      const userId = callback_query.from.id;
      const chatId = callback_query.from.id;
      const firstName = callback_query.from.first_name;
      const lastName = callback_query.from.last_name || '';
      const data = callback_query.data;

      console.log(`[WEBHOOK] Callback query from ${firstName}: ${data}`);

      // Handle "Connect to MemeDash" button
      if (data === 'connect_memedash') {
        try {
          // Save connection to database via consolidated auth endpoint
          const connectResponse = await fetch(
            'https://lightmeme.vercel.app/api/telegram/auth',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: userId,
                first_name: firstName,
                last_name: lastName,
                chat_id: chatId,
                bot_token: process.env.TELEGRAM_BOT_TOKEN,
              }),
            }
          );

          const connectData = await connectResponse.json();

          if (connectData.success) {
            // Send confirmation message
            await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: `✅ ${connectData.message}\n\nYou're all set! Token alerts will appear here automatically.`,
                parse_mode: 'Markdown',
              }),
            });

            // Answer the callback query
            await fetch(
              `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  callback_query_id: callback_query.id,
                  text: '✅ Connected to MemeDash!',
                  show_alert: false,
                }),
              }
            );
          }
        } catch (error) {
          console.error('[WEBHOOK] Connection error:', error);
        }
      }

      return res.status(200).json({ success: true });
    }

    // Handle text messages
    if (!message || !message.chat || !message.from) {
      return res.status(400).json({ error: 'Invalid telegram message format' });
    }

    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text || '';
    const args = text.split(' ');
    const command = args[0]?.replace('/', '').toLowerCase();

    // Get or create user record
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', userId)
      .single();

    if (userError && userError.code === 'PGRST116') {
      // User doesn't exist, create
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          telegram_id: userId,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) throw createError;
      user = newUser;
    } else if (userError) {
      throw userError;
    }

    // Route commands
    switch (command) {
      case 'start':
        await handleStart(chatId);
        break;
      case 'add':
        await handleAdd(chatId, user.id, args[1], args.slice(2).join(' '));
        break;
      case 'remove':
        await handleRemove(chatId, user.id, args[1]);
        break;
      case 'watchlist':
        await handleWatchlist(chatId, user.id);
        break;
      case 'rules':
        await handleRules(chatId, user.id);
        break;
      case 'setrule':
        await handleSetRule(chatId, user.id, args.slice(1));
        break;
      case 'history':
        await handleHistory(chatId, user.id);
        break;
      case 'pause':
        await handlePause(chatId, user.id);
        break;
      case 'resume':
        await handleResume(chatId, user.id);
        break;
      default:
        await sendTelegramMessage(chatId, 'Unknown command. Type /start for help.');
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

async function handleStart(chatId) {
  const message = `
Welcome to MemeDash! 🚀

I'm your real-time memecoin alert bot.

Commands:
/add <symbol> - Add token to watchlist
/remove <symbol> - Remove from watchlist
/watchlist - Show your watchlist
/rules - View alert rules
/setrule <setting> <value> - Configure alerts
/history - Recent alerts
/pause - Pause alerts
/resume - Resume alerts

Let's find the next moonshot! 🌙
  `;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken) {
    // Send message with connect button
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🔗 Connect to MemeDash',
                callback_data: 'connect_memedash',
              },
            ],
          ],
        },
      }),
    });
  } else {
    await sendTelegramMessage(chatId, message);
  }
}

async function handleAdd(chatId, userId, symbol, notes) {
  if (!symbol) {
    await sendTelegramMessage(chatId, '❌ Usage: /add <symbol>');
    return;
  }

  // Find token by symbol
  const { data: tokens } = await supabase
    .from('tokens')
    .select('*')
    .ilike('symbol', `%${symbol}%`)
    .limit(1);

  if (!tokens || tokens.length === 0) {
    await sendTelegramMessage(chatId, `❌ Token $${symbol} not found in recent scans`);
    return;
  }

  const token = tokens[0];
  const { error } = await supabase
    .from('watchlist')
    .insert({
      user_id: userId,
      token_mint: token.mint,
      source: 'telegram',
      notes: notes || null
    });

  if (error) {
    if (error.code === '23505') {
      await sendTelegramMessage(chatId, `⚠️ $${token.symbol} already in watchlist`);
    } else {
      throw error;
    }
  } else {
    await sendTelegramMessage(chatId, `✅ Added $${token.symbol} to watchlist`);
  }
}

async function handleRemove(chatId, userId, symbol) {
  if (!symbol) {
    await sendTelegramMessage(chatId, '❌ Usage: /remove <symbol>');
    return;
  }

  const { data: watchlist, error: fetchError } = await supabase
    .from('watchlist')
    .select('id, token_mint, tokens(symbol)')
    .eq('user_id', userId)
    .ilike('tokens.symbol', `%${symbol}%`)
    .single();

  if (fetchError) {
    await sendTelegramMessage(chatId, `❌ $${symbol} not found in watchlist`);
    return;
  }

  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('id', watchlist.id);

  if (error) throw error;

  await sendTelegramMessage(chatId, `✅ Removed $${symbol} from watchlist`);
}

async function handleWatchlist(chatId, userId) {
  const { data: watchlist } = await supabase
    .from('watchlist')
    .select('tokens(symbol, score)')
    .eq('user_id', userId);

  if (!watchlist || watchlist.length === 0) {
    await sendTelegramMessage(chatId, '📭 Your watchlist is empty');
    return;
  }

  let message = '📋 Your Watchlist:\n\n';
  watchlist.forEach((item, i) => {
    message += `${i + 1}. $${item.tokens.symbol} (Score: ${item.tokens.score}/100)\n`;
  });

  await sendTelegramMessage(chatId, message);
}

async function handleRules(chatId, userId) {
  const { data: rules } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('user_id', userId);

  if (!rules || rules.length === 0) {
    await sendTelegramMessage(chatId, '⚙️ No alert rules configured');
    return;
  }

  const rule = rules[0];
  const message = `
⚙️ Alert Rules:

Min Score: ${rule.min_score}/100
Min Liquidity: $${(rule.min_liquidity / 1000).toFixed(0)}k
Max Age: ${rule.max_age_minutes}m
Enabled: ${rule.enabled ? '✅' : '❌'}

Use /setrule to change settings
  `;

  await sendTelegramMessage(chatId, message);
}

async function handleSetRule(chatId, userId, args) {
  if (args.length < 2) {
    await sendTelegramMessage(chatId, '❌ Usage: /setrule <setting> <value>');
    return;
  }

  const setting = args[0].toLowerCase();
  const value = args[1];

  const updateData = {};
  if (setting === 'minscore') updateData.min_score = parseInt(value);
  else if (setting === 'minliquidity') updateData.min_liquidity = parseInt(value) * 1000;
  else if (setting === 'maxage') updateData.max_age_minutes = parseInt(value);
  else {
    await sendTelegramMessage(chatId, '❌ Unknown setting. Try: minscore, minliquidity, maxage');
    return;
  }

  const { data: rules } = await supabase
    .from('alert_rules')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!rules) {
    await sendTelegramMessage(chatId, '⚠️ No alert rules found. Configure via dashboard.');
    return;
  }

  const { error } = await supabase
    .from('alert_rules')
    .update(updateData)
    .eq('id', rules.id);

  if (error) throw error;

  await sendTelegramMessage(chatId, `✅ Updated ${setting} to ${value}`);
}

async function handleHistory(chatId, userId) {
  const { data: history } = await supabase
    .from('alert_history')
    .select('*')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
    .limit(10);

  if (!history || history.length === 0) {
    await sendTelegramMessage(chatId, '📭 No alert history');
    return;
  }

  let message = '📊 Recent Alerts:\n\n';
  history.forEach((alert, i) => {
    message += `${i + 1}. $${alert.token_symbol} (Score: ${alert.score})\n`;
  });

  await sendTelegramMessage(chatId, message);
}

async function handlePause(chatId, userId) {
  const { data: rules } = await supabase
    .from('alert_rules')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!rules) {
    await sendTelegramMessage(chatId, '⚠️ No alert rules found.');
    return;
  }

  await supabase
    .from('alert_rules')
    .update({ enabled: false })
    .eq('id', rules.id);

  await sendTelegramMessage(chatId, '⏸️ Alerts paused');
}

async function handleResume(chatId, userId) {
  const { data: rules } = await supabase
    .from('alert_rules')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!rules) {
    await sendTelegramMessage(chatId, '⚠️ No alert rules found.');
    return;
  }

  await supabase
    .from('alert_rules')
    .update({ enabled: true })
    .eq('id', rules.id);

  await sendTelegramMessage(chatId, '▶️ Alerts resumed');
}

async function sendTelegramMessage(chatId, text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.trim(),
        parse_mode: 'Markdown'
      })
    });

    if (!response.ok) {
      console.error('Failed to send telegram message:', await response.text());
    }
  } catch (error) {
    console.error('Telegram send error:', error);
  }
}
