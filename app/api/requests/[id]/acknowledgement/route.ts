import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { REQUEST_STATUS_MAP } from "@/src/constants/enums/requestStatus";
import { getCurrentUser } from "@/src/lib/auth/get-current-user";
import { loadAcknowledgement } from "@/src/lib/requests/acknowledgement-load";

const ACK = REQUEST_STATUS_MAP.ACK.label;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const updated = await prisma.request.update({
      where: { id },
      data: {
        ackLetterTextContent,
        status: ACK,
      },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("acknowledgement POST:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
