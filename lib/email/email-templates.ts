/**
 * Email Template Builders
 * Reusable functions to build professional HTML email templates
 */

/**
 * Base layout for all emails
 */
function getEmailLayout(
  content: string,
  appName: string = "GCP Central"
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f9fafb;
          }
          .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-collapse: collapse;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .content {
            padding: 30px;
          }
          .footer {
            background-color: #f3f4f6;
            color: #6b7280;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            border-top: 1px solid #e5e7eb;
          }
          .button {
            display: inline-block;
            background-color: #667eea;
            color: white;
            padding: 12px 30px;
            border-radius: 6px;
            text-decoration: none;
            margin: 20px 0;
            font-weight: 600;
          }
          .button:hover {
            background-color: #5568d3;
          }
          .alert {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .success {
            background-color: #d1fae5;
            border-left: 4px solid #10b981;
          }
          .error {
            background-color: #fee2e2;
            border-left: 4px solid #ef4444;
          }
          h2 {
            color: #1f2937;
            margin-top: 0;
          }
          p {
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <table class="email-container" width="100%">
          <tr>
            <td class="header">
              <h1>${appName}</h1>
            </td>
          </tr>
          <tr>
            <td class="content">
              ${content}
            </td>
          </tr>
          <tr>
            <td class="footer">
              <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
              <p>This is an automated message. Please do not reply directly to this email.</p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

/**
 * Welcome email template
 */
export function getWelcomeEmailTemplate(
  userFirstName: string,
  appUrl: string,
  appName: string = "GCP Central"
): string {
  const content = `
    <h2>Welcome to ${appName}!</h2>
    <p>Hello ${userFirstName},</p>
    <p>Your account has been successfully created. We're excited to have you on board!</p>
    <p>You can now log in to your account and start using our platform.</p>
    <center>
      <a href="${appUrl}" class="button">Go to ${appName}</a>
    </center>
    <p>If you have any questions or need assistance, please don't hesitate to reach out to our support team.</p>
  `;
  return getEmailLayout(content, appName);
}

/**
 * Request submission confirmation template
 */
export function getRequestSubmissionTemplate(
  userFirstName: string,
  requestNo: string,
  requestTitle: string,
  requestType: string,
  dashboardUrl: string,
  appName: string = "GCP Central"
): string {
  const content = `
    <h2>Request Submission Confirmed</h2>
    <p>Hello ${userFirstName},</p>
    <p>Your request has been successfully submitted to ${appName}.</p>
    
    <div class="alert success">
      <strong>Request Number:</strong> ${requestNo}<br>
      <strong>Title:</strong> ${requestTitle}<br>
      <strong>Type:</strong> ${requestType}
    </div>
    
    <p>You can track the status of your request by visiting your dashboard:</p>
    <center>
      <a href="${dashboardUrl}" class="button">View My Requests</a>
    </center>
    
    <p>We will notify you of any updates regarding your request.</p>
  `;
  return getEmailLayout(content, appName);
}

/**
 * Request review notification template
 */
export function getRequestReviewTemplate(
  reviewerName: string,
  requestNo: string,
  requestTitle: string,
  submitterName: string,
  reviewUrl: string,
  appName: string = "GCP Central"
): string {
  const content = `
    <h2>New Request Review Needed</h2>
    <p>Hello ${reviewerName},</p>
    <p>A new request has been assigned to you for review in ${appName}.</p>
    
    <div class="alert">
      <strong>Request Number:</strong> ${requestNo}<br>
      <strong>Title:</strong> ${requestTitle}<br>
      <strong>Submitted by:</strong> ${submitterName}
    </div>
    
    <p>Please review the request details and provide your feedback:</p>
    <center>
      <a href="${reviewUrl}" class="button">Review Request</a>
    </center>
    
    <p>Thank you for your attention to this matter.</p>
  `;
  return getEmailLayout(content, appName);
}

/**
 * Request approval notification template
 */
export function getRequestApprovalTemplate(
  userFirstName: string,
  requestNo: string,
  requestTitle: string,
  approverName: string,
  dashboardUrl: string,
  appName: string = "GCP Central"
): string {
  const content = `
    <h2>Request Approved</h2>
    <p>Hello ${userFirstName},</p>
    <p>Great news! Your request has been approved by ${approverName}.</p>
    
    <div class="alert success">
      <strong>Request Number:</strong> ${requestNo}<br>
      <strong>Title:</strong> ${requestTitle}<br>
      <strong>Status:</strong> Approved
    </div>
    
    <p>You can view the approved request and next steps here:</p>
    <center>
      <a href="${dashboardUrl}" class="button">View Request</a>
    </center>
  `;
  return getEmailLayout(content, appName);
}

/**
 * Request rejection notification template
 */
export function getRequestRejectionTemplate(
  userFirstName: string,
  requestNo: string,
  requestTitle: string,
  rejectionReason: string,
  dashboardUrl: string,
  appName: string = "GCP Central"
): string {
  const content = `
    <h2>Request Requires Revision</h2>
    <p>Hello ${userFirstName},</p>
    <p>Your request has been returned with feedback. Please review the comments and make the necessary revisions.</p>
    
    <div class="alert error">
      <strong>Request Number:</strong> ${requestNo}<br>
      <strong>Title:</strong> ${requestTitle}<br>
      <strong>Status:</strong> Pending Revision
    </div>
    
    <h3>Feedback:</h3>
    <p>${rejectionReason}</p>
    
    <p>Please update your request based on the feedback provided:</p>
    <center>
      <a href="${dashboardUrl}" class="button">Review & Update</a>
    </center>
  `;
  return getEmailLayout(content, appName);
}

/**
 * Generic custom email template
 * Useful for sending custom messages
 */
export function getCustomTemplate(
  subject: string,
  message: string,
  buttonText?: string,
  buttonUrl?: string,
  appName: string = "GCP Central"
): string {
  let content = `
    <h2>${subject}</h2>
    <p>${message}</p>
  `;

  if (buttonText && buttonUrl) {
    content += `
      <center>
        <a href="${buttonUrl}" class="button">${buttonText}</a>
      </center>
    `;
  }

  return getEmailLayout(content, appName);
}

/**
 * Engagement booking notification template
 * Sent to attendees when an engagement is booked
 */
export function getEngagementBookingTemplate(
  attendeeName: string,
  requestorName: string,
  companyName: string,
  engagementType: string | null,
  engagementLocation: string | null,
  requestNo: string,
  requestTitle: string,
  requestType: string,
  slotStartTime: Date,
  slotEndTime: Date,
  engagementDetailsUrl: string,
  appName: string = "GCP Central"
): string {
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(date);
  };

  const engagementTypeLabel =
    engagementType === "virtual" ? "Virtual" : "In-Person";

  let locationInfo = "";
  if (engagementLocation) {
    locationInfo = `<strong>Location:</strong> ${engagementLocation}<br>`;
  }

  const content = `
    <h2>Engagement Booking Notification</h2>
    <p>Hello ${attendeeName},</p>
    <p>A new engagement has been scheduled and you are listed as an attendee. Please see the details below:</p>

    <div class="alert" style="background-color: #e0e7ff; border-left-color: #667eea;">
      <h3 style="margin-top: 0; color: #667eea;">Engagement Details</h3>
      <strong>Requestor:</strong> ${requestorName}<br>
      <strong>Company:</strong> ${companyName}<br>
      <strong>Type:</strong> ${engagementTypeLabel}<br>
      ${locationInfo}
      <strong>Scheduled Time:</strong><br>
      <span style="font-size: 14px; color: #4b5563;">
        ${formatTime(slotStartTime)} to ${formatTime(slotEndTime)}
      </span>
    </div>

    <h3>Request Information</h3>
    <p>
      <strong>Request Number:</strong> ${requestNo}<br>
      <strong>Title:</strong> ${requestTitle}<br>
      <strong>Type:</strong> ${requestType}
    </p>

    <p>Please mark this time on your calendar and prepare for the engagement meeting.</p>

    <center>
      <a href="${engagementDetailsUrl}" class="button">View Engagement Details</a>
    </center>

    <p>If you have any questions or need to reschedule, please contact the requestor directly.</p>
  `;

  return getEmailLayout(content, appName);
}

/**
 * Plain text fallback generator
 * Extracts text from HTML (basic implementation)
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/&nbsp;/g, " ") // Replace non-breaking spaces
    .replace(/&amp;/g, "&") // Replace ampersands
    .replace(/&lt;/g, "<") // Replace less than
    .replace(/&gt;/g, ">") // Replace greater than
    .replace(/&quot;/g, '"') // Replace quotes
    .replace(/\s+/g, " ") // Replace multiple spaces
    .trim();
}
