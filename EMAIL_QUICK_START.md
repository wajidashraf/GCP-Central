# 🚀 Email Verification - Start Here!

## What You Need to Do RIGHT NOW

### ⏱️ 2-Minute Quick Setup

```
Step 1: Get Gmail App Password
   ↓
https://myaccount.google.com/apppasswords
   (Select "Mail" and "Windows Computer", copy 16 chars)
   
Step 2: Update .env.local
   ↓
EMAIL_PASSWORD=your-16-char-password
   
Step 3: Start dev server
   ↓
npm run dev
   
Step 4: Verify
   ↓
http://localhost:3000/api/verify-email-config
   ↓
Should show: "success": true ✅
```

---

## Your Current `.env.local` Status

```env
EMAIL_SERVICE=gmail                              ✅ Set
EMAIL_USER=your-email@gmail.com                  ⚠️  CHANGE THIS
EMAIL_PASSWORD=xxxx-xxxx-xxxx-xxxx              ⚠️  CHANGE THIS
EMAIL_FROM_EMAIL=your-email@gmail.com            ⚠️  CHANGE THIS
EMAIL_FROM_NAME=GCP Central                     ✅ OK
NEXT_PUBLIC_APP_URL=http://localhost:3000        ✅ OK
```

---

## What to Change

| Variable | Current | Change To |
|----------|---------|-----------|
| `EMAIL_USER` | `your-email@gmail.com` | YOUR Gmail address |
| `EMAIL_PASSWORD` | `xxxx-xxxx-xxxx-xxxx` | Your 16-char App Password |
| `EMAIL_FROM_EMAIL` | `your-email@gmail.com` | Same as EMAIL_USER |

---

## Common Mistakes to Avoid

❌ **Wrong:**
- Using regular Gmail password
- Password has spaces: `xxxx xxxx xxxx xxxx`
- Different emails in EMAIL_USER and EMAIL_FROM_EMAIL
- Forgetting 2-Step Verification
- Not removing hyphens from password

✅ **Correct:**
- Using 16-character App Password
- Password with no spaces: `xxxxxxxxxxxxxxxx`
- EMAIL_USER = EMAIL_FROM_EMAIL = your Gmail
- 2-Step Verification is ON
- Just the password, no formatting

---

## How to Get App Password

1. Go to: https://myaccount.google.com/apppasswords
2. Select "Mail" in first dropdown
3. Select "Windows Computer" in second dropdown
4. Click "Generate"
5. Copy the 16-character password shown
6. Remove any spaces or hyphens
7. Paste into `EMAIL_PASSWORD` in `.env.local`

---

## Verification Results

### ✅ Success Response:
```json
{
  "success": true,
  "status": "READY",
  "message": "Email configuration is valid and ready to use"
}
```

### ❌ Failed Response:
```json
{
  "success": false,
  "status": "FAILED",
  "message": "Authentication failed. Invalid credentials."
}
```

**If you see FAILED:**
1. Double-check your App Password
2. Make sure 2-Step Verification is enabled
3. Verify EMAIL_USER is correct
4. Restart dev server
5. Try again

---

## What Happens When It Works

1. **Emails can be sent** to any recipient
2. **Engagement bookings** automatically notify attendees
3. **Request actions** can send notifications
4. **All templates** work (welcome, submission, approval, etc.)

---

## Files You Modified

- ✅ `.env.local` - Email configuration
- ✅ [app/api/verify-email-config/route.ts](app/api/verify-email-config/route.ts) - Verification endpoint (new)
- ✅ [lib/email/email-service.ts](../lib/email/email-service.ts) - Already set up
- ✅ [lib/email/email-templates.ts](../lib/email/email-templates.ts) - Already set up

---

## Files for Reference

| File | Purpose |
|------|---------|
| [EMAIL_SETUP_CHECKLIST.md](EMAIL_SETUP_CHECKLIST.md) | Detailed 5-min checklist |
| [EMAIL_VERIFICATION_GUIDE.md](EMAIL_VERIFICATION_GUIDE.md) | Complete verification guide |
| [NODEMAILER_SETUP.md](NODEMAILER_SETUP.md) | Full Nodemailer setup |
| [ENGAGEMENT_EMAIL_SUMMARY.md](ENGAGEMENT_EMAIL_SUMMARY.md) | Using emails in your app |

---

## Testing Your Setup

### Automatic Verification
```
Visit: http://localhost:3000/api/verify-email-config
```

### Send Test Email
1. Edit: [app/api/verify-email-config/route.ts](app/api/verify-email-config/route.ts)
2. Uncomment "MANUAL TEST EMAIL SENDING" section
3. Change email to yours
4. Visit: http://localhost:3000/api/verify-email-config
5. Check your inbox

### Use in Real Feature
1. Create engagement slot with attendees
2. Book engagement as requestor
3. Attendees receive email notification

---

## You're Good When ✅

- [ ] Verification endpoint shows `"success": true`
- [ ] Server logs show `✅ EMAIL SERVICE CONNECTED`
- [ ] Test email received (optional)
- [ ] No errors in terminal

---

## 🎯 Next: Real Features

Once verified, these features work:

1. **Engagement Booking Emails** ✅
   - Notify attendees when booked
   - Include request details

2. **Request Submission Emails** (can add)
   - Notify reviewers of new request

3. **Approval/Rejection Emails** (can add)
   - Notify requestor of decision

4. **Custom Emails** (can add)
   - Any time, any reason

---

## 📞 Quick Help

**Email not sending?**
- Check `.env.local` variables
- Verify at endpoint
- Check server logs
- See Troubleshooting in EMAIL_VERIFICATION_GUIDE.md

**Still stuck?**
- Run verification endpoint
- Check all variables are filled
- Restart `npm run dev`
- Review error message carefully

---

## ⏱️ Time Check

- **Get App Password:** 3 min
- **Update .env.local:** 1 min
- **Verify:** 1 min
- **Total:** ~5 min ✅

---

**Start with Step 1 above. You'll be done in 5 minutes! 🚀**
