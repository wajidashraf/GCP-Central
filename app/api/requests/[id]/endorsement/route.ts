import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { REQUEST_STATUS_MAP } from "@/src/constants/enums/requestStatus";
import { getCurrentUser } from "@/src/lib/auth/get-current-user";
import { loadEndorsement } from "@/src/lib/requests/endorsement-load";

const PENDING_ACK = REQUEST_STATUS_MAP.PENDING_ACK.label;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id } = await params;
    const result = await loadEndorsement(id, user);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const updated = await prisma.request.update({
      where: { id },
      data: {
        status: PENDING_ACK,
      },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("endorsement POST:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
