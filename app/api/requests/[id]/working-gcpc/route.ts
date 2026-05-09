import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { hasRole } from '@/src/lib/auth/has-role';
import { REQUEST_STATUS_MAP } from '@/src/constants/enums/requestStatus';
import { listItems, updateItem } from '@/lib/sharepoint/lists';

const PENDING_REVIEW_STATUS = REQUEST_STATUS_MAP.PENDING_REVIEW.label;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (!hasRole(user, 'working_gcpc') && !hasRole(user, 'admin'))) {
      return NextResponse.json(
        { error: 'Only working_gcpc and admins can mark reviews as Pending Review' },
        { status: 403 }
      );
    }

    type RequestStatusItem = { id: string; uuid?: string; status?: string };

    const { id } = await params;
    const requestsListId = process.env.REQUESTS_LIST_ID;
    if (!requestsListId) {
      return NextResponse.json({ error: 'REQUESTS_LIST_ID is not configured' }, { status: 500 });
    }
    const requestItems = await listItems<RequestStatusItem>(requestsListId);
    const requestRecord = requestItems.find((item: RequestStatusItem) => {
      const uuid = (item.uuid ?? '').trim();
      return item.id === id || uuid === id;
    });

    if (!requestRecord) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if ((requestRecord.status ?? '').trim().toLowerCase() !== 'r') {
      return NextResponse.json(
        { error: 'Only requests in review can be marked as Pending Review' },
        { status: 400 }
      );
    }

    await updateItem(requestsListId, requestRecord.id, {
      status: PENDING_REVIEW_STATUS,
      outcome: PENDING_REVIEW_STATUS,
    });
    const updated = {
      id: (requestRecord.uuid ?? '').trim() || requestRecord.id,
      status: PENDING_REVIEW_STATUS,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error marking review as Pending Review:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
