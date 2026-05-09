import { NextResponse } from "next/server";
import { REQUEST_STATUS_MAP } from "@/src/constants/enums/requestStatus";
import { getCurrentUser } from "@/src/lib/auth/get-current-user";
import { loadEndorsement } from "@/src/lib/requests/endorsement-load";
import { findRequestByRouteId } from "@/lib/sharepoint/request-resolve";
import { updateItem } from "@/lib/sharepoint/lists";

const PENDING_ACK = REQUEST_STATUS_MAP.PENDING_ACK.label;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    const { id } = await params;
    const result = await loadEndorsement(id, user);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const requestRecord = await findRequestByRouteId(id);
    if (!requestRecord?.id) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const requestsListId = process.env.REQUESTS_LIST_ID;
    if (!requestsListId) {
      return NextResponse.json({ error: "REQUESTS_LIST_ID is not configured" }, { status: 500 });
    }

    const now = new Date().toISOString();
    await updateItem(requestsListId, requestRecord.id, {
      status: PENDING_ACK,
      outcome: PENDING_ACK,
    });

    return NextResponse.json({
      id: (requestRecord.uuid ?? "").trim() || requestRecord.id,
      status: PENDING_ACK,
      updatedAt: now,
    });
  } catch (error) {
    console.error("endorsement POST:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
