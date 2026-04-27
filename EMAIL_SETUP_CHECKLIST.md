# ✅ Email Configuration Setup Checklist

## Quick Setup (5 minutes)

### 1. Get Your Gmail App Password
- [ ] Go to https://myaccount.google.com/security
- [ ] Enable "2-Step Verification" (if not already enabled)
- [ ] Go to https://myaccount.google.com/apppasswords
- [ ] Select "Mail" and "Windows Computer"
- [ ] Click "Generate"
- [ ] Copy the 16-character password shown

### 2. Update `.env.local`
- [ ] Open `.env.local` in your editor
- [ ] Find the `EMAIL_CONFIGURATION` section
- [ ] Replace `your-email@gmail.com` with your Gmail address
- [ ] Replace `xxxx-xxxx-xxxx-xxxx` with your App Password (remove hyphens/spaces)
- [ ] Make sure `EMAIL_FROM_EMAIL` matches your Gmail
- [ ] Save the file

**Your `EMAIL_PASSWORD` should look like:**
```
abc123defghijklmno  (16 characters, NO spaces)
```

NOT like this:
```
abc1 23de fghi jklm no  (with spaces - WRONG!)
```

### 3. Start Dev Server
```bash
npm run dev
```

### 4. Verify Configuration
- [ ] Open browser: http://localhost:3000/api/verify-email-config
- [ ] You should see: `"success": true`
- [ ] Check terminal for ✅ checkmarks
- [ ] If errors, see Troubleshooting below

### 5. Test Send Email (Optional)
- [ ] Edit [app/api/verify-email-config/route.ts](app/api/verify-email-config/route.ts)
- [ ] Uncomment the "MANUAL TEST EMAIL SENDING" section
- [ ] Change `your-email@gmail.com` to your email
- [ ] Save and refresh: http://localhost:3000/api/verify-email-config
- [ ] Check your email inbox (in 30 seconds or less)

---

## 🔍 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| `"Authentication failed"` | Make sure you're using App Password, not regular Gmail password |
| `"Missing email variables"` | Check all EMAIL_* variables are filled in .env.local |
| `.env.local not loading` | Restart `npm run dev` and wait for recompile |
| Email not received | Check spam folder; may take 30 seconds |
| `"Connection refused"` | Check internet connection; Gmail server may be down |

---

## ✅ Success Indicators

### Browser Shows:
```json
{
  "success": true,
  "status": "READY",
  "message": "Email configuration is valid and ready to use"
}
```

### Terminal Shows:
```
🔌 TESTING EMAIL SERVICE CONNECTION:
  ✅ EMAIL SERVICE CONNECTED SUCCESSFULLY!
```

### You Receive Test Email:
- Subject: "GCP Central - Email Configuration Test"
- From: "GCP Central" <your-email@gmail.com>

---

## 📍 Current Status

Check your `.env.local` to see current settings:

```env
EMAIL_SERVICE=gmail                         # Set to gmail or custom
EMAIL_USER=                                 # Your Gmail address
EMAIL_PASSWORD=                             # Your App Password
EMAIL_FROM_EMAIL=                           # Should match EMAIL_USER
NEXT_PUBLIC_APP_URL=http://localhost:3000   # Should be this for dev
```

---

## 🚀 Next Steps After Verification

Once verified ✅, you can:

1. **Test Engagement Booking Email**
   - Create an engagement slot with attendee emails
   - Book an engagement as a requestor
   - Verify attendees receive notification emails

2. **Use in Your App**
   - All email templates are ready to use
   - `sendEmail()` function works in any API route
   - Templates available for various actions

3. **Deploy to Production**
   - Update `NEXT_PUBLIC_APP_URL` to your production domain
   - Use your production email account
   - May want to use a different email service provider for production

---

## 📚 Related Documentation

- [EMAIL_VERIFICATION_GUIDE.md](EMAIL_VERIFICATION_GUIDE.md) - Detailed verification steps
- [NODEMAILER_SETUP.md](NODEMAILER_SETUP.md) - Complete Nodemailer setup
- [ENGAGEMENT_EMAIL_SUMMARY.md](ENGAGEMENT_EMAIL_SUMMARY.md) - Using emails in your app

---

## 💡 Tips

- **For Development:** Use your personal Gmail with App Password
- **For Production:** Use a dedicated email account (noreply@yourcompany.com)
- **Don't Commit:** `.env.local` should be in `.gitignore` ✅
- **Check Often:** Watch terminal for email sending logs during testing
- **Test Spam:** Engagement booking emails might go to spam initially (normal)

---

## ⏱️ Time Required

| Task | Time |
|------|------|
| Get Gmail App Password | 3 min |
| Update .env.local | 1 min |
| Start dev server | 1 min |
| Verify configuration | 1 min |
| Test email (optional) | 1 min |
| **Total** | **~7 min** |

---

**Once you see `"success": true`, your email is ready to use! 🎉**
