import type { CurrentUser } from "@/src/types/auth";
import { hasRole } from "@/src/lib/auth/has-role";
import { REQUEST_STATUS_MAP } from "@/src/constants/enums/requestStatus";
import {
  findRequestByRouteId,
  parseSharePointBool,
  userMatchesRequestCompany,
  type SPRequestRowExtended,
} from "@/lib/sharepoint/request-resolve";
import { findEngagementsByRequestUuid } from "@/lib/sharepoint/engagements";

const COMPLETE_REVIEW = REQUEST_STATUS_MAP.COMPLETE_REVIEW.label.toLowerCase();
const PENDING_ENDORSE = REQUEST_STATUS_MAP.PENDING_ENDORSE.label;
const ENGAGEMENT_COMPLETED = "completed";

function engagementRank(num: string | null | undefined): number {
  if (!num) return -1;
  const m = /^R(\d+)$/i.exec(num.trim());
  return m ? parseInt(m[1], 10) : -1;
}

function canAccessReviewAcceptance(user: CurrentUser, request: SPRequestRowExtended) {
  const isAdmin = hasRole(user, "admin");
  const isHoc = hasRole(user, "hoc");
  if (!isAdmin && !isHoc) return { ok: false as const, reason: "forbidden" as const };
  if (isAdmin) return { ok: true as const };
  if (!userMatchesRequestCompany(user, request)) {
    return { ok: false as const, reason: "company" as const };
  }
  return { ok: true as const };
}

export type ReviewAcceptancePayload = {
  request: {
    requestNo: string;
    requestTitle: string;
    status: string;
    verifiedAt: string | null;
  };
  latestEngagement: { engagementNumber: string | null; updatedAt: string } | null;
  form: {
    selectedCode: "1a" | "1b" | "2" | "3" | "4" | null;
    code1bExceptions: string[];
  };
  signature: { signUrl: string; signedAt: string } | null;
  readOnly: boolean;
};

export type ReviewAcceptanceLoadResult =
  | { ok: true; data: ReviewAcceptancePayload }
  | { ok: false; status: 401 | 403 | 404 | 400; error: string };

function normalizeRequestId(raw: string | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const id = raw.trim();
  if (!id) return null;
  return id;
}

function verifiedAtIso(request: SPRequestRowExtended): string | null {
  const raw = request.verifiedOn ?? request.verifiedAt;
  if (!raw) return null;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function hocSignedAtIso(request: SPRequestRowExtended): string | null {
  const raw = request.hocReviewAcceptanceSignedAt;
  if (!raw) return null;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Shared loader for the review acceptance page and GET API.
 */
export async function loadReviewAcceptance(
  requestIdRaw: string | undefined,
  user: CurrentUser | null,
): Promise<ReviewAcceptanceLoadResult> {
  if (!user) {
    return { ok: false, status: 401, error: "Authentication required" };
  }

  const id = normalizeRequestId(requestIdRaw);
  if (!id) {
    return { ok: false, status: 400, error: "Invalid request id" };
  }

  const requestRecord = await findRequestByRouteId(id);
  if (!requestRecord?.id) {
    return { ok: false, status: 404, error: "Request not found" };
  }

  const access = canAccessReviewAcceptance(user, requestRecord);
  if (!access.ok) {
    const message =
      access.reason === "company"
        ? "HOC must belong to the same company as this request"
        : "Only admins or HOC can open review acceptance";
    return { ok: false, status: 403, error: message };
  }

  const statusNorm = (requestRecord.status ?? "").trim().toLowerCase();
  const pendingEndorseNorm = PENDING_ENDORSE.toLowerCase();
  if (statusNorm !== COMPLETE_REVIEW && statusNorm !== pendingEndorseNorm) {
    return {
      ok: false,
      status: 400,
      error: "Review acceptance is only available for Complete Review or Pending Endorse requests",
    };
  }

  const requestUuid = (requestRecord.uuid ?? "").trim() || requestRecord.id;
  const engagementRows = await findEngagementsByRequestUuid(requestUuid);
  const withNumber = engagementRows.filter((e) => e.engagementNumber);
  const completed = withNumber.filter(
    (e) => (e.status ?? "").trim().toLowerCase() === ENGAGEMENT_COMPLETED,
  );
  const pool = completed.length > 0 ? completed : withNumber;
  const latestEng = [...pool].sort(
    (a, b) => engagementRank(b.engagementNumber) - engagementRank(a.engagementNumber),
  )[0];

  const submitted = Boolean(
    requestRecord.hocReviewAcceptanceSignedAt && requestRecord.hocReviewAcceptanceSignUrl,
  );

  let selectedCode: ReviewAcceptancePayload["form"]["selectedCode"] = null;
  if (parseSharePointBool(requestRecord.reviewConclusionCode1a)) selectedCode = "1a";
  else if (parseSharePointBool(requestRecord.reviewConclusionCode1b)) selectedCode = "1b";
  else if (parseSharePointBool(requestRecord.reviewConclusionCode2)) selectedCode = "2";
  else if (parseSharePointBool(requestRecord.reviewConclusionCode3)) selectedCode = "3";
  else if (parseSharePointBool(requestRecord.reviewConclusionCode4)) selectedCode = "4";

  const code1bExceptions = requestRecord.reviewConclusionCode1bComment
    ? String(requestRecord.reviewConclusionCode1bComment)
        .split(",")
        .map((s) => s.trim())
    : [];

  const latestUpdated =
    (latestEng as { Modified?: string }).Modified ??
    (latestEng as { modified?: string }).modified ??
    "";

  const data: ReviewAcceptancePayload = {
    request: {
      requestNo: String(requestRecord.requestNo ?? ""),
      requestTitle: String(requestRecord.requestTitle ?? ""),
      status: String(requestRecord.status ?? ""),
      verifiedAt: verifiedAtIso(requestRecord),
    },
    latestEngagement: latestEng
      ? {
          engagementNumber: latestEng.engagementNumber ?? null,
          updatedAt: latestUpdated
            ? new Date(String(latestUpdated)).toISOString()
            : new Date().toISOString(),
        }
      : null,
    form: {
      selectedCode,
      code1bExceptions,
    },
    signature: submitted
      ? {
          signUrl: String(requestRecord.hocReviewAcceptanceSignUrl ?? ""),
          signedAt: hocSignedAtIso(requestRecord) ?? new Date().toISOString(),
        }
      : null,
    readOnly: submitted || statusNorm === pendingEndorseNorm,
  };

  return { ok: true, data };
}
