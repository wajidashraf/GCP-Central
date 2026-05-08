import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { hasRole } from '@/src/lib/auth/has-role';
import { REQUEST_STATUS, REQUEST_STATUS_MAP } from '@/src/constants/enums/requestStatus';
import { sendEmail } from '@/lib/email/email-service';
import { getCustomTemplate, htmlToPlainText } from '@/lib/email/email-templates';
import { listItems, updateItem } from '@/lib/sharepoint/lists';

const READY_FOR_ENGAGEMENT_STATUS = REQUEST_STATUS_MAP.READY_FOR_ENGAGEMENT.label;

function normalizeRequestStatus(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  type RequestStatusItem = typeof REQUEST_STATUS[number];

  const normalized = value.trim().toLowerCase();
  const matched = REQUEST_STATUS.find((status: RequestStatusItem) => status.label.toLowerCase() === normalized);
  return matched?.label ?? null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendReadyForEngagementEmail({
  requestNo,
  requestTitle,
  requestorEmail,
  requestorName,
  verifierName,
  comment,
  requestId,
}: {
  requestNo: string;
  requestTitle: string;
  requestorEmail: string;
  requestorName: string;
  verifierName: string;
  comment: string;
  requestId: string;
}) {
  const recipientEmail = requestorEmail.trim().toLowerCase();
  if (!recipientEmail) {
    console.warn('Skipping Ready for Engagement email: requestor email is missing', {
      requestId,
      requestNo,
    });
    return;
  }

  const requestUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/requests/${requestId}`;
  const html = getCustomTemplate(
    `Request Ready for Engagement: ${requestNo}`,
    [
      `Hello ${escapeHtml(requestorName || 'Requestor')},`,
      `Your request "${escapeHtml(requestTitle)}" has been verified by ${escapeHtml(verifierName)} and is now Ready for Engagement.`,
      `Verifier comment: ${escapeHtml(comment)}`,
    ].join('<br><br>'),
    'View Request',
    requestUrl,
    'GCP Central'
  );

  const result = await sendEmail({
    to: recipientEmail,
    subject: `Ready for Engagement: ${requestNo}`,
    html,
    text: htmlToPlainText(html),
  });

  if (!result.success) {
    console.error('Ready for Engagement email failed:', {
      requestId,
      requestNo,
      requestorEmail: recipientEmail,
      error: result.error,
    });
    return;
  }

  console.log('Ready for Engagement email accepted by SMTP:', {
    requestId,
    requestNo,
    requestorEmail: recipientEmail,
    messageId: result.messageId,
    accepted: result.accepted,
    rejected: result.rejected,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || (!hasRole(user, 'verifier') && !hasRole(user, 'admin'))) {
      return NextResponse.json(
        { error: 'Only verifiers and admins can submit verification comments' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { comment, requestStatus } = body;
    const normalizedComment = typeof comment === 'string' ? comment.trim() : '';
    const normalizedRequestStatus = normalizeRequestStatus(requestStatus);

    if (!normalizedComment || !normalizedRequestStatus) {
      return NextResponse.json(
        { error: 'Comment and request status are required' },
        { status: 400 }
      );
    }
    if (normalizedRequestStatus.toLowerCase() === 'new') {
      return NextResponse.json(
        { error: 'Please select a status different from New' },
        { status: 400 }
      );
    }

    type RequestItemDetail = {
      id: string;
      uuid?: string;
      requestNo?: string;
      requestTitle?: string;
      requestorEmail?: string;
      requestorName?: string;
    };

    // Check if request exists
    const requestsListId = process.env.REQUESTS_LIST_ID;
    if (!requestsListId) {
      return NextResponse.json({ error: 'REQUESTS_LIST_ID is not configured' }, { status: 500 });
    }
    const requestItems = await listItems<RequestItemDetail>(requestsListId);
    const requestRecord = requestItems.find((item: RequestItemDetail) => {
      const uuid = (item.uuid ?? '').trim();
      return item.id === id || uuid === id || (item.requestNo ?? '').trim() === id;
    });

    if (!requestRecord) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    // Create or update verifier comment
    await updateItem(requestsListId, requestRecord.id, {
      status: normalizedRequestStatus,
      verifierCommentText: normalizedComment,
      verifierDecisionCode: normalizedRequestStatus,
      verifiedBy: user.name,
      verifiedAt: new Date().toISOString(),
      outcome: normalizedRequestStatus,
    });
    const requestRouteId = (requestRecord.uuid ?? '').trim() || requestRecord.id;

    if (normalizedRequestStatus === READY_FOR_ENGAGEMENT_STATUS) {
      await sendReadyForEngagementEmail({
        requestNo: requestRecord.requestNo ?? requestRouteId,
        requestTitle: requestRecord.requestTitle ?? 'Request',
        requestorEmail: requestRecord.requestorEmail ?? '',
        requestorName: requestRecord.requestorName ?? 'Requestor',
        verifierName: user.name,
        comment: normalizedComment,
        requestId: requestRouteId,
      }).catch((emailError) => {
        console.error('Ready for Engagement notification failed:', emailError);
      });
    }

    return NextResponse.json({
      requestId: requestRouteId,
      decisionCode: normalizedRequestStatus,
      comment: normalizedComment,
      verifiedBy: user.name,
    });
  } catch (error) {
    console.error('Error creating verifier comment:', error);
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
    const { id } = await params;

    type VerifierCommentItem = {
      id: string;
      uuid?: string;
      verifierCommentText?: string;
      verifierDecisionCode?: string;
      verifiedBy?: string;
      verifiedAt?: string;
    };

    const requestsListId = process.env.REQUESTS_LIST_ID;
    if (!requestsListId) {
      return NextResponse.json({ error: 'REQUESTS_LIST_ID is not configured' }, { status: 500 });
    }
    const requestItems = await listItems<VerifierCommentItem>(requestsListId);
    const requestRecord = requestItems.find((item: VerifierCommentItem) => {
      const uuid = (item.uuid ?? '').trim();
      return item.id === id || uuid === id;
    });

    if (!requestRecord || !(requestRecord.verifierCommentText ?? '').trim()) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      requestId: (requestRecord.uuid ?? '').trim() || requestRecord.id,
      comment: requestRecord.verifierCommentText ?? '',
      decisionCode: requestRecord.verifierDecisionCode ?? '',
      verifiedBy: requestRecord.verifiedBy ?? '',
      verifiedAt: requestRecord.verifiedAt ?? null,
    });
  } catch (error) {
    console.error('Error fetching verifier comment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
