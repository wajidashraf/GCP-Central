import { REQUEST_STATUS_MAP } from "@/src/constants/enums/requestStatus";
import { hasRole } from "@/src/lib/auth/has-role";
import type { CurrentUser } from "@/src/types/auth";
import { loadSharePointRequestBundle, resolveProjectForBundle } from "@/lib/sharepoint/request-bundle";
import { userMatchesRequestCompany, type SPRequestRowExtended } from "@/lib/sharepoint/request-resolve";

const PENDING_ACK = REQUEST_STATUS_MAP.PENDING_ACK.label.toLowerCase();

function normalizeRequestId(raw: string | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const id = raw.trim();
  return id || null;
}

function canAccessAcknowledgement(user: CurrentUser, request: SPRequestRowExtended & { id: string }) {
  const isAdmin = hasRole(user, "admin");
  const isHoc = hasRole(user, "hoc");
  if (!isAdmin && !isHoc) return { ok: false as const, reason: "forbidden" as const };
  if (isAdmin) return { ok: true as const };
  if (!userMatchesRequestCompany(user, request)) {
    return { ok: false as const, reason: "company" as const };
  }
  return { ok: true as const };
}

export type AcknowledgementPayload = {
  request: {
    id: string;
    requestNo: string;
    companyCode: string;
    requestTitle: string;
    requestType: string;
    companyName: string;
    status: string;
    ackLetterTextContent: string | null;
  };
  acknowledgement: {
    no: string;
    subtitle: string;
    projectName: string;
    projectCode: string;
  };
};

export type AcknowledgementLoadResult =
  | { ok: true; data: AcknowledgementPayload }
  | { ok: false; status: 401 | 403 | 404 | 400; error: string };

function getProjectData(bundle: Awaited<ReturnType<typeof loadSharePointRequestBundle>>) {
  if (!bundle) {
    return { projectName: "-", projectCode: "-" };
  }
  const { request, rtp, pbl, jvp, projects } = bundle;
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

  const projectName =
    pblProject?.projectName ??
    jvpProject?.projectName ??
    rtpProject?.projectName ??
    rtp?.projectName ??
    String(request.requestTitle ?? "");

  const projectCode =
    (pbl?.projectCode ?? "").trim() ||
    pblProject?.projectCode ||
    (jvp?.projectCode ?? "").trim() ||
    jvpProject?.projectCode ||
    rtpProject?.projectCode ||
    "-";

  return { projectName, projectCode };
}

function normalizeRefPart(value: string | null | undefined, fallback: string) {
  const cleaned = (value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\//g, "-")
    .toUpperCase();
  return cleaned || fallback;
}

export async function loadAcknowledgement(
  requestIdRaw: string | undefined,
  user: CurrentUser | null,
): Promise<AcknowledgementLoadResult> {
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
  const access = canAccessAcknowledgement(user, request);
  if (!access.ok) {
    const error =
      access.reason === "company"
        ? "HOC must belong to the same company as this request"
        : "Only admins or HOC can open acknowledgement";
    return { ok: false, status: 403, error };
  }

  if ((request.status ?? "").trim().toLowerCase() !== PENDING_ACK) {
    return {
      ok: false,
      status: 400,
      error: "Acknowledgement is only available while the request is Pending Ack",
    };
  }

  const project = getProjectData(bundle);
  const matterType = String(request.requestType ?? "").trim().toUpperCase() || "REQ";
  const acknowledgementNo = `${normalizeRefPart(request.companyCode, "COMP")}/${normalizeRefPart(project.projectCode, "PROJECT")}/${normalizeRefPart(matterType, "REQ")}/${normalizeRefPart(request.requestNo, "REQUEST")}/ACK`;

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
        ackLetterTextContent: request.ackLetterTextContent != null ? String(request.ackLetterTextContent) : null,
      },
      acknowledgement: {
        no: acknowledgementNo,
        subtitle: "(For Variation Order / Payment / EOT / L&E)",
        projectName: project.projectName,
        projectCode: project.projectCode,
      },
    },
  };
}
