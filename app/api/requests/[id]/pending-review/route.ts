import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { hasRole } from '@/src/lib/auth/has-role';
import { REQUEST_STATUS_MAP } from '@/src/constants/enums/requestStatus';
import { sendEmail } from '@/lib/email/email-service';
import { getCustomTemplate, htmlToPlainText } from '@/lib/email/email-templates';

const WORKING_GCPC_ROLE = 'working_gcpc';
const PENDING_REVIEW_STATUS = REQUEST_STATUS_MAP.PENDING_REVIEW.label;
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
  return [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

async function notifySignatoryGroup(requestId: string) {
  const requestRecord = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      requestNo: true,
      requestTitle: true,
      requestType: true,
      routingType: true,
      companyName: true,
      companyCode: true,
    },
  });

  if (!requestRecord) return;

  const signatoryMembers = await prisma.signatoryMember.findMany({
    select: { email: true, name: true },
  });

  const recipients = dedupeEmails(signatoryMembers.map((m) => m.email));
  if (recipients.length === 0) return;

  const requestUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/requests/${requestId}`;

  const detailsHtml = `
    A reviewer has moved the following request to <strong>Pending Review</strong> status.
    As a member of the Signatory Group, please log in to GCP Central to review and sign.<br><br>
    <strong>Request No:</strong> ${escapeHtml(requestRecord.requestNo)}<br>
    <strong>Title:</strong> ${escapeHtml(requestRecord.requestTitle)}<br>
    <strong>Type:</strong> ${escapeHtml(requestRecord.routingType)} / ${escapeHtml(requestRecord.requestType)}<br>
    <strong>Company:</strong> ${escapeHtml(requestRecord.companyName)} (${escapeHtml(requestRecord.companyCode)})
  `;

  const subject = `Request moved to Pending Review: ${requestRecord.requestNo}`;
  const html = getCustomTemplate(subject, detailsHtml, 'View Request', requestUrl, 'GCP Central');

  const result = await sendEmail({
    to: recipients,
    subject,
    html,
    text: htmlToPlainText(html),
  });

  if (!result.success) {
    console.error('Signatory group notification failed:', { requestId, error: result.error });
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (!hasRole(user, 'reviewer') && !hasRole(user, 'admin'))) {
      return NextResponse.json(
        { error: 'Only reviewers and admins can change the status to Pending Review' },
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

    if (requestRecord.status.trim().toLowerCase() !== DRAFT_REVIEW_STATUS.toLowerCase()) {
      return NextResponse.json(
        { error: 'Only requests in Draft Review status can be moved to Pending Review' },
        { status: 400 }
      );
    }

    // Require at least one Working GCPC suggestion before allowing the transition.
    // Fetch all suggestions and filter in memory to avoid MongoDB $not/$null edge cases.
    const suggestionRows = await prisma.reviewerSuggestion.findMany({
      where: { requestId: id },
      select: { sourceRole: true },
    });
    const workingGcpcCount = suggestionRows.filter(
      (row) => row.sourceRole === WORKING_GCPC_ROLE
    ).length;

    if (workingGcpcCount < 1) {
      return NextResponse.json(
        { error: 'At least one Working GCPC suggestion is required to move to Pending Review' },
        { status: 400 }
      );
    }

    const updated = await prisma.request.update({
      where: { id },
      data: { status: PENDING_REVIEW_STATUS },
      select: { id: true, status: true, updatedAt: true },
    });

    await notifySignatoryGroup(id).catch((emailError) => {
      console.error('Signatory group notification failed on Pending Review transition:', emailError);
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error changing request to Pending Review:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
