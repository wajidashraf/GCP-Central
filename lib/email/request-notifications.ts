import "server-only";

import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email/email-service";
import { getCustomTemplate, htmlToPlainText } from "@/lib/email/email-templates";

const VERIFIER_ROLE = "verifier";

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
  companyCode: string;
  submittedAt: Date | null;
};

function formatSubmittedOnUtc(date: Date | null) {
  const d = date ?? new Date();
  return (
    new Intl.DateTimeFormat("en-GB", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(d) + " UTC"
  );
}

/** Display label for requestor submission email — matches product copy ("New Request"). */
function statusLabelForRequestorEmail(dbStatus: string) {
  const s = dbStatus.trim();
  if (s === "New") {
    return "New Request";
  }
  return s || "New Request";
}

function buildRequestorSubmissionBodyHtml(options: {
  requestNo: string;
  requestorName: string;
  requestorEmail: string;
  companyName: string;
  requestType: string;
  routingType: string;
  submittedAt: Date | null;
  status: string;
}) {
  const {
    requestNo,
    requestorName,
    requestorEmail,
    companyName,
    requestType,
    routingType,
    submittedAt,
    status,
  } = options;

  const requestTypeLine = `${routingType.toUpperCase()} / ${requestType.toUpperCase()}`;
  const submittedBy =
    requestorEmail.length > 0
      ? `${escapeHtml(requestorName)} / ${escapeHtml(requestorEmail)}`
      : escapeHtml(requestorName);
  const statusLabel = escapeHtml(statusLabelForRequestorEmail(status));

  return `
    <strong>***** THIS IS SYSTEM GENERATED EMAIL. PLEASE DO NOT REPLY *****</strong><br><br>
    Dear ${escapeHtml(requestorName)},<br><br>
    Your request has been successfully submitted.<br><br>
    <strong>Request Details:</strong><br>
    &#8226; Request ID: ${escapeHtml(requestNo)}<br>
    &#8226; Submitted By: ${submittedBy}<br>
    &#8226; Company: ${escapeHtml(companyName)}<br>
    &#8226; Request Type: ${escapeHtml(requestTypeLine)}<br>
    &#8226; Submitted On: ${escapeHtml(formatSubmittedOnUtc(submittedAt))}<br><br>
    <strong>Current Status:</strong><br>
    &#8226; Status: <strong>${statusLabel}</strong><br><br>
    Your request is currently in progress. You will receive further updates once the status changes.<br><br>
    Thank you,<br>
    GCP Support Team
  `;
}

function buildSummaryDetailsHtml(payload: RequestEmailPayload) {
  const submittedAtLabel = (payload.submittedAt ?? new Date()).toISOString();
  return [
    `<strong>Request No:</strong> ${escapeHtml(payload.requestNo)}<br>`,
    `<strong>Request Type:</strong> ${escapeHtml(payload.routingType.toUpperCase())} / ${escapeHtml(payload.requestType.toUpperCase())}<br>`,
    `<strong>Title:</strong> ${escapeHtml(payload.requestTitle)}<br>`,
    `<strong>Company:</strong> ${escapeHtml(payload.companyName)} (${escapeHtml(payload.companyCode)})<br>`,
    `<strong>Submitted At (UTC):</strong> ${escapeHtml(submittedAtLabel)}`,
  ].join("");
}

export async function notifyRequestSubmissionByEmail({
  requestId,
}: NotifyRequestSubmissionByEmailInput) {
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
        companyCode: true,
        submittedAt: true,
        status: true,
      },
    });

    if (!request) {
      return;
    }

    const requestorEmail = normalizeEmail(request.requestorEmail);
    const requestorEmailDisplay = request.requestorEmail?.trim() || "";
    const requestorName = request.requestorName?.trim() || "Requestor";

    const summaryPayload: RequestEmailPayload = {
      requestNo: request.requestNo,
      requestTitle: request.requestTitle,
      requestType: request.requestType,
      routingType: request.routingType,
      companyName: request.companyName,
      companyCode: request.companyCode,
      submittedAt: request.submittedAt,
    };

    const summaryDetailsHtml = buildSummaryDetailsHtml(summaryPayload);
    const requestUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/requests/${request.id}`;

    if (requestorEmail) {
      const requestorSubject = `GCP/GCPC Request Submitted – [Request ID: ${request.requestNo}]`;
      const requestorDetailsHtml = buildRequestorSubmissionBodyHtml({
        requestNo: request.requestNo,
        requestorName,
        requestorEmail: requestorEmailDisplay,
        companyName: request.companyName,
        requestType: request.requestType,
        routingType: request.routingType,
        submittedAt: request.submittedAt,
        status: request.status,
      });
      const requestorHtml = getCustomTemplate(
        requestorSubject,
        requestorDetailsHtml,
        "View Request",
        requestUrl,
        "GCP Central"
      );

      const requestorResult = await sendEmail({
        to: requestorEmail,
        subject: requestorSubject,
        html: requestorHtml,
        text: htmlToPlainText(requestorHtml),
      });

      if (!requestorResult.success) {
        console.error("Failed to send request submission email to requestor:", {
          requestId,
          error: requestorResult.error,
        });
      }
    }

    const verifierUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { primaryRole: VERIFIER_ROLE },
          { roles: { has: VERIFIER_ROLE } },
        ],
      },
      select: { email: true, emailLower: true },
    });

    const verifierEmails = dedupeEmails(
      verifierUsers.map((u) => normalizeEmail(u.emailLower || u.email))
    ).filter((email) => email.length > 0 && email !== requestorEmail);

    if (verifierEmails.length > 0) {
      const verifierSubject = `New request submitted: ${request.requestNo}`;
      const verifierDetailsHtml = `
        A new request has been submitted in GCP Central.<br><br>
        ${summaryDetailsHtml}<br><br>
        <strong>Submitted by:</strong> ${escapeHtml(requestorName)} (${escapeHtml(requestorEmailDisplay || "email not on file")})
      `;
      const verifierHtml = getCustomTemplate(
        verifierSubject,
        verifierDetailsHtml,
        "View Request",
        requestUrl,
        "GCP Central"
      );

      const verifierResult = await sendEmail({
        to: verifierEmails,
        subject: verifierSubject,
        html: verifierHtml,
        text: htmlToPlainText(verifierHtml),
      });

      if (!verifierResult.success) {
        console.error("Failed to send request submission email to verifiers:", {
          requestId,
          error: verifierResult.error,
        });
      }
    }
  } catch (error) {
    console.error("Request submission email notification failed:", error);
  }
}
