import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { hasRole } from '@/src/lib/auth/has-role';
import { sendEmail } from '@/lib/email/email-service';
import { getCustomTemplate, htmlToPlainText } from '@/lib/email/email-templates';
import {
  findRequestByRouteId,
  requestRouteIdForUrl,
} from '@/lib/sharepoint/request-resolve';
import { listUsers, parseRoles } from '@/lib/sharepoint/lists';
import {
  createSuggestion,
  getSuggestionById,
  getSuggestionForRequestOrThrow,
  listSuggestionsForRequestItem,
  mapSuggestionToApi,
  updateSuggestionAction,
} from '@/lib/sharepoint/working-gcp-suggestions';

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
  routeRequestId: string,
  suggestionText: string,
  submitterName: string,
) {
  const requestRecord = await findRequestByRouteId(routeRequestId);
  if (!requestRecord) return;

  const reviewerUsers = await listUsers();
  const recipients = dedupeEmails(
    reviewerUsers
      .filter((u) => u.isActive && parseRoles(u.roles).includes(REVIEWER_SOURCE_ROLE))
      .map((u) => u.email),
  );
  if (recipients.length === 0) return;

  const linkId = requestRouteIdForUrl(requestRecord);
  const requestUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/requests/${linkId}`;

  const plainSuggestion = suggestionText.replace(/<[^>]*>/g, '').trim();

  const detailsHtml = `
    A Working GCPC user has added a suggestion regarding the request data. Please review.<br><br>
    <strong>Request No:</strong> ${escapeHtml(String(requestRecord.requestNo ?? ''))}<br>
    <strong>Title:</strong> ${escapeHtml(String(requestRecord.requestTitle ?? ''))}<br>
    <strong>Type:</strong> ${escapeHtml(String(requestRecord.routingType ?? ''))} / ${escapeHtml(String(requestRecord.requestType ?? ''))}<br>
    <strong>Company:</strong> ${escapeHtml(String(requestRecord.companyName ?? ''))} (${escapeHtml(String(requestRecord.companyCode ?? ''))})<br>
    <strong>Submitted By:</strong> ${escapeHtml(submitterName)}<br><br>
    <strong>Suggestion:</strong><br>
    <blockquote style="border-left:4px solid #667eea;margin:8px 0;padding:8px 16px;background:#f3f4f6;">
      ${escapeHtml(plainSuggestion)}
    </blockquote>
  `;

  const subject = `Working GCPC suggestion on request: ${String(requestRecord.requestNo ?? '')}`;
  const html = getCustomTemplate(subject, detailsHtml, 'Review Request', requestUrl, 'GCP Central');

  const result = await sendEmail({
    to: recipients,
    subject,
    html,
    text: htmlToPlainText(html),
  });

  if (!result.success) {
    console.error('Reviewer notification for Working GCPC suggestion failed:', {
      requestId: routeRequestId,
      error: result.error,
    });
  }
}

function matchesVisibility(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  sourceRoleRaw: string | null | undefined,
): boolean {
  const sr = (sourceRoleRaw ?? '').trim().toLowerCase();
  const checks: boolean[] = [];
  if (hasRole(user, 'reviewer') || hasRole(user, 'verifier') || hasRole(user, 'admin')) {
    checks.push(sr === REVIEWER_SOURCE_ROLE || sr === '');
  }
  if (hasRole(user, 'working_gcpc') || hasRole(user, 'verifier')) {
    checks.push(sr === WORKING_GCPC_SOURCE_ROLE);
  }
  return checks.some(Boolean);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'You must be signed in to submit suggestions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { suggestion, sourceRole: requestedSourceRole } = body;
    const normalizedSuggestion = typeof suggestion === 'string' ? suggestion.trim() : '';
    const normalizedRequestedSourceRole =
      typeof requestedSourceRole === 'string' ? requestedSourceRole.trim().toLowerCase() : '';

    if (!normalizedSuggestion) {
      return NextResponse.json({ error: 'Suggestion is required' }, { status: 400 });
    }

    const requestRecord = await findRequestByRouteId(id);
    if (!requestRecord?.id) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (
      normalizedRequestedSourceRole &&
      ![REVIEWER_SOURCE_ROLE, WORKING_GCPC_SOURCE_ROLE].includes(normalizedRequestedSourceRole)
    ) {
      return NextResponse.json({ error: 'Invalid suggestion source role' }, { status: 400 });
    }

    const requestStatus = (requestRecord.status ?? '').trim().toLowerCase();
    const sourceRole =
      normalizedRequestedSourceRole ||
      (hasRole(user, 'working_gcpc') &&
      !hasRole(user, 'reviewer') &&
      requestStatus === DRAFT_REVIEW_STATUS
        ? WORKING_GCPC_SOURCE_ROLE
        : REVIEWER_SOURCE_ROLE);

    const isReviewerSuggestion = sourceRole === REVIEWER_SOURCE_ROLE;
    const isWorkingGcpcSuggestion = sourceRole === WORKING_GCPC_SOURCE_ROLE;

    if (isReviewerSuggestion && !hasRole(user, 'reviewer') && !hasRole(user, 'admin')) {
      return NextResponse.json(
        { error: 'Only reviewers and admins can submit reviewer suggestions' },
        { status: 403 },
      );
    }

    if (isWorkingGcpcSuggestion && !hasRole(user, 'working_gcpc') && !hasRole(user, 'admin')) {
      return NextResponse.json(
        { error: 'Only Working GCPC users and admins can submit Working GCPC suggestions' },
        { status: 403 },
      );
    }

    if (isWorkingGcpcSuggestion && requestStatus !== DRAFT_REVIEW_STATUS) {
      return NextResponse.json(
        { error: 'Working GCPC suggestions can only be submitted during Draft Review' },
        { status: 400 },
      );
    }

    const created = await createSuggestion({
      requestItemId: requestRecord.id,
      submitterUserItemId: user.id,
      reviewerName: user.name,
      suggestionText: normalizedSuggestion,
      sourceRole,
    });

    if (isWorkingGcpcSuggestion) {
      await notifyReviewersOfWorkingGcpcSuggestion(id, normalizedSuggestion, user.name).catch((emailError) => {
        console.error('Reviewer notification failed on Working GCPC suggestion:', emailError);
      });
    }

    const apiId = requestRouteIdForUrl(requestRecord);
    return NextResponse.json(mapSuggestionToApi(created, apiId));
  } catch (error) {
    console.error('Error creating reviewer suggestion:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in to view suggestions' }, { status: 403 });
    }

    const { id } = await params;
    const requestRecord = await findRequestByRouteId(id);
    if (!requestRecord?.id) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const rows = await listSuggestionsForRequestItem(requestRecord.id);
    const filtered = rows.filter((row) => matchesVisibility(user, row.sourceRole));
    const apiId = requestRouteIdForUrl(requestRecord);

    return NextResponse.json(filtered.map((r) => mapSuggestionToApi(r, apiId)));
  } catch (error) {
    console.error('Error fetching reviewer suggestions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();

    if (!user || (!hasRole(user, 'verifier') && !hasRole(user, 'admin'))) {
      return NextResponse.json(
        { error: 'Only verifiers and admins can update suggestion status' },
        { status: 403 },
      );
    }
    const { id } = await params;

    const body = await request.json();
    const { suggestionId, action } = body;
    const normalizedSuggestionId = typeof suggestionId === 'string' ? suggestionId.trim() : '';
    const normalizedAction = typeof action === 'string' ? action.trim().toLowerCase() : '';

    if (!normalizedSuggestionId || !normalizedAction) {
      return NextResponse.json({ error: 'Suggestion ID and action are required' }, { status: 400 });
    }

    if (!SUGGESTION_ACTIONS.includes(normalizedAction as (typeof SUGGESTION_ACTIONS)[number])) {
      return NextResponse.json({ error: 'Invalid action value' }, { status: 400 });
    }

    const spRequest = await findRequestByRouteId(id);
    if (!spRequest?.id) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    await getSuggestionForRequestOrThrow(normalizedSuggestionId, spRequest.id);
    await updateSuggestionAction(normalizedSuggestionId, normalizedAction);

    const updated = await getSuggestionById(normalizedSuggestionId);
    if (
      !updated?.id ||
      String(updated.requestIdLookupId ?? '').trim() !== String(spRequest.id).trim()
    ) {
      return NextResponse.json({ error: 'Suggestion not found for this request' }, { status: 404 });
    }
    const apiId = requestRouteIdForUrl(spRequest);
    return NextResponse.json(mapSuggestionToApi(updated, apiId));
  } catch (error) {
    if (error instanceof Error && error.message === 'Suggestion not found for this request') {
      return NextResponse.json({ error: 'Suggestion not found for this request' }, { status: 404 });
    }
    console.error('Error updating reviewer suggestion:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
