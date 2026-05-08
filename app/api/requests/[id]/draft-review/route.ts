import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { hasRole } from '@/src/lib/auth/has-role';
import { REQUEST_STATUS_MAP } from '@/src/constants/enums/requestStatus';
import { isValidReviewerDecisionCodeForRequestType } from '@/src/constants/reviewerDecisionCodes';
import { sendEmail } from '@/lib/email/email-service';
import { getCustomTemplate, htmlToPlainText } from '@/lib/email/email-templates';
import { listItems, updateItem } from '@/lib/sharepoint/lists';

const WORKING_GCPC_SOURCE_ROLE = 'working_gcpc';
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

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, ''));
}

function extractReviewerCommentList(html: string) {
  const items = [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripHtml(match[1] ?? ''))
    .filter(Boolean);

  return items.length > 0
    ? items.map((value, index) => ({ index: index + 1, value }))
    : null;
}

function extractReviewerCommentUrls(html: string) {
  const urls = [...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1]?.trim())
    .filter((url): url is string => Boolean(url));

  return [...new Set(urls)];
}

function extractReviewerCommentTable(html: string) {
  const tableMatch = html.match(/<table\b[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return null;

  const rows = [...(tableMatch[1] ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((rowMatch) =>
      [...(rowMatch[1] ?? '').matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)]
        .map((cellMatch) => stripHtml(cellMatch[1] ?? ''))
    )
    .filter((cells) => cells.some(Boolean));

  const keyValuePairs = rows
    .filter((cells) => cells.length >= 2 && cells[0])
    .map((cells) => [cells[0], cells[1] ?? ''] as const);

  if (keyValuePairs.length === 0) return null;

  return Object.fromEntries(keyValuePairs);
}

function parseReviewerCommentData(html: string) {
  return {
    reviewerCommentList: extractReviewerCommentList(html),
    reviewerCommentTable: extractReviewerCommentTable(html),
    reviewerCommentUrls: extractReviewerCommentUrls(html),
  };
}

function mapDecisionCodeToReviewConclusionFlags(decisionCode: string) {
  return {
    reviewConclusionCode1a: decisionCode === '1',
    reviewConclusionCode1b: decisionCode === '5',
    reviewConclusionCode2: decisionCode === '2',
    reviewConclusionCode3: decisionCode === '3',
    reviewConclusionCode4: decisionCode === '4',
  };
}

async function notifyWorkingGcpcUsers(requestId: string, reviewerName: string) {
  const requestsListId = process.env.REQUESTS_LIST_ID;
  const usersListId = process.env.USERS_LIST_ID;
  if (!requestsListId || !usersListId) return;
  const [requestItems, users] = await Promise.all([
    listItems<{
      id: string;
      uuid?: string;
      requestNo?: string;
      requestTitle?: string;
      requestType?: string;
      routingType?: string;
      companyName?: string;
      companyCode?: string;
    }>(requestsListId),
    listItems<{ email?: string; primaryRole?: string; roles?: string; isActive?: boolean }>(usersListId),
  ]);
  const requestRecord = requestItems.find((item) => {
    const uuid = (item.uuid ?? '').trim();
    return item.id === requestId || uuid === requestId;
  });

  if (!requestRecord) return;

  const workingGcpcUsers = users.filter((entry) => {
    const primaryRole = (entry.primaryRole ?? '').trim().toLowerCase();
    const rolesText = (entry.roles ?? '').trim();
    const roles = rolesText ? JSON.parse(rolesText) : [];
    const hasRole =
      primaryRole === WORKING_GCPC_SOURCE_ROLE ||
      (Array.isArray(roles) && roles.map((role) => String(role).toLowerCase()).includes(WORKING_GCPC_SOURCE_ROLE));
    return Boolean(entry.isActive) && hasRole;
  });

  const recipients = dedupeEmails(workingGcpcUsers.map((user) => user.email));
  if (recipients.length === 0) return;

  const requestUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/requests/${requestId}`;
  const detailsHtml = `
    Reviewer has reviewed the request data and submitted decision for this request.<br><br>
    Please log in to GCP Central and review the request data.<br><br>
    <strong>Request No:</strong> ${escapeHtml(requestRecord.requestNo ?? '')}<br>
    <strong>Title:</strong> ${escapeHtml(requestRecord.requestTitle ?? '')}<br>
    <strong>Type:</strong> ${escapeHtml(requestRecord.routingType ?? '')} / ${escapeHtml(requestRecord.requestType ?? '')}<br>
    <strong>Company:</strong> ${escapeHtml(requestRecord.companyName ?? '')} (${escapeHtml(requestRecord.companyCode ?? '')})<br>
    <strong>Reviewed By:</strong> ${escapeHtml(reviewerName)}
  `;

  const subject = `Reviewer completed review: ${requestRecord.requestNo ?? 'Request'}`;
  const html = getCustomTemplate(
    subject,
    detailsHtml,
    'Login and Review Request',
    requestUrl,
    'GCP Central'
  );

  const result = await sendEmail({
    to: recipients,
    subject,
    html,
    text: htmlToPlainText(html),
  });

  if (!result.success) {
    console.error('Draft Review notification email failed:', {
      requestId,
      requestNo: requestRecord.requestNo ?? '',
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
    if (!user || (!hasRole(user, 'reviewer') && !hasRole(user, 'admin'))) {
      return NextResponse.json(
        { error: 'Only reviewers and admins can submit review decisions' },
        { status: 403 }
      );
    }

    const { id } = await params;
    let body: { comment?: unknown; decisionCode?: unknown } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      body = {};
    }

    const decisionCode =
      typeof body.decisionCode === 'string' ? body.decisionCode.trim() : '';
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
    const parsedCommentData = parseReviewerCommentData(comment);
    const reviewConclusionFlags = mapDecisionCodeToReviewConclusionFlags(decisionCode);

    if (!decisionCode) {
      return NextResponse.json({ error: 'Decision code is required' }, { status: 400 });
    }

    const requestsListId = process.env.REQUESTS_LIST_ID;
    if (!requestsListId) {
      return NextResponse.json({ error: 'REQUESTS_LIST_ID is not configured' }, { status: 500 });
    }
    const requestItems = await listItems<{
      id: string;
      uuid?: string;
      requestType?: string;
    }>(requestsListId);
    const requestRecord = requestItems.find((item) => {
      const uuid = (item.uuid ?? '').trim();
      return item.id === id || uuid === id;
    });

    if (!requestRecord) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (!isValidReviewerDecisionCodeForRequestType(requestRecord.requestType ?? '', decisionCode)) {
      return NextResponse.json(
        { error: 'Invalid decision code for this request type' },
        { status: 400 }
      );
    }

    await updateItem(requestsListId, requestRecord.id, {
      status: DRAFT_REVIEW_STATUS,
      reviewerCommentText: comment,
      reviewerDecisionCode: decisionCode,
      reviewerCommentList: parsedCommentData.reviewerCommentList ?? null,
      reviewerCommentTable: parsedCommentData.reviewerCommentTable ?? null,
      review_x002d_comment_x002d_url: parsedCommentData.reviewerCommentUrls,
      reviewedBy: user.name,
      reviewedAt: new Date().toISOString(),
      outcome: DRAFT_REVIEW_STATUS,
      ...reviewConclusionFlags,
    });
    const updated = {
      id: (requestRecord.uuid ?? '').trim() || requestRecord.id,
      status: DRAFT_REVIEW_STATUS,
      updatedAt: new Date().toISOString(),
    };

    await notifyWorkingGcpcUsers(updated.id, user.name).catch((emailError) => {
      console.error('Working GCPC notification failed on Draft Review:', emailError);
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating request to Draft Review:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
