# Email Configuration Verification Guide

## ✅ Step-by-Step Verification

### Step 1: Check Your `.env.local` File

Your `.env.local` file has been created with email placeholders. Here's what's there now:

```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com          # ← Change this to your Gmail
EMAIL_PASSWORD=your-app-password-here    # ← Change this to your App Password
EMAIL_FROM_EMAIL=your-email@gmail.com    # ← Should match EMAIL_USER
EMAIL_FROM_NAME=GCP Central
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

### Step 2: Set Up Gmail (If Using Gmail)

#### Option A: Using Gmail (Recommended for Development)

**Why App Password instead of regular password?**
- ✅ More secure (limited access)
- ✅ Doesn't break if you change Gmail password
- ✅ Can be revoked without affecting your account
- ✅ Nodemailer requires it for Gmail

**How to Get Gmail App Password:**

1. **Enable 2-Step Verification** (required for App Passwords)
   - Go to: https://myaccount.google.com/security
   - Sign in if prompted
   - Click "2-Step Verification" on the left
   - Follow the setup instructions
   - Come back to this guide

2. **Generate App Password**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer"
   - Click "Generate"
   - Copy the 16-character password that appears

3. **Update `.env.local`**
   ```env
   EMAIL_SERVICE=gmail
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=xxxx xxxx xxxx xxxx    # Paste the 16-char password (remove spaces)
   EMAIL_FROM_EMAIL=your-email@gmail.com
   EMAIL_FROM_NAME=GCP Central
   ```

4. **Important Notes**
   - Remove the spaces from the password
   - Example: `xabc defg hijk lmno` → `xabcdefghijklmno`
   - Use exactly what Google gives you (without spaces)
   - Never commit this to Git!

---

#### Option B: Using Custom SMTP Provider

If you want to use a different email provider (SendGrid, Mailgun, etc.):

```env
EMAIL_SERVICE=custom
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_USER=your-email@provider.com
EMAIL_PASSWORD=your-password
EMAIL_FROM_EMAIL=noreply@your-company.com
EMAIL_FROM_NAME=GCP Central
```

Get these details from your email provider's settings.

---

### Step 3: Verify Configuration Online

Now let's test your setup!

**Start your dev server:**
```bash
npm run dev
```

**Visit the verification endpoint:**
Open your browser and go to:
```
http://localhost:3000/api/verify-email-config
```

**You should see a JSON response like:**

✅ **If Configuration is Correct:**
```json
{
  "success": true,
  "message": "Email configuration is valid and ready to use",
  "status": "READY",
  "environment": {
    "emailService": "gmail",
    "emailUser": "your-email@gmail.com",
    "emailFrom": "your-email@gmail.com",
    "appUrl": "http://localhost:3000"
  }
}
```

❌ **If There's an Error:**
```json
{
  "success": false,
  "message": "Error: Authentication failed. Invalid credentials.",
  "status": "FAILED",
  "environment": { ... }
}
```

---

### Step 4: Check Server Console Output

While visiting the verification page, check your terminal where you ran `npm run dev`.

You should see detailed output like:

```
======================================================================
EMAIL CONFIGURATION VERIFICATION
======================================================================

📋 CHECKING ENVIRONMENT VARIABLES:

  ✅ EMAIL_SERVICE: gmail
  ✅ EMAIL_USER: your-email@gmail.com
  ✅ EMAIL_PASSWORD: ***hidden***
  ✅ EMAIL_FROM_EMAIL: your-email@gmail.com
  ✅ EMAIL_FROM_NAME: GCP Central
  ✅ NEXT_PUBLIC_APP_URL: http://localhost:3000

📧 GMAIL APP PASSWORD CHECK:

  ✅ Password length looks like an App Password (16+ characters)

🔌 TESTING EMAIL SERVICE CONNECTION:

  ✅ EMAIL SERVICE CONNECTED SUCCESSFULLY!
     Message: Email configuration is valid and ready to use

======================================================================
VERIFICATION COMPLETE
======================================================================
```

---

### Step 5: Send a Test Email (Optional)

To send an actual test email:

1. **Edit the verification script**
   - Open: [app/api/verify-email-config/route.ts](app/api/verify-email-config/route.ts)
   - Find the "MANUAL TEST EMAIL SENDING" section (near bottom)
   - Uncomment the code
   - Change `'your-email@gmail.com'` to an email where you can receive messages

2. **Save and visit the endpoint again**
   ```
   http://localhost:3000/api/verify-email-config
   ```

3. **Check your email**
   - You should receive a test email within 30 seconds
   - Subject: "GCP Central - Email Configuration Test"

4. **If email arrives: ✅ Everything is working!**

---

## 🔍 Troubleshooting

### Problem: "Authentication failed. Invalid credentials."

**Most Common Causes:**

1. **Using regular Gmail password instead of App Password**
   - ❌ Wrong: Your regular Gmail password
   - ✅ Correct: 16-character App Password from https://myaccount.google.com/apppasswords

2. **Password has spaces still in it**
   - ❌ Wrong: `xxxx xxxx xxxx xxxx`
   - ✅ Correct: `xxxxxxxxxxxxxxxx`

3. **2-Step Verification not enabled**
   - Ensure 2-Step Verification is ON at https://myaccount.google.com/security

4. **Wrong email address in EMAIL_USER**
   - Make sure it matches your Gmail exactly (case-sensitive)

**Solution:**
```bash
# 1. Double-check your App Password from Google
# 2. Update .env.local
# 3. Restart npm run dev
# 4. Visit verification endpoint again
```

---

### Problem: "Connection timeout" or "SMTP error"

**Causes:**
- Network issue
- Gmail server temporarily down
- Firewall blocking SMTP

**Solutions:**
1. Wait a few minutes and try again
2. Check your internet connection
3. Try from a different network if possible
4. Switch to custom SMTP provider

---

### Problem: Email sends but arrives in spam

**Why it happens:**
- New sender reputation is low
- DKIM/SPF not configured
- Test emails from localhost

**Solutions:**
1. Check spam folder
2. Mark as "Not Spam"
3. Deploy to production (better reputation)
4. Configure DKIM/SPF records for your domain

---

### Problem: ".env.local is not loading"

**Causes:**
- File not in right location
- Typos in variable names
- Next.js cache issue

**Solutions:**
```bash
# Restart the dev server
npm run dev

# Or clear cache and restart
rm -rf .next
npm run dev
```

---

## 📋 Verification Checklist

Before using emails in your app:

- [ ] `.env.local` exists in project root
- [ ] `EMAIL_SERVICE` is set to `gmail` or `custom`
- [ ] `EMAIL_USER` is your email address
- [ ] `EMAIL_PASSWORD` is your App Password (16 chars, no spaces)
- [ ] `EMAIL_FROM_EMAIL` matches `EMAIL_USER`
- [ ] `NEXT_PUBLIC_APP_URL` is set correctly
- [ ] `npm run dev` is running
- [ ] Verification endpoint shows `"success": true`
- [ ] Server console shows ✅ for all checks
- [ ] (Optional) Test email received successfully

---

## 🧪 Quick Test Command

Once everything is set up, test in Node.js console:

```javascript
// In browser console while dev server is running
fetch('http://localhost:3000/api/verify-email-config')
  .then(r => r.json())
  .then(data => console.log(JSON.stringify(data, null, 2)))
```

---

## 📝 Configuration Summary

### Gmail (Recommended for Development)

```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
EMAIL_FROM_EMAIL=your-gmail@gmail.com
EMAIL_FROM_NAME=GCP Central
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Custom SMTP (Production)

```env
EMAIL_SERVICE=custom
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_USER=your-email@your-domain.com
EMAIL_PASSWORD=your-provider-password
EMAIL_FROM_EMAIL=noreply@your-domain.com
EMAIL_FROM_NAME=GCP Central
NEXT_PUBLIC_APP_URL=https://your-production-url.com
```

---

## ✅ When You See This, You're Ready!

```
🔌 TESTING EMAIL SERVICE CONNECTION:

  ✅ EMAIL SERVICE CONNECTED SUCCESSFULLY!
     Message: Email configuration is valid and ready to use
```

---

## 📚 Related Guides

- [NODEMAILER_SETUP.md](NODEMAILER_SETUP.md) - Complete Nodemailer setup
- [ENGAGEMENT_EMAIL_SUMMARY.md](ENGAGEMENT_EMAIL_SUMMARY.md) - Using emails in your app
- [ENGAGEMENT_EMAIL_QUICK_REF.md](ENGAGEMENT_EMAIL_QUICK_REF.md) - Quick reference

---

## 🆘 Still Having Issues?

1. **Check all variables are set** - No typos, all required vars present
2. **Restart dev server** - `Ctrl+C` then `npm run dev`
3. **Clear Next.js cache** - `rm -rf .next && npm run dev`
4. **Check server logs** - Console should show detailed error messages
5. **Visit verification endpoint** - `http://localhost:3000/api/verify-email-config`
6. **Review error message carefully** - It usually tells you exactly what's wrong

If stuck, check the "Troubleshooting" section above or review the detailed setup in [NODEMAILER_SETUP.md](NODEMAILER_SETUP.md).
