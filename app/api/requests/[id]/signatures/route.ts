import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/src/lib/auth/get-current-user";
import { REQUEST_STATUS_MAP } from "@/src/constants/enums/requestStatus";

const PENDING_REVIEW = REQUEST_STATUS_MAP.PENDING_REVIEW.label.toLowerCase();
const COMPLETE_REVIEW = REQUEST_STATUS_MAP.COMPLETE_REVIEW.label;
const PREPARED = "prepared";
const CONFIRMED = "confirmed";

const MIN_PREPARED_SIGS = 1;
const MIN_CONFIRMED_SIGS = 2;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function userMatchesMember(
  user: { name: string; email: string },
  member: { name: string; email: string }
) {
  return (
    normalizeName(user.name) === normalizeName(member.name) ||
    normalizeEmail(user.email) === normalizeEmail(member.email)
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id: requestId } = await params;
    const body = await request.json();
    const signatoryMemberId =
      typeof body.signatoryMemberId === "string" ? body.signatoryMemberId.trim() : "";
    const signUrl = typeof body.signUrl === "string" ? body.signUrl.trim() : "";
    const signPublicId =
      typeof body.signPublicId === "string" && body.signPublicId.trim() ? body.signPublicId.trim() : null;

    if (!signatoryMemberId || !signUrl) {
      return NextResponse.json({ error: "signatoryMemberId and signUrl are required" }, { status: 400 });
    }

    const requestRecord = await prisma.request.findUnique({
      where: { id: requestId },
      select: { id: true, status: true },
    });

    if (!requestRecord) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if ((requestRecord.status ?? '').trim().toLowerCase() !== PENDING_REVIEW) {
      return NextResponse.json(
        { error: "Signatures can only be submitted while the request is Pending Review" },
        { status: 400 }
      );
    }

    const member = await prisma.signatoryMember.findUnique({
      where: { id: signatoryMemberId },
    });

    if (!member) {
      return NextResponse.json({ error: "Signatory not found" }, { status: 404 });
    }

    if (!userMatchesMember(user, member)) {
      return NextResponse.json({ error: "You are not authorised to sign for this member" }, { status: 403 });
    }

    const type = (member.group ?? '').trim().toLowerCase();
    if (type !== PREPARED && type !== CONFIRMED) {
      return NextResponse.json({ error: "Invalid signatory group configuration" }, { status: 500 });
    }

    const existing = await prisma.requestSignature.findUnique({
      where: {
        requestId_signatoryMemberId: {
          requestId,
          signatoryMemberId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "This slot is already signed" }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const signature = await tx.requestSignature.create({
        data: {
          requestId,
          signatoryMemberId,
          signatoryName: member.name,
          signatoryEmail: member.email,
          signatoryEmailLower: member.emailLower,
          type,
          signUrl,
          signPublicId,
          signedAt: new Date(),
          signerUserId: user.id,
        },
      });

      type SignatureRow = { type: string };

      const sigRows = await tx.requestSignature.findMany({
        where: { requestId },
        select: { type: true },
      });
      const preparedCount = sigRows.filter((s: SignatureRow) => (s.type ?? '').trim().toLowerCase() === PREPARED).length;
      const confirmedCount = sigRows.filter((s: SignatureRow) => (s.type ?? '').trim().toLowerCase() === CONFIRMED).length;

      if (
        preparedCount >= MIN_PREPARED_SIGS &&
        confirmedCount >= MIN_CONFIRMED_SIGS
      ) {
        await tx.request.update({
          where: { id: requestId },
          data: { status: COMPLETE_REVIEW },
        });
      }

      return signature;
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error("Error creating request signature:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
