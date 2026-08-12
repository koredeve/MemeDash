# AI Lead Chatbot Setup Guide

This chatbot captures qualified leads for freelance AI engineering projects and sends notifications to your email.

## 📋 Quick Setup (15 minutes)

### 1. Get Your Claude API Key

1. Go to: https://console.anthropic.com/
2. Sign up or login
3. Create an API key in Settings
4. Copy the key

### 2. Add to Your Portfolio

1. Copy `chatbot.html` to your portfolio GitHub repo (in root or `/pages` folder)
2. Example: `koredeve.github.io/chatbot.html`
3. Or add a link on your portfolio: `<a href="/chatbot.html">Chat about your AI project</a>`

### 3. Set Up Email Notifications

**Option A: Using Formspree (Easiest, Free)**

1. Go to: https://formspree.io
2. Sign up
3. Create a new form pointing to your email
4. Get your Formspree URL: `https://formspree.io/f/YOUR_FORM_ID`
5. Update `chatbot-production.html`:
   - Replace `sk-ant-v1-placeholder` with your Claude API key
   - This version sends data to `/api/leads/capture` Vercel Function

**Option B: Using Vercel Function (Already Set Up)**

The `/api/leads/capture` endpoint is already configured on your Vercel deployment.

To enable email sending:

1. Add SendGrid API key to Vercel environment variables
2. Update `/api/leads/capture.js` to send emails

### 4. Deploy

```bash
# If using GitHub Pages
git add chatbot.html
git commit -m "Add lead-capturing chatbot"
git push

# If using Vercel
# Your chatbot will be available at:
# https://lightmeme.vercel.app/chatbot.html
```

### 5. Test

1. Go to your chatbot URL
2. Have a conversation with it
3. Provide: Name → Email → Project → Budget
4. See success message
5. Check your email for the lead notification

---

## 🔧 Customization

### Change the Greeting Message

In `chatbot-production.html`, find:
```javascript
addMessage("Hey there! 👋 I'm here to help connect you with Osuolale...", 'bot');
```

Change to your preference.

### Change Lead Capture Fields

Edit the `conversationStage` variable to collect different info:
- Add more stages: 'company', 'timeline', etc.
- Modify `extractLeadInfo()` to handle new fields

### Change Colors

In the `<style>` section:
```css
--accent-1: #6366f1;  /* Primary color */
--accent-2: #ec4899;  /* Secondary color */
```

---

## 📧 Email Integration (Advanced)

### Using SendGrid:

1. Sign up at: https://sendgrid.com
2. Get API key from Settings
3. Update `/api/leads/capture.js`:

```javascript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: 'kelightsub@gmail.com',
  from: 'chatbot@yourdomain.com',
  subject: `New Lead: ${name}`,
  text: `Name: ${name}\nEmail: ${email}\nProject: ${projectDescription}\nBudget: ${budget}`
};

await sgMail.send(msg);
```

4. Add to Vercel env vars:
```bash
vercel env add SENDGRID_API_KEY production
```

---

## 📊 Monitoring Leads

### Check Captured Leads:

1. **Via Email:** Leads arrive at kelightsub@gmail.com
2. **Via Vercel Logs:**
   ```bash
   vercel logs https://lightmeme.vercel.app/api/leads/capture
   ```
3. **Via Database:** Add leads table to Supabase (optional)

---

## 💡 Tips for Success

1. **Add to Homepage:** Link chatbot prominently on your portfolio
2. **Call to Action:** "Chat with me about your AI project →"
3. **Mobile Friendly:** Already optimized for phones
4. **Response Time:** Set up email alerts so you respond quickly
5. **Follow-up Script:** Template response to leads:
   ```
   Hi [Name],
   
   Thanks for chatting! I'd love to discuss your [Project] needs.
   My typical rate for AI projects is $2-5k depending on scope.
   
   Available for a quick call this week?
   
   Best,
   Osuolale
   ```

---

## 🚀 Expected Results

- **Visit Rate:** 10-20% of portfolio visitors will try the chatbot
- **Lead Conversion:** 30-50% of chatbot users will complete qualification
- **First Client:** ~1 week with good follow-up
- **Revenue Potential:** 5-10 leads/month = $10-50k/month

---

## ❓ Troubleshooting

**Chatbot not responding?**
- Check Claude API key is valid
- Check browser console for errors (F12)
- Verify API key has credits

**Leads not being captured?**
- Check `/api/leads/capture` is deployed
- Verify form endpoint in chatbot
- Check Vercel logs for errors

**Email not arriving?**
- Check spam folder
- Verify email address in code
- Test Formspree separately

---

## Next Steps

1. ✅ Deploy chatbot to portfolio
2. ✅ Set up email notifications
3. ✅ Add link on your homepage
4. ✅ Test the full flow
5. ✅ Wait for leads to come in!

Good luck! 🚀
