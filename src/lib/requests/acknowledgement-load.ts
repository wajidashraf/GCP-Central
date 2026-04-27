import prisma from "@/lib/prisma";
import { REQUEST_STATUS_MAP } from "@/src/constants/enums/requestStatus";
import { hasRole } from "@/src/lib/auth/has-role";
import type { CurrentUser } from "@/src/types/auth";

const PENDING_ACK = REQUEST_STATUS_MAP.PENDING_ACK.label.toLowerCase();

function normalizeRequestId(raw: string | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const id = raw.trim();
  return id || null;
}

function canAccessAcknowledgement(user: CurrentUser, requestCompanyId: string) {
  const isAdmin = hasRole(user, "admin");
  const isHoc = hasRole(user, "hoc");
  if (!isAdmin && !isHoc) return { ok: false as const, reason: "forbidden" as const };
  if (isAdmin) return { ok: true as const };
  if (!user.companyId || user.companyId !== requestCompanyId) {
    return { ok: false as const, reason: "company" as const };
  }
  return { ok: true as const };
}

export type AcknowledgementPayload = {
  request: {
    id: string;
    requestNo: string;
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

function getProjectData(request: {
  requestTitle: string;
  rtp: { projectName: string; project?: { projectName: string; projectCode: string | null } | null } | null;
  pbl: { projectCode: string | null; project: { projectName: string; projectCode: string | null } } | null;
  jvp: { projectCode: string | null; project: { projectName: string; projectCode: string | null } } | null;
}) {
  const projectName =
    request.pbl?.project.projectName ??
    request.jvp?.project.projectName ??
    request.rtp?.project?.projectName ??
    request.rtp?.projectName ??
    request.requestTitle;

  const projectCode =
    request.pbl?.projectCode ??
    request.pbl?.project.projectCode ??
    request.jvp?.projectCode ??
    request.jvp?.project.projectCode ??
    request.rtp?.project?.projectCode ??
    "-";

  return { projectName, projectCode };
}

export async function loadAcknowledgement(
  requestIdRaw: string | undefined,
  user: CurrentUser | null
): Promise<AcknowledgementLoadResult> {
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
      requestTitle: true,
      requestType: true,
      companyId: true,
      companyName: true,
      status: true,
      ackLetterTextContent: true,
      rtp: {
        select: {
          projectName: true,
          project: { select: { projectName: true, projectCode: true } },
        },
      },
      pbl: {
        select: {
          projectCode: true,
          project: { select: { projectName: true, projectCode: true } },
        },
      },
      jvp: {
        select: {
          projectCode: true,
          project: { select: { projectName: true, projectCode: true } },
        },
      },
    },
  });

  if (!request) {
    return { ok: false, status: 404, error: "Request not found" };
  }

  const access = canAccessAcknowledgement(user, request.companyId);
  if (!access.ok) {
    const error =
      access.reason === "company"
        ? "HOC must belong to the same company as this request"
        : "Only admins or HOC can open acknowledgement";
    return { ok: false, status: 403, error };
  }

  if (request.status.trim().toLowerCase() !== PENDING_ACK) {
    return {
      ok: false,
      status: 400,
      error: "Acknowledgement is only available while the request is Pending Ack",
    };
  }

  const project = getProjectData(request);

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
        ackLetterTextContent: request.ackLetterTextContent,
      },
      acknowledgement: {
        no: `${request.requestTitle || request.requestNo}/${project.projectCode}`,
        subtitle: "(For Variation Order / Payment / EOT / L&E)",
        projectName: project.projectName,
        projectCode: project.projectCode,
      },
    },
  };
}
