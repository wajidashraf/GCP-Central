import { REQUEST_STATUS_MAP } from "@/src/constants/enums/requestStatus";
import { hasRole } from "@/src/lib/auth/has-role";
import type { CurrentUser } from "@/src/types/auth";
import {
  loadSharePointRequestBundle,
  resolveProjectForBundle,
  type SharePointRequestBundle,
} from "@/lib/sharepoint/request-bundle";
import { userMatchesRequestCompany } from "@/lib/sharepoint/request-resolve";
import { findEngagementsByRequestUuid } from "@/lib/sharepoint/engagements";

const PENDING_ENDORSE = REQUEST_STATUS_MAP.PENDING_ENDORSE.label.toLowerCase();
const ENGAGEMENT_COMPLETED = "completed";

function normalizeRequestId(raw: string | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const id = raw.trim();
  return id || null;
}

function engagementRank(num: string | null | undefined): number {
  if (!num) return -1;
  const m = /^R(\d+)$/i.exec(num.trim());
  return m ? parseInt(m[1], 10) : -1;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function canAccessEndorsement(user: CurrentUser, requestCompany: SharePointRequestBundle["request"]) {
  const isAdmin = hasRole(user, "admin");
  const isHoc = hasRole(user, "hoc");
  if (!isAdmin && !isHoc) return { ok: false as const, reason: "forbidden" as const };
  if (isAdmin) return { ok: true as const };
  if (!userMatchesRequestCompany(user, requestCompany)) {
    return { ok: false as const, reason: "company" as const };
  }
  return { ok: true as const };
}

type EndorsementKind = "RTP" | "PBL" | "JVP" | "GENERIC";

export type EndorsementPayload = {
  request: {
    id: string;
    requestNo: string;
    companyCode: string;
    requestTitle: string;
    requestType: string;
    companyName: string;
    status: string;
    reviewAcceptedAt: string | null;
  };
  endorsement: {
    no: string;
    kind: EndorsementKind;
    title: string;
    subtitle: string;
    projectCode: string;
    reviewNo: string;
    reviewDate: string | null;
    acceptanceDate: string | null;
    procurementMethod?: string;
    bidderCount?: number;
    clientName?: string;
    projectName?: string;
  };
};

export type EndorsementLoadResult =
  | { ok: true; data: EndorsementPayload }
  | { ok: false; status: 401 | 403 | 404 | 400; error: string };

function getRequestTypeKind(requestType: string): EndorsementKind {
  const normalized = requestType.trim().toUpperCase();
  if (normalized === "RTP") return "RTP";
  if (normalized === "PBL") return "PBL";
  if (normalized === "JVP") return "JVP";
  return "GENERIC";
}

function getSubtitle(kind: EndorsementKind) {
  if (kind === "PBL") return "(Prospective Bidders List)";
  if (kind === "JVP") return "(JV Formation / Collaboration Partners Submission)";
  if (kind === "RTP") return "(Registration of Tender / Proposal List)";
  return "(Request Endorsement)";
}

function getProjectCode(bundle: SharePointRequestBundle): string {
  const { rtp, pbl, jvp, projects } = bundle;
  const pblProject = resolveProjectForBundle(
    projects,
    pbl?.projectIdLookupId ?? pbl?.projectIdId ?? pbl?.projectIdLookup ?? pbl?.projectId,
  );
  const jvpProject = resolveProjectForBundle(
    projects,
    jvp?.projectIdLookupId ?? jvp?.projectIdId ?? jvp?.projectIdLookup ?? jvp?.projectId,
  );
  const rtpProject = resolveProjectForBundle(
    projects,
    rtp?.projectIdLookupId ?? rtp?.projectIdId ?? rtp?.projectIdLookup ?? rtp?.projectId,
  );

  return (
    (pbl?.projectCode ?? "").trim() ||
    pblProject?.projectCode ||
    (jvp?.projectCode ?? "").trim() ||
    jvpProject?.projectCode ||
    rtpProject?.projectCode ||
    "-"
  );
}

function procurementMethodLabel(value: number | null | undefined) {
  if (typeof value !== "number") return "Procurement Method";
  return `Procurement method ${value}`;
}

function normalizeRefPart(value: string | null | undefined, fallback: string) {
  const cleaned = (value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\//g, "-")
    .toUpperCase();
  return cleaned || fallback;
}

export async function loadEndorsement(
  requestIdRaw: string | undefined,
  user: CurrentUser | null,
): Promise<EndorsementLoadResult> {
  if (!user) {
    return { ok: false, status: 401, error: "Authentication required" };
  }

  const id = normalizeRequestId(requestIdRaw);
  if (!id) {
    return { ok: false, status: 400, error: "Invalid request id" };
  }

  const bundle = await loadSharePointRequestBundle(id);
  if (!bundle) {
    return { ok: false, status: 404, error: "Request not found" };
  }

  const request = bundle.request;
  const access = canAccessEndorsement(user, request);
  if (!access.ok) {
    const error =
      access.reason === "company"
        ? "HOC must belong to the same company as this request"
        : "Only admins or HOC can open endorsement";
    return { ok: false, status: 403, error };
  }

  if ((request.status ?? "").trim().toLowerCase() !== PENDING_ENDORSE) {
    return {
      ok: false,
      status: 400,
      error: "Endorsement is only available while the request is Pending Endorse",
    };
  }

  const requestUuid = (request.uuid ?? "").trim() || request.id;
  const engagementRows = await findEngagementsByRequestUuid(requestUuid);
  const withNumber = engagementRows.filter((e) => e.engagementNumber);
  const completed = withNumber.filter(
    (e) => (e.status ?? "").trim().toLowerCase() === ENGAGEMENT_COMPLETED,
  );
  const pool = completed.length > 0 ? completed : withNumber;
  const latestEngagement = [...pool].sort(
    (a, b) => engagementRank(b.engagementNumber) - engagementRank(a.engagementNumber),
  )[0];

  const kind = getRequestTypeKind(String(request.requestType ?? ""));
  const projectCode = getProjectCode(bundle);
  const typeRef = kind === "GENERIC" ? String(request.requestType ?? "").trim().toUpperCase() || "REQ" : kind;
  const endorsementNo = `${normalizeRefPart(request.companyCode, "COMP")}/${normalizeRefPart(projectCode, "PROJECT")}/${normalizeRefPart(typeRef, "REQ")}/${normalizeRefPart(request.requestNo, "REQUEST")}/E`;

  const verifiedRaw = request.verifiedOn ?? request.verifiedAt;
  const latestEngModified =
    (latestEngagement as { Modified?: string })?.Modified ??
    (latestEngagement as { modified?: string })?.modified;

  const pbl = bundle.pbl;
  const jvp = bundle.jvp;
  const rtp = bundle.rtp;
  const pblProject = resolveProjectForBundle(
    bundle.projects,
    pbl?.projectIdLookupId ?? pbl?.projectIdId ?? pbl?.projectIdLookup ?? pbl?.projectId,
  );
  const jvpProject = resolveProjectForBundle(
    bundle.projects,
    jvp?.projectIdLookupId ?? jvp?.projectIdId ?? jvp?.projectIdLookup ?? jvp?.projectId,
  );
  const rtpProject = resolveProjectForBundle(
    bundle.projects,
    rtp?.projectIdLookupId ?? rtp?.projectIdId ?? rtp?.projectIdLookup ?? rtp?.projectId,
  );

  const bidderCount = bundle.pblBidderItems.filter((bidder) => {
    const pid = String(bundle.pbl?.id ?? "").trim();
    if (!pid) return false;
    const candidates = [
      bidder.pblRequestId,
      bidder.pblRequestIdLookupId,
      bidder.pblRequestIdId,
      bidder.pblRequestIdLookup,
    ].map((c) => String(c ?? "").trim());
    return candidates.some((c) => c === pid);
  }).length;

  return {
    ok: true,
    data: {
      request: {
        id: (request.uuid ?? "").trim() || request.id,
        requestNo: String(request.requestNo ?? ""),
        companyCode: String(request.companyCode ?? ""),
        requestTitle: String(request.requestTitle ?? ""),
        requestType: String(request.requestType ?? ""),
        companyName: String(request.companyName ?? ""),
        status: String(request.status ?? ""),
        reviewAcceptedAt: formatDate(request.hocReviewAcceptanceSignedAt),
      },
      endorsement: {
        no: endorsementNo,
        kind,
        title: "ENDORSEMENT",
        subtitle: getSubtitle(kind),
        projectCode,
        reviewNo: latestEngagement?.engagementNumber ?? "-",
        reviewDate: formatDate(
          verifiedRaw ? String(verifiedRaw) : latestEngModified ? String(latestEngModified) : undefined,
        ),
        acceptanceDate: formatDate(request.hocReviewAcceptanceSignedAt),
        procurementMethod: pbl ? procurementMethodLabel(Number(pbl.procurementMethod)) : undefined,
        bidderCount: pbl ? bidderCount : undefined,
        clientName: rtp?.clientName,
        projectName:
          pblProject?.projectName ??
          jvpProject?.projectName ??
          rtpProject?.projectName ??
          rtp?.projectName,
      },
    },
  };
}
