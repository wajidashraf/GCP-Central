import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { hasRole } from '@/src/lib/auth/has-role';
import { REQUEST_STATUS_MAP } from '@/src/constants/enums/requestStatus';
import { sendEmail } from '@/lib/email/email-service';
import { getCustomTemplate, htmlToPlainText } from '@/lib/email/email-templates';

const WORKING_GCPC_ROLE = 'working_gcpc';
const DRAFT_REVIEW_STATUS = REQUEST_STATUS_MAP.DRAFT_REVIEW.label;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function dedupeEmails(emails: string[]) {
  return [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

async function notifyWorkingGcpcUsers(requestId: string) {
  const requestRecord = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      requestNo: true,
      requestTitle: true,
      requestType: true,
      routingType: true,
      category: true,
      requestorName: true,
      requestorEmail: true,
      companyName: true,
      companyCode: true,
      submittedAt: true,
    },
  });

  if (!requestRecord) {
    return;
  }

  const workingGcpcUsers = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { primaryRole: WORKING_GCPC_ROLE },
        { roles: { has: WORKING_GCPC_ROLE } },
      ],
    },
    select: { email: true },
  });

  const recipients = dedupeEmails(workingGcpcUsers.map((user) => user.email));
  if (recipients.length === 0) {
    console.warn('Skipping Draft Review notification: no Working GCPC recipients found', {
      requestId,
      requestNo: requestRecord.requestNo,
    });
    return;
  }

  const requestUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/requests/${requestId}`;
  const submittedAtLabel = requestRecord.submittedAt?.toISOString() || 'Not submitted';
  const detailsHtml = `
    Input is required from Working GCPC for this request.<br><br>
    <strong>Request No:</strong> ${escapeHtml(requestRecord.requestNo)}<br>
    <strong>Title:</strong> ${escapeHtml(requestRecord.requestTitle)}<br>
    <strong>Type:</strong> ${escapeHtml(requestRecord.routingType)} / ${escapeHtml(requestRecord.requestType)}<br>
    <strong>Category:</strong> ${escapeHtml(requestRecord.category)}<br>
    <strong>Company:</strong> ${escapeHtml(requestRecord.companyName)} (${escapeHtml(requestRecord.companyCode)})<br>
    <strong>Requestor:</strong> ${escapeHtml(requestRecord.requestorName)} (${escapeHtml(requestRecord.requestorEmail)})<br>
    <strong>Submitted At (UTC):</strong> ${escapeHtml(submittedAtLabel)}
  `;

  const html = getCustomTemplate(
    `Working GCPC input required: ${requestRecord.requestNo}`,
    detailsHtml,
    'Review Request',
    requestUrl,
    'GCP Central'
  );

  const result = await sendEmail({
    to: recipients,
    subject: `Working GCPC input required: ${requestRecord.requestNo}`,
    html,
    text: htmlToPlainText(html),
  });

  if (!result.success) {
    console.error('Draft Review notification email failed:', {
      requestId,
      requestNo: requestRecord.requestNo,
      error: result.error,
    });
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (!hasRole(user, 'verifier') && !hasRole(user, 'admin'))) {
      return NextResponse.json(
        { error: 'Only verifiers and admins can mark reviews as draft' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const requestRecord = await prisma.request.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!requestRecord) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (requestRecord.status.trim().toLowerCase() !== 'r') {
      return NextResponse.json(
        { error: 'Only requests in review can be marked as Draft Review' },
        { status: 400 }
      );
    }

    // Count reviewer-phase suggestions (anything except explicit working_gcpc).
    // Do not rely on Prisma `count` + `NOT` / `null` on MongoDB: documents with no `sourceRole`
    // field can be excluded from DB-level filters, which incorrectly yields 0.
    const suggestionRows = await prisma.reviewerSuggestion.findMany({
      where: { requestId: id },
      select: { sourceRole: true },
    });
    const reviewerSuggestionsCount = suggestionRows.filter(
      (row) => row.sourceRole !== WORKING_GCPC_ROLE
    ).length;

    if (reviewerSuggestionsCount < 1) {
      return NextResponse.json(
        { error: 'At least one reviewer suggestion is required to mark Draft Review' },
        { status: 400 }
      );
    }

    const updated = await prisma.request.update({
      where: { id },
      data: { status: DRAFT_REVIEW_STATUS },
      select: { id: true, status: true, updatedAt: true },
    });

    await notifyWorkingGcpcUsers(id).catch((emailError) => {
      console.error('Working GCPC notification failed:', emailError);
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error marking review as draft:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
