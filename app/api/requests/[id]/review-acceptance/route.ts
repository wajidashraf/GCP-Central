import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth/get-current-user";
import { hasRole } from "@/src/lib/auth/has-role";
import { REQUEST_STATUS_MAP } from "@/src/constants/enums/requestStatus";
import { loadReviewAcceptance } from "@/src/lib/requests/review-acceptance-load";
import { findRequestByRouteId, userMatchesRequestCompany } from "@/lib/sharepoint/request-resolve";
import { updateItem } from "@/lib/sharepoint/lists";

const COMPLETE_REVIEW = REQUEST_STATUS_MAP.COMPLETE_REVIEW.label.toLowerCase();
const PENDING_ENDORSE = REQUEST_STATUS_MAP.PENDING_ENDORSE.label;

function canAccessReviewAcceptance(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  request: NonNullable<Awaited<ReturnType<typeof findRequestByRouteId>>>,
) {
  const isAdmin = hasRole(user, "admin");
  const isHoc = hasRole(user, "hoc");
  if (!isAdmin && !isHoc) return { ok: false as const, reason: "forbidden" };
  if (isAdmin) return { ok: true as const };
  if (!userMatchesRequestCompany(user, request)) {
    return { ok: false as const, reason: "company" };
  }
  return { ok: true as const };
}

type SelectedCode = "1a" | "1b" | "2" | "3" | "4";

function isSelectedCode(value: unknown): value is SelectedCode {
  return value === "1a" || value === "1b" || value === "2" || value === "3" || value === "4";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    const { id } = await params;
    const result = await loadReviewAcceptance(id, user);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("review-acceptance GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const selectedCode = (body as { selectedCode?: unknown }).selectedCode;
    const signUrl = typeof (body as { signUrl?: unknown }).signUrl === "string" ? (body as { signUrl: string }).signUrl.trim() : "";
    const signPublicIdRaw = (body as { signPublicId?: unknown }).signPublicId;
    const signPublicId =
      typeof signPublicIdRaw === "string" && signPublicIdRaw.trim() ? signPublicIdRaw.trim() : null;
    const code1bExceptions = Array.isArray((body as { code1bExceptions?: unknown }).code1bExceptions)
      ? (body as { code1bExceptions: unknown[] }).code1bExceptions
          .filter((x): x is string => typeof x === "string")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];

    if (!isSelectedCode(selectedCode)) {
      return NextResponse.json({ error: "selectedCode must be 1a, 1b, 2, 3, or 4" }, { status: 400 });
    }
    if (!signUrl) {
      return NextResponse.json({ error: "signUrl is required" }, { status: 400 });
    }

    const requestRecord = await findRequestByRouteId(id);
    if (!requestRecord?.id) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const access = canAccessReviewAcceptance(user, requestRecord);
    if (!access.ok) {
      const message =
        access.reason === "company"
          ? "HOC must belong to the same company as this request"
          : "Only admins or HOC can submit review acceptance";
      return NextResponse.json({ error: message }, { status: 403 });
    }

    if ((requestRecord.status ?? "").trim().toLowerCase() !== COMPLETE_REVIEW) {
      return NextResponse.json(
        { error: "Submission is only allowed while the request is in Complete Review" },
        { status: 400 },
      );
    }

    if (requestRecord.hocReviewAcceptanceSignedAt) {
      return NextResponse.json({ error: "Review acceptance has already been submitted" }, { status: 400 });
    }

    const code1bComment =
      selectedCode === "1b" && code1bExceptions.length > 0 ? code1bExceptions.join(", ") : null;
    const reviewConclusionCode1bCommentFinal = selectedCode === "1b" ? code1bComment : null;

    const now = new Date().toISOString();
    const signerId = Number(user.id);

    const requestsListId = process.env.REQUESTS_LIST_ID;
    if (!requestsListId) {
      return NextResponse.json({ error: "REQUESTS_LIST_ID is not configured" }, { status: 500 });
    }

    const fields: Record<string, unknown> = {
      reviewConclusionCode1a: selectedCode === "1a",
      reviewConclusionCode1b: selectedCode === "1b",
      reviewConclusionCode1bComment: reviewConclusionCode1bCommentFinal,
      reviewConclusionCode2: selectedCode === "2",
      reviewConclusionCode3: selectedCode === "3",
      reviewConclusionCode4: selectedCode === "4",
      hocReviewAcceptanceSignUrl: signUrl,
      hocReviewAcceptanceSignPublicId: signPublicId ?? "",
      hocReviewAcceptanceSignedAt: now,
      status: PENDING_ENDORSE,
      outcome: PENDING_ENDORSE,
    };
    if (Number.isFinite(signerId)) {
      fields.hocReviewAcceptanceSignerLookupId = signerId;
    }

    await updateItem(requestsListId, requestRecord.id, fields);

    return NextResponse.json({
      id: (requestRecord.uuid ?? "").trim() || requestRecord.id,
      status: PENDING_ENDORSE,
      updatedAt: now,
    });
  } catch (error) {
    console.error("review-acceptance POST:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
