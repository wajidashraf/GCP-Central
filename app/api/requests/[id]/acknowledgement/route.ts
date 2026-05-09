import { NextRequest, NextResponse } from "next/server";
import { REQUEST_STATUS_MAP } from "@/src/constants/enums/requestStatus";
import { getCurrentUser } from "@/src/lib/auth/get-current-user";
import { loadAcknowledgement } from "@/src/lib/requests/acknowledgement-load";
import { findRequestByRouteId } from "@/lib/sharepoint/request-resolve";
import { updateItem } from "@/lib/sharepoint/lists";

const ACK = REQUEST_STATUS_MAP.ACK.label;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    const { id } = await params;
    const loadResult = await loadAcknowledgement(id, user);

    if (!loadResult.ok) {
      return NextResponse.json({ error: loadResult.error }, { status: loadResult.status });
    }

    const body = await request.json().catch(() => null);
    const ackLetterTextContent =
      body && typeof body === "object" && typeof (body as { ackLetterTextContent?: unknown }).ackLetterTextContent === "string"
        ? (body as { ackLetterTextContent: string }).ackLetterTextContent.trim()
        : "";

    if (!ackLetterTextContent) {
      return NextResponse.json({ error: "Acknowledgement letter text is required" }, { status: 400 });
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
      ackLetterTextContent,
      status: ACK,
      outcome: ACK,
    });

    return NextResponse.json({
      id: (requestRecord.uuid ?? "").trim() || requestRecord.id,
      status: ACK,
      updatedAt: now,
    });
  } catch (error) {
    console.error("acknowledgement POST:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
