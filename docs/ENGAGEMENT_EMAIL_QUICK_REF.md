# Quick Reference - Engagement Booking Email Feature

## 🎯 What Happens

```
Requestor Books Engagement → Email to Attendees ✉️
```

When a requestor selects a slot and books an engagement, all attendees listed in that slot automatically receive a professional email notification.

---

## 📧 Email Includes

```
✓ Requestor Name & Company
✓ Engagement Type (Virtual/In-Person)
✓ Location (if in-person)
✓ Date & Time (nicely formatted)
✓ Request Details (No, Title, Type)
✓ Link to View Engagement
```

---

## 🔧 How to Set Up

### 1. Environment Variables (Already Done)
```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=app-password
EMAIL_FROM_EMAIL=your-email@gmail.com
EMAIL_FROM_NAME=GCP Central
NEXT_PUBLIC_APP_URL=https://your-app.com
```

### 2. Add Attendees to Engagement Slot (Admin)
1. Admin → Engagement Slots
2. Create/Edit a slot
3. Add attendee emails:
   ```
   reviewer@example.com,supervisor@example.com
   ```

### 3. Test Booking (Requestor)
1. Open a request
2. Click "Book Engagement"
3. Select slot with attendees
4. Fill details and confirm
5. ✅ Attendees receive emails

---

## 📁 Key Files

| File | Changes | Purpose |
|------|---------|---------|
| `lib/email/email-templates.ts` | + New function | Email template |
| `app/api/requests/[id]/book-engagement/route.ts` | + Logic | Email sending on booking |
| `ENGAGEMENT_BOOKING_EMAIL_GUIDE.ts` | New file | Detailed guide |
| `ENGAGEMENT_EMAIL_SUMMARY.md` | New file | Summary (this doc) |

---

## 🔄 Email Sending Flow

```
Book Engagement (POST)
  ↓
Lock Slot
  ↓
Create Engagement
  ↓
Update Request Status
  ↓
sendEngagementNotifications()
  ├─ Get slot attendees
  ├─ Get request details
  ├─ Get requestor info
  └─ Send email to each attendee
      ├─ Validate email
      ├─ Generate HTML
      ├─ Send via Nodemailer
      └─ Log result
  ↓
Return Success (201)
```

---

## 💻 Code Usage

### Get Email Template
```typescript
import { getEngagementBookingTemplate, htmlToPlainText } from "@/lib/email/email-templates";

const html = getEngagementBookingTemplate(
  "Attendee Name",
  "Requestor Name",
  "Company Name",
  "virtual", // or "in_person"
  "Board Room A", // location or null
  "REQ-001",
  "Request Title",
  "JVP",
  startDate,
  endDate,
  "https://app.com/engagement/123"
);
```

### Send Email
```typescript
import { sendEmail } from "@/lib/email/email-service";

await sendEmail({
  to: "attendee@example.com",
  subject: "Engagement Scheduled",
  html,
  text: htmlToPlainText(html),
});
```

---

## ⚡ Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Emails not sending | Check .env.local credentials |
| Gmail error | Use App Password, not regular password |
| No attendees on slot | Add emails when creating slot |
| Email format wrong | Check attendees are valid emails |
| Engagement creates but no email | Check server logs for errors |

---

## 🔒 Error Safety

- ✅ Email fails → Engagement still created
- ✅ One attendee fails → Continue to others
- ✅ Non-blocking → User not affected
- ✅ Logged → Check console for issues

---

## 📊 Attendee Email Format

```javascript
// In EngagementSlot model
attendees: [
  "email1@example.com",
  "email2@example.com",
  "email3@example.com"
]

// Each gets individual email with engagement details
```

---

## ✅ Verification Checklist

Before going live:

- [ ] Email credentials set in .env.local
- [ ] Gmail app password configured (if using Gmail)
- [ ] Engagement slots created with attendee emails
- [ ] Test booking with sample engagement
- [ ] Check attendee receives email
- [ ] Verify email has all details
- [ ] Check email styling looks good

---

## 🎨 Email Template Features

- ✅ Professional HTML design
- ✅ Brand color gradient header
- ✅ Responsive layout
- ✅ Formatted dates/times
- ✅ Conditional location display
- ✅ Button for quick action
- ✅ Footer with company info
- ✅ Plain text fallback

---

## 📞 Getting Help

1. **General Nodemailer issues** → See [NODEMAILER_SETUP.md](NODEMAILER_SETUP.md)
2. **Engagement booking details** → See [ENGAGEMENT_BOOKING_EMAIL_GUIDE.ts](ENGAGEMENT_BOOKING_EMAIL_GUIDE.ts)
3. **Full summary** → See [ENGAGEMENT_EMAIL_SUMMARY.md](ENGAGEMENT_EMAIL_SUMMARY.md)
4. **Server logs** → Run `npm run dev` and watch console

---

## 🚀 Ready to Use!

The feature is **fully implemented and production-ready**. Just set your email credentials and start booking engagements!
