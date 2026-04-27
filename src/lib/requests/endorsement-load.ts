import prisma from "@/lib/prisma";
import { REQUEST_STATUS_MAP } from "@/src/constants/enums/requestStatus";
import { hasRole } from "@/src/lib/auth/has-role";
import type { CurrentUser } from "@/src/types/auth";

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

function formatDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function canAccessEndorsement(user: CurrentUser, requestCompanyId: string) {
  const isAdmin = hasRole(user, "admin");
  const isHoc = hasRole(user, "hoc");
  if (!isAdmin && !isHoc) return { ok: false as const, reason: "forbidden" as const };
  if (isAdmin) return { ok: true as const };
  if (!user.companyId || user.companyId !== requestCompanyId) {
    return { ok: false as const, reason: "company" as const };
  }
  return { ok: true as const };
}

type EndorsementKind = "RTP" | "PBL" | "JVP" | "GENERIC";

export type EndorsementPayload = {
  request: {
    id: string;
    requestNo: string;
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

function getProjectCode(request: {
  rtp: { project?: { projectCode: string | null } | null } | null;
  pbl: { projectCode: string | null; project?: { projectCode: string | null } | null } | null;
  jvp: { projectCode: string | null; project?: { projectCode: string | null } | null } | null;
}) {
  return (
    request.pbl?.projectCode ??
    request.pbl?.project?.projectCode ??
    request.jvp?.projectCode ??
    request.jvp?.project?.projectCode ??
    request.rtp?.project?.projectCode ??
    "-"
  );
}

function procurementMethodLabel(value: number | null | undefined) {
  if (typeof value !== "number") return "Procurement Method";
  return `Procurement method ${value}`;
}

export async function loadEndorsement(
  requestIdRaw: string | undefined,
  user: CurrentUser | null
): Promise<EndorsementLoadResult> {
  if (!user) {
    return { ok: false, status: 401, error: "Authentication required" };
  }

  const id = normalizeRequestId(requestIdRaw);
  if (!id) {
    return { ok: false, status: 400, error: "Invalid request id" };
  }

  const request = await prisma.request.findUnique({
    where: { id },
    select: {
      id: true,
      requestNo: true,
      requestType: true,
      requestTitle: true,
      companyId: true,
      companyName: true,
      status: true,
      verifiedAt: true,
      hocReviewAcceptanceSignedAt: true,
      rtp: {
        select: {
          clientName: true,
          projectName: true,
          project: { select: { projectCode: true, projectName: true } },
        },
      },
      pbl: {
        select: {
          projectCode: true,
          procurementMethod: true,
          project: { select: { projectCode: true, projectName: true } },
          bidders: { select: { id: true } },
        },
      },
      jvp: {
        select: {
          projectCode: true,
          project: { select: { projectCode: true, projectName: true } },
        },
      },
      engagements: {
        select: {
          engagementNumber: true,
          updatedAt: true,
          status: true,
        },
      },
    },
  });

  if (!request) {
    return { ok: false, status: 404, error: "Request not found" };
  }

  const access = canAccessEndorsement(user, request.companyId);
  if (!access.ok) {
    const error =
      access.reason === "company"
        ? "HOC must belong to the same company as this request"
        : "Only admins or HOC can open endorsement";
    return { ok: false, status: 403, error };
  }

  if (request.status.trim().toLowerCase() !== PENDING_ENDORSE) {
    return {
      ok: false,
      status: 400,
      error: "Endorsement is only available while the request is Pending Endorse",
    };
  }

  const withNumber = request.engagements.filter((e) => e.engagementNumber);
  const completed = withNumber.filter(
    (e) => (e.status ?? "").trim().toLowerCase() === ENGAGEMENT_COMPLETED
  );
  const pool = completed.length > 0 ? completed : withNumber;
  const latestEngagement = [...pool].sort(
    (a, b) => engagementRank(b.engagementNumber) - engagementRank(a.engagementNumber)
  )[0];

  const kind = getRequestTypeKind(request.requestType);
  const projectCode = getProjectCode(request);
  const typeRef = kind === "GENERIC" ? request.requestType.trim().toUpperCase() || "REQ" : kind;
  const endorsementNo = `${projectCode}/${request.requestTitle || request.requestNo}/${typeRef}/E`;

  return {
    ok: true,
    data: {
      request: {
        id: request.id,
        requestNo: request.requestNo,
        requestTitle: request.requestTitle,
        requestType: request.requestType,
        companyName: request.companyName,
        status: request.status,
        reviewAcceptedAt: formatDate(request.hocReviewAcceptanceSignedAt),
      },
      endorsement: {
        no: endorsementNo,
        kind,
        title: "ENDORSEMENT",
        subtitle: getSubtitle(kind),
        projectCode,
        reviewNo: latestEngagement?.engagementNumber ?? "-",
        reviewDate: formatDate(request.verifiedAt ?? latestEngagement?.updatedAt),
        acceptanceDate: formatDate(request.hocReviewAcceptanceSignedAt),
        procurementMethod: request.pbl ? procurementMethodLabel(request.pbl.procurementMethod) : undefined,
        bidderCount: request.pbl?.bidders.length,
        clientName: request.rtp?.clientName,
        projectName:
          request.pbl?.project.projectName ??
          request.jvp?.project.projectName ??
          request.rtp?.project?.projectName ??
          request.rtp?.projectName,
      },
    },
  };
}
