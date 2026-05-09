import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth/get-current-user";
import { REQUEST_STATUS_MAP } from "@/src/constants/enums/requestStatus";
import { findRequestByRouteId } from "@/lib/sharepoint/request-resolve";
import { updateItem } from "@/lib/sharepoint/lists";
import {
  createRequestSignature,
  findSignatureByRequestAndMember,
  getSignatoryMemberById,
  listSignaturesForRequest,
} from "@/lib/sharepoint/signatories";

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
  member: { name: string; email: string },
) {
  return (
    normalizeName(user.name) === normalizeName(member.name) ||
    normalizeEmail(user.email) === normalizeEmail(member.email)
  );
}

function groupFromMember(row: { signatoryGroup?: string; group?: string } | null) {
  return (row?.signatoryGroup ?? row?.group ?? "").trim().toLowerCase();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id: requestRouteId } = await params;
    const body = await request.json();
    const signatoryMemberId =
      typeof body.signatoryMemberId === "string" ? body.signatoryMemberId.trim() : "";
    const signUrl = typeof body.signUrl === "string" ? body.signUrl.trim() : "";
    const signPublicId =
      typeof body.signPublicId === "string" && body.signPublicId.trim() ? body.signPublicId.trim() : null;

    if (!signatoryMemberId || !signUrl) {
      return NextResponse.json({ error: "signatoryMemberId and signUrl are required" }, { status: 400 });
    }

    const requestsListId = process.env.REQUESTS_LIST_ID;
    if (!requestsListId) {
      return NextResponse.json({ error: "REQUESTS_LIST_ID is not configured" }, { status: 500 });
    }

    const requestRecord = await findRequestByRouteId(requestRouteId);
    if (!requestRecord?.id) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if ((requestRecord.status ?? "").trim().toLowerCase() !== PENDING_REVIEW) {
      return NextResponse.json(
        { error: "Signatures can only be submitted while the request is Pending Review" },
        { status: 400 },
      );
    }

    const member = await getSignatoryMemberById(signatoryMemberId);
    if (!member?.id) {
      return NextResponse.json({ error: "Signatory not found" }, { status: 404 });
    }

    if (
      !userMatchesMember(user, {
        name: member.Title ?? "",
        email: member.email ?? "",
      })
    ) {
      return NextResponse.json({ error: "You are not authorised to sign for this member" }, { status: 403 });
    }

    const type = groupFromMember(member);
    if (type !== PREPARED && type !== CONFIRMED) {
      return NextResponse.json({ error: "Invalid signatory group configuration" }, { status: 500 });
    }

    const existing = await findSignatureByRequestAndMember(requestRecord.id, signatoryMemberId);
    if (existing) {
      return NextResponse.json({ error: "This slot is already signed" }, { status: 400 });
    }

    const created = await createRequestSignature({
      requestItemId: requestRecord.id,
      signatoryMemberItemId: signatoryMemberId,
      signatoryName: member.Title ?? "",
      signatoryEmail: member.email ?? "",
      signatoryEmailLower: (member.emailLower ?? member.email ?? "").trim().toLowerCase(),
      signatureGroup: type,
      signUrl,
      signPublicId,
      signerUserItemId: user.id,
    });

    const sigRows = await listSignaturesForRequest(requestRecord.id);
    type SigRow = { signatureGroup?: string; group?: string };
    const preparedCount = sigRows.filter(
      (s: SigRow) => (s.signatureGroup ?? (s as { type?: string }).type ?? "").trim().toLowerCase() === PREPARED,
    ).length;
    const confirmedCount = sigRows.filter(
      (s: SigRow) => (s.signatureGroup ?? (s as { type?: string }).type ?? "").trim().toLowerCase() === CONFIRMED,
    ).length;

    if (preparedCount >= MIN_PREPARED_SIGS && confirmedCount >= MIN_CONFIRMED_SIGS) {
      await updateItem(requestsListId, requestRecord.id, {
        status: COMPLETE_REVIEW,
        outcome: COMPLETE_REVIEW,
      });
    }

    return NextResponse.json(created);
  } catch (error) {
    console.error("Error creating request signature:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
