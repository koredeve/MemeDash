/**
 * POST /api/leads/capture
 * Captures chatbot lead data and sends email notification
 */

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, email, projectDescription, budget } = req.body;

    // Validate required fields
    if (!name || !email || !projectDescription || !budget) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Send email via your preferred service
    // For now, log the lead (in production, integrate with SendGrid, Mailgun, etc.)

    console.log('🎯 NEW LEAD CAPTURED:', {
      name,
      email,
      projectDescription,
      budget,
      timestamp: new Date().toISOString(),
      sourceUrl: req.headers.referer
    });

    // TODO: Integrate with SendGrid or similar
    // Example:
    // await sendEmailViaService({
    //   to: 'kelightsub@gmail.com',
    //   subject: `New Lead: ${name}`,
    //   body: `Name: ${name}\nEmail: ${email}\nProject: ${projectDescription}\nBudget: ${budget}`
    // });

    return res.status(200).json({
      success: true,
      message: 'Lead captured successfully',
      leadId: `lead_${Date.now()}`
    });
  } catch (error) {
    console.error('[LEADS] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
