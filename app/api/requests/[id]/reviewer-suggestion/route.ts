import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { hasRole } from '@/src/lib/auth/has-role';
import { sendEmail } from '@/lib/email/email-service';
import { getCustomTemplate, htmlToPlainText } from '@/lib/email/email-templates';

const SUGGESTION_ACTIONS = ['accepted', 'no_need', 'pending'] as const;
const REVIEWER_SOURCE_ROLE = 'reviewer';
const WORKING_GCPC_SOURCE_ROLE = 'working_gcpc';
const DRAFT_REVIEW_STATUS = 'draft review';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function dedupeEmails(emails: string[]) {
  return [...new Set(emails.map((e: string) => e.trim().toLowerCase()).filter(Boolean))];
}

async function notifyReviewersOfWorkingGcpcSuggestion(
  requestId: string,
  suggestionText: string,
  submitterName: string,
) {
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

  type ReviewerUser = {
    email: string;
  };

  const reviewerUsers = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [{ primaryRole: REVIEWER_SOURCE_ROLE }, { roles: { has: REVIEWER_SOURCE_ROLE } }],
    },
    select: { email: true },
  });

  const recipients = dedupeEmails(reviewerUsers.map((u: ReviewerUser) => u.email));
  if (recipients.length === 0) return;

  const requestUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/requests/${requestId}`;

  // Strip basic HTML from suggestion text for safe embedding
  const plainSuggestion = suggestionText.replace(/<[^>]*>/g, '').trim();

  const detailsHtml = `
    A Working GCPC user has added a suggestion regarding the request data. Please review.<br><br>
    <strong>Request No:</strong> ${escapeHtml(requestRecord.requestNo)}<br>
    <strong>Title:</strong> ${escapeHtml(requestRecord.requestTitle)}<br>
    <strong>Type:</strong> ${escapeHtml(requestRecord.routingType)} / ${escapeHtml(requestRecord.requestType)}<br>
    <strong>Company:</strong> ${escapeHtml(requestRecord.companyName)} (${escapeHtml(requestRecord.companyCode)})<br>
    <strong>Submitted By:</strong> ${escapeHtml(submitterName)}<br><br>
    <strong>Suggestion:</strong><br>
    <blockquote style="border-left:4px solid #667eea;margin:8px 0;padding:8px 16px;background:#f3f4f6;">
      ${escapeHtml(plainSuggestion)}
    </blockquote>
  `;

  const subject = `Working GCPC suggestion on request: ${requestRecord.requestNo}`;
  const html = getCustomTemplate(subject, detailsHtml, 'Review Request', requestUrl, 'GCP Central');

  const result = await sendEmail({
    to: recipients,
    subject,
    html,
    text: htmlToPlainText(html),
  });

  if (!result.success) {
    console.error('Reviewer notification for Working GCPC suggestion failed:', {
      requestId,
      error: result.error,
    });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'You must be signed in to submit suggestions' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { suggestion, sourceRole: requestedSourceRole } = body;
    const normalizedSuggestion = typeof suggestion === 'string' ? suggestion.trim() : '';
    const normalizedRequestedSourceRole =
      typeof requestedSourceRole === 'string' ? requestedSourceRole.trim().toLowerCase() : '';

    if (!normalizedSuggestion) {
      return NextResponse.json(
        { error: 'Suggestion is required' },
        { status: 400 }
      );
    }

    // Check if request exists
    const requestRecord = await prisma.request.findUnique({
      where: { id },
    });

    if (!requestRecord) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    if (
      normalizedRequestedSourceRole &&
      ![REVIEWER_SOURCE_ROLE, WORKING_GCPC_SOURCE_ROLE].includes(normalizedRequestedSourceRole)
    ) {
      return NextResponse.json(
        { error: 'Invalid suggestion source role' },
        { status: 400 }
      );
    }

    const requestStatus = (requestRecord.status ?? '').trim().toLowerCase();
    const sourceRole =
      normalizedRequestedSourceRole ||
      (hasRole(user, 'working_gcpc') && !hasRole(user, 'reviewer') && requestStatus === DRAFT_REVIEW_STATUS
        ? WORKING_GCPC_SOURCE_ROLE
        : REVIEWER_SOURCE_ROLE);

    const isReviewerSuggestion = sourceRole === REVIEWER_SOURCE_ROLE;
    const isWorkingGcpcSuggestion = sourceRole === WORKING_GCPC_SOURCE_ROLE;

    if (
      isReviewerSuggestion &&
      !hasRole(user, 'reviewer') &&
      !hasRole(user, 'admin')
    ) {
      return NextResponse.json(
        { error: 'Only reviewers and admins can submit reviewer suggestions' },
        { status: 403 }
      );
    }

    if (
      isWorkingGcpcSuggestion &&
      !hasRole(user, 'working_gcpc') &&
      !hasRole(user, 'admin')
    ) {
      return NextResponse.json(
        { error: 'Only Working GCPC users and admins can submit Working GCPC suggestions' },
        { status: 403 }
      );
    }

    if (isWorkingGcpcSuggestion && requestStatus !== DRAFT_REVIEW_STATUS) {
      return NextResponse.json(
        { error: 'Working GCPC suggestions can only be submitted during Draft Review' },
        { status: 400 }
      );
    }

    // Create reviewer suggestion
    const reviewerSuggestion = await prisma.reviewerSuggestion.create({
      data: {
        requestId: id,
        reviewerId: user.id,
        reviewerName: user.name,
        suggestion: normalizedSuggestion,
        sourceRole,
        status: 'pending',
        action: null,
      },
    });

    // Notify all reviewers when a Working GCPC user submits a suggestion
    if (isWorkingGcpcSuggestion) {
      await notifyReviewersOfWorkingGcpcSuggestion(id, normalizedSuggestion, user.name).catch(
        (emailError) => {
          console.error('Reviewer notification failed on Working GCPC suggestion:', emailError);
        },
      );
    }

    return NextResponse.json(reviewerSuggestion);
  } catch (error) {
    console.error('Error creating reviewer suggestion:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'You must be signed in to view suggestions' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const visibilityFilters = [];

    if (hasRole(user, 'reviewer') || hasRole(user, 'verifier') || hasRole(user, 'admin')) {
      visibilityFilters.push({ sourceRole: REVIEWER_SOURCE_ROLE }, { sourceRole: null });
    }

    if (hasRole(user, 'working_gcpc') || hasRole(user, 'verifier')) {
      visibilityFilters.push({ sourceRole: WORKING_GCPC_SOURCE_ROLE });
    }

    if (visibilityFilters.length === 0) {
      return NextResponse.json([]);
    }

    const reviewerSuggestions = await prisma.reviewerSuggestion.findMany({
      where: {
        requestId: id,
        OR: visibilityFilters,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(reviewerSuggestions);
  } catch (error) {
    console.error('Error fetching reviewer suggestions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || (!hasRole(user, 'verifier') && !hasRole(user, 'admin'))) {
      return NextResponse.json(
        { error: 'Only verifiers and admins can update suggestion status' },
        { status: 403 }
      );
    }
    const { id } = await params;

    const body = await request.json();
    const { suggestionId, action } = body;
    const normalizedSuggestionId = typeof suggestionId === 'string' ? suggestionId.trim() : '';
    const normalizedAction = typeof action === 'string' ? action.trim().toLowerCase() : '';

    if (!normalizedSuggestionId || !normalizedAction) {
      return NextResponse.json(
        { error: 'Suggestion ID and action are required' },
        { status: 400 }
      );
    }

    if (!SUGGESTION_ACTIONS.includes(normalizedAction as (typeof SUGGESTION_ACTIONS)[number])) {
      return NextResponse.json(
        { error: 'Invalid action value' },
        { status: 400 }
      );
    }

    const suggestion = await prisma.reviewerSuggestion.findFirst({
      where: {
        id: normalizedSuggestionId,
        requestId: id,
      },
      select: { id: true },
    });

    if (!suggestion) {
      return NextResponse.json(
        { error: 'Suggestion not found for this request' },
        { status: 404 }
      );
    }

    const updatedSuggestion = await prisma.reviewerSuggestion.update({
      where: { id: normalizedSuggestionId },
      data: {
        action: normalizedAction,
        status: normalizedAction === 'pending' ? 'pending' : 'reviewed',
      },
    });

    return NextResponse.json(updatedSuggestion);
  } catch (error) {
    console.error('Error updating reviewer suggestion:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
