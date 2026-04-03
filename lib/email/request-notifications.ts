import "server-only";

import { Resend } from "resend";
import { env } from "@/lib/env";
import prisma from "@/lib/prisma";

const HOC_ROLE_SLUG = "hoc";

const resendClient = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

type NotifyRequestSubmissionByEmailInput = {
  requestId: string;
};

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function dedupeEmails(emails: string[]) {
  return [...new Set(emails.filter((email) => email.length > 0))];
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type RequestEmailPayload = {
  requestNo: string;
  requestTitle: string;
  requestType: string;
  routingType: string;
  companyName: string;
  submittedAt: Date | null;
};

function buildSummaryText(payload: RequestEmailPayload) {
  const submittedAtLabel = (payload.submittedAt ?? new Date()).toISOString();
  return [
    `Request No: ${payload.requestNo}`,
    `Request Type: ${payload.routingType.toUpperCase()} / ${payload.requestType.toUpperCase()}`,
    `Title: ${payload.requestTitle}`,
    `Company: ${payload.companyName}`,
    `Submitted At (UTC): ${submittedAtLabel}`,
  ].join("\n");
}

function buildSummaryHtml(payload: RequestEmailPayload) {
  const submittedAtLabel = (payload.submittedAt ?? new Date()).toISOString();
  return `
    <ul>
      <li><strong>Request No:</strong> ${escapeHtml(payload.requestNo)}</li>
      <li><strong>Request Type:</strong> ${escapeHtml(payload.routingType.toUpperCase())} / ${escapeHtml(payload.requestType.toUpperCase())}</li>
      <li><strong>Title:</strong> ${escapeHtml(payload.requestTitle)}</li>
      <li><strong>Company:</strong> ${escapeHtml(payload.companyName)}</li>
      <li><strong>Submitted At (UTC):</strong> ${escapeHtml(submittedAtLabel)}</li>
    </ul>
  `;
}

export async function notifyRequestSubmissionByEmail({
  requestId,
}: NotifyRequestSubmissionByEmailInput) {
  if (!resendClient) {
    console.warn(
      "Skipping request notification email: RESEND_API_KEY is not configured."
    );
    return;
  }

  const from = env.RESEND_FROM_EMAIL.trim();
  if (!from) {
    console.warn(
      "Skipping request notification email: RESEND_FROM_EMAIL is not configured."
    );
    return;
  }

  try {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        requestNo: true,
        requestTitle: true,
        requestType: true,
        routingType: true,
        requestorName: true,
        requestorEmail: true,
        companyId: true,
        companyName: true,
        submittedAt: true,
      },
    });

    if (!request) {
      return;
    }

    const requestorEmail = normalizeEmail(request.requestorEmail);
    const requestorName = request.requestorName?.trim() || "Requestor";

    const summaryPayload: RequestEmailPayload = {
      requestNo: request.requestNo,
      requestTitle: request.requestTitle,
      requestType: request.requestType,
      routingType: request.routingType,
      companyName: request.companyName,
      submittedAt: request.submittedAt,
    };

    const summaryText = buildSummaryText(summaryPayload);
    const summaryHtml = buildSummaryHtml(summaryPayload);

    if (requestorEmail) {
      const { error } = await resendClient.emails.send({
        from,
        to: [requestorEmail],
        subject: `Request submitted: ${request.requestNo}`,
        text: [
          `Hi ${requestorName},`,
          "",
          "Your request has been submitted successfully.",
          "",
          summaryText,
          "",
          "This is an automated message from GCP Central.",
        ].join("\n"),
        html: `
          <p>Hi ${escapeHtml(requestorName)},</p>
          <p>Your request has been submitted successfully.</p>
          ${summaryHtml}
          <p>This is an automated message from GCP Central.</p>
        `,
      });

      if (error) {
        console.error("Failed to send request submission email to requestor:", error);
      }
    }

   
  } catch (error) {
    console.error("Request submission email notification failed:", error);
  }
}
