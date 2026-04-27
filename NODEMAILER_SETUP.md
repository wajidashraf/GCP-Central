# Nodemailer Email Service Implementation Guide

## Overview

This guide explains how to use the Nodemailer email service for sending emails throughout your application. The implementation provides a reusable, flexible function that supports single/multiple recipients and pre-built email templates.

## Setup

### 1. Environment Variables

Add the following to your `.env.local` file:

```env
# Gmail Configuration (Option 1)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password  # Use Gmail App Password, NOT your regular password
EMAIL_FROM_EMAIL=your-email@gmail.com
EMAIL_FROM_NAME=GCP Central

# OR Custom SMTP Configuration (Option 2)
EMAIL_SERVICE=custom
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your-email@example.com
EMAIL_PASSWORD=your-password
EMAIL_FROM_EMAIL=noreply@example.com
EMAIL_FROM_NAME=GCP Central
```

### 2. Gmail App Password Setup

If using Gmail:
1. Enable 2-Factor Authentication on your Google account
2. Go to [Google Account Security](https://myaccount.google.com/security)
3. Find "App passwords" (under 2-Step Verification)
4. Select Mail and Windows Computer
5. Copy the generated password
6. Use this password in `EMAIL_PASSWORD` environment variable

## Usage Examples

### Basic Email (Single Recipient)

```typescript
import { sendEmail } from "@/lib/email/email-service";

const result = await sendEmail({
  to: "user@example.com",
  subject: "Welcome to GCP Central",
  html: "<h1>Welcome!</h1><p>Your account is ready.</p>",
});

if (result.success) {
  console.log("Email sent:", result.messageId);
} else {
  console.error("Failed to send email:", result.error);
}
```

### Email to Multiple Recipients

```typescript
import { sendEmail } from "@/lib/email/email-service";

const result = await sendEmail({
  to: ["user1@example.com", "user2@example.com", "user3@example.com"],
  subject: "Team Update",
  html: "<p>Important team announcement</p>",
});
```

### Email with Recipient Names

```typescript
import { sendEmail, type EmailRecipient } from "@/lib/email/email-service";

const recipients: EmailRecipient[] = [
  { email: "john@example.com", name: "John Doe" },
  { email: "jane@example.com", name: "Jane Smith" },
];

const result = await sendEmail({
  to: recipients,
  subject: "Meeting Invitation",
  html: "<p>You're invited to our meeting</p>",
});
```

### Email with CC and BCC

```typescript
import { sendEmail } from "@/lib/email/email-service";

const result = await sendEmail({
  to: "primary@example.com",
  cc: ["cc1@example.com", "cc2@example.com"],
  bcc: "admin@example.com",
  subject: "Project Update",
  html: "<p>Project status update</p>",
});
```

### Using Pre-built Templates

```typescript
import { sendEmail } from "@/lib/email/email-service";
import {
  getWelcomeEmailTemplate,
  getRequestSubmissionTemplate,
  getRequestApprovalTemplate,
  htmlToPlainText,
} from "@/lib/email/email-templates";

// Welcome Email
const welcomeHtml = getWelcomeEmailTemplate(
  "John", // User's first name
  "https://your-app.com/dashboard",
  "GCP Central"
);

const result = await sendEmail({
  to: "john@example.com",
  subject: "Welcome to GCP Central",
  html: welcomeHtml,
  text: htmlToPlainText(welcomeHtml), // Plain text fallback
});

// Request Submission Confirmation
const submissionHtml = getRequestSubmissionTemplate(
  "John",
  "REQ-2024-001",
  "Payment Authorization Request",
  "JVP",
  "https://your-app.com/dashboard",
  "GCP Central"
);

await sendEmail({
  to: { email: "john@example.com", name: "John Doe" },
  subject: "Request Submitted Successfully",
  html: submissionHtml,
  text: htmlToPlainText(submissionHtml),
});

// Request Approval
const approvalHtml = getRequestApprovalTemplate(
  "John",
  "REQ-2024-001",
  "Payment Authorization Request",
  "Manager Name",
  "https://your-app.com/dashboard/req-2024-001"
);

await sendEmail({
  to: "john@example.com",
  subject: "Your Request Has Been Approved",
  html: approvalHtml,
});
```

### Bulk Email

```typescript
import { sendBulkEmail } from "@/lib/email/email-service";
import { getWelcomeEmailTemplate, htmlToPlainText } from "@/lib/email/email-templates";

const recipients = [
  { email: "user1@example.com", name: "User One" },
  { email: "user2@example.com", name: "User Two" },
  { email: "user3@example.com", name: "User Three" },
];

const html = getWelcomeEmailTemplate(
  "Valued Customer",
  "https://your-app.com"
);

const result = await sendBulkEmail(
  recipients,
  "Welcome to Our Platform",
  html,
  htmlToPlainText(html)
);
```

### Custom Template

```typescript
import { sendEmail } from "@/lib/email/email-service";
import { getCustomTemplate, htmlToPlainText } from "@/lib/email/email-templates";

const html = getCustomTemplate(
  "Special Announcement",
  "We have an exciting announcement to share with you!",
  "Learn More",
  "https://your-app.com/announcement"
);

await sendEmail({
  to: ["user1@example.com", "user2@example.com"],
  subject: "Special Announcement",
  html,
  text: htmlToPlainText(html),
});
```

## Integration in API Routes

### Example: User Registration Endpoint

```typescript
// app/api/auth/register/route.ts
import { sendEmail } from "@/lib/email/email-service";
import { getWelcomeEmailTemplate, htmlToPlainText } from "@/lib/email/email-templates";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, firstName } = body;

    // Create user in database...
    // const user = await createUser({ email, firstName });

    // Send welcome email
    const welcomeHtml = getWelcomeEmailTemplate(
      firstName,
      "https://your-app.com/dashboard"
    );

    const emailResult = await sendEmail({
      to: email,
      subject: "Welcome to GCP Central",
      html: welcomeHtml,
      text: htmlToPlainText(welcomeHtml),
    });

    if (!emailResult.success) {
      console.error("Failed to send welcome email:", emailResult.error);
      // Continue anyway, don't fail the registration
    }

    return Response.json(
      { message: "User created successfully" },
      { status: 201 }
    );
  } catch (error) {
    return Response.json(
      { error: "Registration failed" },
      { status: 400 }
    );
  }
}
```

### Example: Request Submission Endpoint

```typescript
// app/api/requests/route.ts
import { sendEmail } from "@/lib/email/email-service";
import {
  getRequestSubmissionTemplate,
  getRequestReviewTemplate,
  htmlToPlainText,
} from "@/lib/email/email-templates";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, type, requesterEmail, requesterName, requestNo } = body;

    // Create request in database...
    // const newRequest = await createRequest({...});

    // Send confirmation to requester
    const submissionHtml = getRequestSubmissionTemplate(
      requesterName,
      requestNo,
      title,
      type,
      `https://your-app.com/requests/${requestNo}`
    );

    await sendEmail({
      to: requesterEmail,
      subject: "Request Submitted Successfully",
      html: submissionHtml,
      text: htmlToPlainText(submissionHtml),
    });

    // Send notification to reviewers
    // const reviewers = await getReviewersForType(type);
    // for (const reviewer of reviewers) {
    //   const reviewHtml = getRequestReviewTemplate(
    //     reviewer.name,
    //     requestNo,
    //     title,
    //     requesterName,
    //     `https://your-app.com/admin/reviews/${requestNo}`
    //   );
    //
    //   await sendEmail({
    //     to: reviewer.email,
    //     subject: "New Request Review Needed",
    //     html: reviewHtml,
    //     text: htmlToPlainText(reviewHtml),
    //   });
    // }

    return Response.json(
      { message: "Request created successfully" },
      { status: 201 }
    );
  } catch (error) {
    return Response.json(
      { error: "Request creation failed" },
      { status: 400 }
    );
  }
}
```

## Available Templates

### 1. `getWelcomeEmailTemplate()`
Sends welcome email to new users.

**Parameters:**
- `userFirstName` (string) - User's first name
- `appUrl` (string) - Link to the application
- `appName` (string, optional) - Application name

### 2. `getRequestSubmissionTemplate()`
Confirms request submission.

**Parameters:**
- `userFirstName` (string)
- `requestNo` (string) - Request number/ID
- `requestTitle` (string)
- `requestType` (string)
- `dashboardUrl` (string)
- `appName` (string, optional)

### 3. `getRequestReviewTemplate()`
Notifies reviewer of pending review.

**Parameters:**
- `reviewerName` (string)
- `requestNo` (string)
- `requestTitle` (string)
- `submitterName` (string)
- `reviewUrl` (string)
- `appName` (string, optional)

### 4. `getRequestApprovalTemplate()`
Notifies user of request approval.

**Parameters:**
- `userFirstName` (string)
- `requestNo` (string)
- `requestTitle` (string)
- `approverName` (string)
- `dashboardUrl` (string)
- `appName` (string, optional)

### 5. `getRequestRejectionTemplate()`
Notifies user of request rejection with feedback.

**Parameters:**
- `userFirstName` (string)
- `requestNo` (string)
- `requestTitle` (string)
- `rejectionReason` (string)
- `dashboardUrl` (string)
- `appName` (string, optional)

### 6. `getCustomTemplate()`
Generic template for custom messages.

**Parameters:**
- `subject` (string)
- `message` (string)
- `buttonText` (string, optional)
- `buttonUrl` (string, optional)
- `appName` (string, optional)

## Utility Functions

### `verifyEmailConfig()`
Verify that your email configuration is correct before deployment:

```typescript
import { verifyEmailConfig } from "@/lib/email/email-service";

const config = await verifyEmailConfig();
if (config.isValid) {
  console.log("Email configuration is valid!");
} else {
  console.error("Email configuration error:", config.message);
}
```

### `htmlToPlainText()`
Convert HTML email to plain text fallback:

```typescript
import { htmlToPlainText } from "@/lib/email/email-templates";

const plainText = htmlToPlainText(htmlContent);
```

## Best Practices

1. **Always provide both HTML and text versions**
   ```typescript
   await sendEmail({
     to: "user@example.com",
     subject: "Hello",
     html: htmlVersion,
     text: htmlToPlainText(htmlVersion),
   });
   ```

2. **Handle errors gracefully**
   ```typescript
   const result = await sendEmail({...});
   if (!result.success) {
     // Log error but don't break the application
     console.error("Email failed:", result.error);
     // Optionally: Store in a queue for retry
   }
   ```

3. **Don't block user operations on email sending**
   - Wrap email sending in a try-catch
   - Log failures but continue
   - Consider using background jobs for emails

4. **Use environment variables**
   - Never hardcode email addresses
   - Keep credentials in `.env.local`

5. **Test email configuration**
   ```typescript
   // During app startup
   const config = await verifyEmailConfig();
   if (!config.isValid) {
     console.warn("Email service not properly configured");
   }
   ```

6. **Customize templates**
   - Create custom templates in `lib/email/email-templates.ts`
   - Reuse common components
   - Keep styling consistent

## Troubleshooting

### Gmail SMTP Issues
- Use an **App Password**, not your regular password
- Ensure 2-Factor Authentication is enabled
- Check that "Less secure app access" is OFF (App Passwords handle this)

### Email Not Sending
1. Verify environment variables are set: `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM_EMAIL`
2. Check email credentials are correct
3. Verify `EMAIL_FROM_EMAIL` is the same as or authorized by `EMAIL_USER`
4. Review logs for detailed error messages
5. Test with `verifyEmailConfig()`

### Custom SMTP Issues
- Ensure `EMAIL_PORT` matches your provider (usually 587 or 465)
- Check `EMAIL_HOST` is correct
- Verify credentials with your email provider
- Some providers require specific sender addresses

## File Structure

```
lib/
├── email/
│   ├── email-service.ts      # Main email service (reusable functions)
│   ├── email-templates.ts    # Email template builders
│   └── request-notifications.ts  # Legacy (keep for now)
├── env.ts                     # Environment variables
└── ...
```

## Next Steps

1. Set up environment variables in `.env.local`
2. Run `verifyEmailConfig()` to test your setup
3. Start using `sendEmail()` in your API routes and server actions
4. Customize templates for your specific use cases
5. Consider adding email logging/queuing for production reliability
