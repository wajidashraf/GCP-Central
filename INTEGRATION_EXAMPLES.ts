/**
 * Example: Integration with Request Submission Flow
 *
 * This file demonstrates how to integrate the Nodemailer email service
 * into your existing request submission workflow.
 *
 * Copy and adapt these patterns to your actual API routes and server actions.
 */

// ============================================================================
// Example 1: Send email on request submission (API Route)
// ============================================================================

// File: app/api/requests/route.ts
// This example shows how to handle request submission and send confirmation emails

/*
import { sendEmail } from "@/lib/email/email-service";
import {
  getRequestSubmissionTemplate,
  getRequestReviewTemplate,
  htmlToPlainText,
} from "@/lib/email/email-templates";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      type,
      routingType,
      requesterEmail,
      requesterName,
      requesterUserId,
      companyName,
      documents,
    } = body;

    // 1. Create request in database
    const newRequest = await prisma.request.create({
      data: {
        title,
        type,
        routingType,
        requesterEmail,
        requesterName,
        userId: requesterUserId,
        companyName,
        status: "SUBMITTED",
        documents: {
          create: documents.map((doc: any) => ({
            name: doc.name,
            url: doc.url,
            type: doc.type,
          })),
        },
      },
      include: { documents: true },
    });

    // 2. Send confirmation email to requester
    const submissionHtml = getRequestSubmissionTemplate(
      requesterName.split(" ")[0], // First name
      newRequest.requestNo,
      title,
      type,
      `${process.env.NEXT_PUBLIC_APP_URL}/requests/${newRequest.id}`,
      "GCP Central"
    );

    const submissionResult = await sendEmail({
      to: {
        email: requesterEmail,
        name: requesterName,
      },
      subject: `Request Submitted: ${newRequest.requestNo}`,
      html: submissionHtml,
      text: htmlToPlainText(submissionHtml),
    });

    console.log("Submission confirmation email:", submissionResult);

    // 3. Get reviewers for this request type and send review emails
    const reviewers = await prisma.user.findMany({
      where: {
        roles: {
          some: {
            slug: `reviewer_${type.toLowerCase()}`,
          },
        },
      },
    });

    for (const reviewer of reviewers) {
      const reviewHtml = getRequestReviewTemplate(
        reviewer.firstName || "Reviewer",
        newRequest.requestNo,
        title,
        requesterName,
        `${process.env.NEXT_PUBLIC_APP_URL}/admin/requests/${newRequest.id}/review`,
        "GCP Central"
      );

      const reviewResult = await sendEmail({
        to: {
          email: reviewer.email,
          name: reviewer.firstName || "Reviewer",
        },
        subject: `Review Needed: ${newRequest.requestNo}`,
        html: reviewHtml,
        text: htmlToPlainText(reviewHtml),
      });

      console.log(`Review email sent to ${reviewer.email}:`, reviewResult);
    }

    return Response.json(
      {
        success: true,
        request: newRequest,
        message: "Request created and confirmation emails sent",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Request submission error:", error);
    return Response.json(
      { error: "Failed to create request" },
      { status: 400 }
    );
  }
}
*/

// ============================================================================
// Example 2: Send email on request approval (Server Action)
// ============================================================================

// File: app/admin/actions/approve-request.ts
// This example shows a server action that handles request approval and sends notification

/*
"use server";

import { sendEmail } from "@/lib/email/email-service";
import {
  getRequestApprovalTemplate,
  htmlToPlainText,
} from "@/lib/email/email-templates";
import prisma from "@/lib/prisma";

export async function approveRequest(
  requestId: string,
  approverId: string,
  approvalNotes: string
) {
  try {
    // 1. Get request and approver details
    const request = await prisma.request.findUniqueOrThrow({
      where: { id: requestId },
    });

    const approver = await prisma.user.findUniqueOrThrow({
      where: { id: approverId },
    });

    // 2. Update request status in database
    const updatedRequest = await prisma.request.update({
      where: { id: requestId },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approverName: approver.firstName,
        approvalNotes,
      },
    });

    // 3. Send approval notification to requester
    const approvalHtml = getRequestApprovalTemplate(
      request.requesterName.split(" ")[0],
      request.requestNo,
      request.title,
      approver.firstName || "Manager",
      `${process.env.NEXT_PUBLIC_APP_URL}/requests/${request.id}`,
      "GCP Central"
    );

    const emailResult = await sendEmail({
      to: {
        email: request.requesterEmail,
        name: request.requesterName,
      },
      subject: `Request Approved: ${request.requestNo}`,
      html: approvalHtml,
      text: htmlToPlainText(approvalHtml),
    });

    console.log("Approval email sent:", emailResult);

    return {
      success: true,
      request: updatedRequest,
      message: "Request approved and notification sent",
    };
  } catch (error) {
    console.error("Approval error:", error);
    throw new Error("Failed to approve request");
  }
}
*/

// ============================================================================
// Example 3: Send email on request rejection (Server Action)
// ============================================================================

// File: app/admin/actions/reject-request.ts
// This example shows how to send rejection emails with feedback

/*
"use server";

import { sendEmail } from "@/lib/email/email-service";
import {
  getRequestRejectionTemplate,
  htmlToPlainText,
} from "@/lib/email/email-templates";
import prisma from "@/lib/prisma";

export async function rejectRequest(
  requestId: string,
  rejectionReason: string,
  reviewerId: string
) {
  try {
    // 1. Get request details
    const request = await prisma.request.findUniqueOrThrow({
      where: { id: requestId },
    });

    // 2. Update request status
    const updatedRequest = await prisma.request.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        rejectionReason,
        rejectedAt: new Date(),
        reviewerId,
      },
    });

    // 3. Send rejection email with feedback
    const rejectionHtml = getRequestRejectionTemplate(
      request.requesterName.split(" ")[0],
      request.requestNo,
      request.title,
      rejectionReason,
      `${process.env.NEXT_PUBLIC_APP_URL}/requests/${request.id}`,
      "GCP Central"
    );

    const emailResult = await sendEmail({
      to: {
        email: request.requesterEmail,
        name: request.requesterName,
      },
      subject: `Request Needs Revision: ${request.requestNo}`,
      html: rejectionHtml,
      text: htmlToPlainText(rejectionHtml),
    });

    console.log("Rejection email sent:", emailResult);

    return {
      success: true,
      request: updatedRequest,
      message: "Request rejected and notification sent",
    };
  } catch (error) {
    console.error("Rejection error:", error);
    throw new Error("Failed to reject request");
  }
}
*/

// ============================================================================
// Example 4: Send batch emails to multiple recipients
// ============================================================================

// File: app/api/notifications/send-announcement/route.ts
// This example shows how to send an announcement to multiple users

/*
import { sendBulkEmail } from "@/lib/email/email-service";
import {
  getCustomTemplate,
  htmlToPlainText,
} from "@/lib/email/email-templates";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subject, message, buttonText, buttonUrl, roleFilter } = body;

    // Get recipients based on filter
    let recipients = [];
    if (roleFilter) {
      const users = await prisma.user.findMany({
        where: {
          roles: {
            some: {
              slug: roleFilter,
            },
          },
        },
        select: {
          email: true,
          firstName: true,
        },
      });

      recipients = users.map((user) => ({
        email: user.email,
        name: user.firstName,
      }));
    } else {
      const users = await prisma.user.findMany({
        select: {
          email: true,
          firstName: true,
        },
      });

      recipients = users.map((user) => ({
        email: user.email,
        name: user.firstName,
      }));
    }

    // Send bulk email
    const html = getCustomTemplate(
      subject,
      message,
      buttonText,
      buttonUrl,
      "GCP Central"
    );

    const result = await sendBulkEmail(
      recipients,
      subject,
      html,
      htmlToPlainText(html)
    );

    return Response.json(
      {
        success: result.success,
        recipientCount: recipients.length,
        message: "Announcement sent",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Announcement error:", error);
    return Response.json(
      { error: "Failed to send announcement" },
      { status: 400 }
    );
  }
}
*/

// ============================================================================
// Example 5: Custom email for user registration
// ============================================================================

// File: app/api/auth/register/route.ts
// Integration with user registration

/*
import { sendEmail } from "@/lib/email/email-service";
import { getWelcomeEmailTemplate, htmlToPlainText } from "@/lib/email/email-templates";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, firstName, lastName, companyId } = body;

    // 1. Create user in database
    const user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        companyId,
      },
    });

    // 2. Send welcome email
    const welcomeHtml = getWelcomeEmailTemplate(
      firstName,
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      "GCP Central"
    );

    const emailResult = await sendEmail({
      to: {
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
      },
      subject: "Welcome to GCP Central",
      html: welcomeHtml,
      text: htmlToPlainText(welcomeHtml),
    });

    if (!emailResult.success) {
      console.warn("Welcome email failed, but user was created:", emailResult.error);
    }

    return Response.json(
      {
        success: true,
        user,
        message: "User registered successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return Response.json(
      { error: "Registration failed" },
      { status: 400 }
    );
  }
}
*/

// ============================================================================
// Example 6: Scheduled email task (for cron jobs or background workers)
// ============================================================================

// File: app/api/cron/send-pending-notifications/route.ts
// This example shows how to send emails on a schedule

/*
import { sendEmail } from "@/lib/email/email-service";
import {
  getRequestReviewTemplate,
  htmlToPlainText,
} from "@/lib/email/email-templates";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  // Verify cron job authorization
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find pending requests that need review notification (submitted > 1 hour ago)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const pendingRequests = await prisma.request.findMany({
      where: {
        status: "SUBMITTED",
        createdAt: {
          lt: oneHourAgo,
        },
        notificationSent: false,
      },
      include: {
        reviewer: true,
      },
    });

    let sentCount = 0;

    for (const req of pendingRequests) {
      if (req.reviewer) {
        const reviewHtml = getRequestReviewTemplate(
          req.reviewer.firstName || "Reviewer",
          req.requestNo,
          req.title,
          req.requesterName,
          `${process.env.NEXT_PUBLIC_APP_URL}/admin/requests/${req.id}/review`,
          "GCP Central"
        );

        const result = await sendEmail({
          to: {
            email: req.reviewer.email,
            name: req.reviewer.firstName,
          },
          subject: `Reminder: Review Pending - ${req.requestNo}`,
          html: reviewHtml,
          text: htmlToPlainText(reviewHtml),
        });

        if (result.success) {
          await prisma.request.update({
            where: { id: req.id },
            data: { notificationSent: true },
          });
          sentCount++;
        }
      }
    }

    return Response.json({
      success: true,
      sentCount,
      message: `Sent ${sentCount} pending notifications`,
    });
  } catch (error) {
    console.error("Cron email error:", error);
    return Response.json(
      { error: "Failed to send notifications" },
      { status: 500 }
    );
  }
}
*/

export default function ExampleGuide() {
  return null;
}
