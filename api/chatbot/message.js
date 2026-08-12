/**
 * POST /api/chatbot/message
 * Forward chatbot messages to OpenRouter API with secure key
 */

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) {
      console.error('Missing OPENROUTER_API_KEY environment variable');
      return res.status(500).json({ error: 'API key not configured' });
    }

    const systemPrompt = `You are a professional and friendly AI consulting chatbot for Osuolale Quyum (koredeve), an AI Engineer based in Africa.

EXPERTISE:
- Building AI-powered applications and chatbots
- LLM integrations (Claude, GPT, etc.)
- Automation systems
- Production-ready solutions
- Affordable for African startups and small businesses

PERSONALITY:
- Friendly, professional, and encouraging
- Short, clear responses (1-2 sentences max)
- Ask one question at a time
- Show genuine interest in their projects

Keep it conversational and natural. Be concise.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://koredeve.github.io',
        'X-Title': 'Osuolale AI Chatbot'
      },
      body: JSON.stringify({
        model: 'claude-3.5-sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 150
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenRouter error:', error);
      return res.status(response.status).json({ error: 'Failed to get response from AI' });
    }

    const data = await response.json();
    const botMessage = data.choices[0].message.content;

    return res.status(200).json({
      success: true,
      message: botMessage
    });
  } catch (error) {
    console.error('[CHATBOT] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
