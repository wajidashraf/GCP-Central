import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { hasRole } from '@/src/lib/auth/has-role';
import { REQUEST_STATUS_MAP } from '@/src/constants/enums/requestStatus';
import { listItems, updateItem } from '@/lib/sharepoint/lists';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (!hasRole(user, 'verifier') && !hasRole(user, 'admin'))) {
      return NextResponse.json(
        { error: 'Only verifiers and admins can complete review' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const requestsListId = process.env.REQUESTS_LIST_ID;
    if (!requestsListId) {
      return NextResponse.json({ error: 'REQUESTS_LIST_ID is not configured' }, { status: 500 });
    }
    const requestItems = await listItems<{ id: string; uuid?: string }>(requestsListId);
    const requestRecord = requestItems.find((item) => {
      const uuid = (item.uuid ?? '').trim();
      return item.id === id || uuid === id;
    });

    if (!requestRecord) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    await updateItem(requestsListId, requestRecord.id, {
      status: REQUEST_STATUS_MAP.COMPLETE_REVIEW.label,
      outcome: REQUEST_STATUS_MAP.COMPLETE_REVIEW.label,
    });
    const updated = {
      id: (requestRecord.uuid ?? '').trim() || requestRecord.id,
      status: REQUEST_STATUS_MAP.COMPLETE_REVIEW.label,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error completing review:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
