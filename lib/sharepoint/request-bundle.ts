import "server-only";

import { listItems } from "@/lib/sharepoint/lists";
import {
  findRequestByRouteId,
  type SPRequestRowExtended,
} from "@/lib/sharepoint/request-resolve";

function hasTokenMatch(
  tokens: Set<string>,
  ...candidates: Array<string | number | null | undefined>
): boolean {
  for (const candidate of candidates) {
    const normalized = String(candidate ?? "").trim();
    if (normalized && tokens.has(normalized)) {
      return true;
    }
  }
  return false;
}

type SharePointProjectItem = {
  id: string;
  uuid?: string;
  projectCode?: string;
  projectName?: string;
  Title?: string;
};

type SharePointRequestDocumentItem = {
  id: string;
  uuid?: string;
  requestId?: string;
  requestIdLookupId?: string | number;
  requestIdId?: string | number;
  requestIdLookup?: string | number;
  documentUrl?: string;
  documentFileName?: string;
};

export type SharePointRtpItem = SharePointRequestDocumentItem & {
  projectName?: string;
  clientName?: string;
  registrationType?: string | number;
  validityPeriod?: string;
  projectId?: string;
  projectIdLookupId?: string | number;
  projectIdId?: string | number;
  projectIdLookup?: string | number;
};

export type SharePointPblItem = SharePointRequestDocumentItem & {
  projectCode?: string;
  projectId?: string;
  projectIdLookupId?: string | number;
  projectIdId?: string | number;
  projectIdLookup?: string | number;
  procurementMethod?: string | number;
};

export type SharePointJvpItem = SharePointRequestDocumentItem & {
  projectCode?: string;
  projectId?: string;
  projectIdLookupId?: string | number;
  projectIdId?: string | number;
  projectIdLookup?: string | number;
};

export type SharePointPblBidderItem = {
  id: string;
  pblRequestId?: string;
  pblRequestIdLookupId?: string | number;
  pblRequestIdId?: string | number;
  pblRequestIdLookup?: string | number;
};

export type SharePointRequestBundle = {
  request: SPRequestRowExtended & { id: string };
  requestLookupTokens: Set<string>;
  projects: SharePointProjectItem[];
  rtp: SharePointRtpItem | undefined;
  pbl: SharePointPblItem | undefined;
  jvp: SharePointJvpItem | undefined;
  pblBidderItems: SharePointPblBidderItem[];
};

/**
 * Shared loader for endorsement / acknowledgement SP data (matches request detail page joins).
 */
export async function loadSharePointRequestBundle(
  routeId: string
): Promise<SharePointRequestBundle | null> {
  const request = await findRequestByRouteId(routeId);
  if (!request?.id) return null;

  const requestLookupTokens = new Set<string>([routeId.trim(), request.id]);
  const u = (request.uuid ?? "").trim();
  const no = (request.requestNo ?? "").trim();
  if (u) requestLookupTokens.add(u);
  if (no) requestLookupTokens.add(no);

  const [projects, rtpItems, pblItems, jvpItems, pblBidderItems] = await Promise.all([
    process.env.PROJECTS_LIST_ID
      ? listItems<SharePointProjectItem>(process.env.PROJECTS_LIST_ID)
      : Promise.resolve([]),
    process.env.RTP_REQUESTS_LIST_ID
      ? listItems<SharePointRtpItem>(process.env.RTP_REQUESTS_LIST_ID)
      : Promise.resolve([]),
    process.env.PBL_REQUESTS_LIST_ID
      ? listItems<SharePointPblItem>(process.env.PBL_REQUESTS_LIST_ID)
      : Promise.resolve([]),
    process.env.JVP_REQUESTS_LIST_ID
      ? listItems<SharePointJvpItem>(process.env.JVP_REQUESTS_LIST_ID)
      : Promise.resolve([]),
    process.env.PBL_BIDDERS_LIST_ID
      ? listItems<SharePointPblBidderItem>(process.env.PBL_BIDDERS_LIST_ID)
      : Promise.resolve([]),
  ]);

  const rtp = rtpItems.find((item) =>
    hasTokenMatch(
      requestLookupTokens,
      item.id,
      item.uuid,
      item.requestId,
      item.requestIdLookupId,
      item.requestIdId,
      item.requestIdLookup,
    ),
  );
  const pbl = pblItems.find((item) =>
    hasTokenMatch(
      requestLookupTokens,
      item.id,
      item.uuid,
      item.requestId,
      item.requestIdLookupId,
      item.requestIdId,
      item.requestIdLookup,
    ),
  );
  const jvp = jvpItems.find((item) =>
    hasTokenMatch(
      requestLookupTokens,
      item.id,
      item.uuid,
      item.requestId,
      item.requestIdLookupId,
      item.requestIdId,
      item.requestIdLookup,
    ),
  );

  return {
    request,
    requestLookupTokens,
    projects,
    rtp,
    pbl,
    jvp,
    pblBidderItems,
  };
}

export function resolveProjectForBundle(
  projects: SharePointProjectItem[],
  projectId?: string | number | null | undefined,
): SharePointProjectItem | null {
  const normalized = String(projectId ?? "").trim();
  if (!normalized) return null;
  return projects.find((p) => p.id === normalized || (p.uuid ?? "").trim() === normalized) ?? null;
}
