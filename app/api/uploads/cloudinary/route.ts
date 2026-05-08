import { NextResponse } from "next/server";
import { deleteFromCloudinary, uploadToCloudinary } from "@/lib/cloudinary";
import { getGraphClient, getDriveId, getSiteId } from "@/lib/graph";
import {
  clearCaaDocumentByRequestUuid,
  clearCaaOrganisationChartByRequestUuid,
  resolveCaaUploadedFieldByPublicId,
} from "@/lib/sharepoint/caa";
import {
  clearJvpCashflowForecastByRequestUuid,
  clearJvpCostStructureByRequestUuid,
  clearJvpDocumentByRequestUuid,
  resolveJvpUploadedFieldByPublicId,
} from "@/lib/sharepoint/jvp";
import {
  clearStspCashflowByRequestUuid,
  clearStspContractStructureByRequestUuid,
  clearStspDocumentByRequestUuid,
  clearStspRevenueVsCostByRequestUuid,
  resolveStspUploadedFieldByPublicId,
} from "@/lib/sharepoint/stsp";
import { clearPccaDocumentByRequestUuid } from "@/lib/sharepoint/pcca";
import { clearPblDocumentByRequestUuid } from "@/lib/sharepoint/pbl";
import { clearOthersDocumentByRequestUuid } from "@/lib/sharepoint/others";
import { clearPpDocumentByRequestUuid } from "@/lib/sharepoint/pp";
import { clearRppDocumentByRequestUuid } from "@/lib/sharepoint/rpp";
import { clearRtpDocumentByRequestUuid } from "@/lib/sharepoint/rtp";
import { clearVapDocumentByRequestUuid } from "@/lib/sharepoint/vap";
import { clearCprDocumentByRequestUuid } from "@/lib/sharepoint/cpr";
import { clearCiDocumentByRequestUuid } from "@/lib/sharepoint/ci";
import {
  RTP_ALLOWED_DOCUMENT_MIME_TYPES,
  RTP_MAX_DOCUMENT_SIZE_BYTES,
} from "@/lib/validations/rtp";

export const runtime = "nodejs";

const allowedMimeTypes = new Set(RTP_ALLOWED_DOCUMENT_MIME_TYPES);

type RequestType =
  | "RTP"
  | "PBL"
  | "JVP"
  | "STSP"
  | "CAA"
  | "PCCA"
  | "R-PCCA"
  | "PP"
  | "RPP"
  | "VAP"
  | "CPR"
  | "CI"
  | "OTHERS";

// Request types whose documents are stored in the SharePoint Document Library
// (and whose metadata lives in their dedicated SharePoint List).
const SHAREPOINT_DRIVE_REQUEST_TYPES: ReadonlySet<RequestType> = new Set([
  "RTP",
  "PBL",
  "JVP",
  "STSP",
  "PP",
  "PCCA",
  "R-PCCA",
  "VAP",
  "RPP",
  "OTHERS",
  "CAA",
  "CPR",
  "CI",
]);

function isSharePointDriveRequestType(value: string): value is RequestType {
  return SHAREPOINT_DRIVE_REQUEST_TYPES.has(value as RequestType);
}

function sanitizeFolder(folder: string) {
  return folder
    .trim()
    .replace(/[^a-zA-Z0-9/_-]/g, "")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const file = formData.get("file");
    const folderValue = formData.get("folder");
    const requestTypeValue = formData.get("requestType");
    const requestIdValue = formData.get("requestId");

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "A document file is required." }, { status: 400 });
    }

    const mimeType = file.type?.trim() || "application/octet-stream";
    if (!allowedMimeTypes.has(mimeType as (typeof RTP_ALLOWED_DOCUMENT_MIME_TYPES)[number])) {
      return NextResponse.json(
        { message: "Unsupported file type. Please upload PDF, Office, or image files only." },
        { status: 415 }
      );
    }

    if (file.size <= 0 || file.size > RTP_MAX_DOCUMENT_SIZE_BYTES) {
      return NextResponse.json(
        { message: "File must be greater than 0 bytes and no larger than 10MB." },
        { status: 400 }
      );
    }

    const folder =
      typeof folderValue === "string" && folderValue.trim()
        ? sanitizeFolder(folderValue)
        : "gcp-central/rtp";

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const requestType = typeof requestTypeValue === "string" ? requestTypeValue.trim().toUpperCase() : "";
    const requestId = typeof requestIdValue === "string" ? requestIdValue.trim() : "";

    if (isSharePointDriveRequestType(requestType) && requestId) {
      const client = getGraphClient();
      const siteId = getSiteId();
      const driveId = getDriveId();
      const requestTypeFolder = requestType;
      const requestFolderPrefix = requestType.toLowerCase();

      await client.api(`/sites/${siteId}/drives/${driveId}/root/children`).post({
        name: requestTypeFolder,
        folder: {},
        "@microsoft.graph.conflictBehavior": "replace",
      });

      const requestFolder = `${requestFolderPrefix}_${requestId}`;
      await client.api(`/sites/${siteId}/drives/${driveId}/root:/${requestTypeFolder}:/children`).post({
        name: requestFolder,
        folder: {},
        "@microsoft.graph.conflictBehavior": "replace",
      });

      const safeFileName = file.name.replace(/[\\/:*?"<>|]/g, "_");
      const driveItem = await client
        .api(`/sites/${siteId}/drives/${driveId}/root:/${requestTypeFolder}/${requestFolder}/${safeFileName}:/content`)
        .put(fileBuffer);

      return NextResponse.json(
        {
          documentUrl: driveItem.webUrl,
          documentPublicId: driveItem.id,
          documentFileName: file.name,
          documentMimeType: mimeType,
          documentSizeBytes: file.size,
        },
        { status: 200 }
      );
    }

    const base64 = fileBuffer.toString("base64");
    const dataUri = `data:${mimeType};base64,${base64}`;

    const uploadedFile = await uploadToCloudinary(dataUri, folder || "gcp-central/rtp");

    if (!uploadedFile.success || !uploadedFile.result) {
      return NextResponse.json({ message: "Cloudinary upload failed." }, { status: 502 });
    }

    return NextResponse.json(
      {
        documentUrl: uploadedFile.result.secure_url,
        documentPublicId: uploadedFile.result.public_id,
        documentFileName: file.name,
        documentMimeType: mimeType,
        documentSizeBytes: file.size,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ message: "Failed to upload document." }, { status: 500 });
  }
}

async function clearCaaUploadedFieldByPublicId(requestId: string, publicId: string) {
  const matchedField = await resolveCaaUploadedFieldByPublicId(requestId, publicId);
  if (matchedField === "document") {
    await clearCaaDocumentByRequestUuid(requestId);
    return;
  }
  if (matchedField === "organisationChart") {
    await clearCaaOrganisationChartByRequestUuid(requestId);
    return;
  }
  // Fall back to clearing the final document slot. This keeps behavior safe when
  // the CAA item could not be matched (e.g. soft-deleted or out-of-sync state).
  await clearCaaDocumentByRequestUuid(requestId);
}

async function clearJvpUploadedFieldByPublicId(requestId: string, publicId: string) {
  const matchedField = await resolveJvpUploadedFieldByPublicId(requestId, publicId);
  if (matchedField === "document") {
    await clearJvpDocumentByRequestUuid(requestId);
    return;
  }
  if (matchedField === "cashflowForecast") {
    await clearJvpCashflowForecastByRequestUuid(requestId);
    return;
  }
  if (matchedField === "costStructure") {
    await clearJvpCostStructureByRequestUuid(requestId);
    return;
  }
  // Fall back to clearing the final document slot if the field cannot be resolved.
  await clearJvpDocumentByRequestUuid(requestId);
}

async function clearStspUploadedFieldByPublicId(requestId: string, publicId: string) {
  const matchedField = await resolveStspUploadedFieldByPublicId(requestId, publicId);
  if (matchedField === "document") {
    await clearStspDocumentByRequestUuid(requestId);
    return;
  }
  if (matchedField === "contractStructure") {
    await clearStspContractStructureByRequestUuid(requestId);
    return;
  }
  if (matchedField === "revenueVsCost") {
    await clearStspRevenueVsCostByRequestUuid(requestId);
    return;
  }
  if (matchedField === "cashflow") {
    await clearStspCashflowByRequestUuid(requestId);
    return;
  }
  // Fall back to clearing the final document slot if the field cannot be resolved.
  await clearStspDocumentByRequestUuid(requestId);
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json()) as {
      publicId?: string;
      requestId?: string;
      requestType?: string;
    } | null;
    const publicId = body?.publicId?.trim() ?? "";
    const requestId = body?.requestId?.trim() ?? "";
    const requestType = body?.requestType?.trim().toUpperCase() as RequestType | "";

    if (!publicId) {
      return NextResponse.json({ message: "publicId is required." }, { status: 400 });
    }

    if (isSharePointDriveRequestType(requestType)) {
      try {
        const client = getGraphClient();
        const driveId = getDriveId();
        await client.api(`/drives/${driveId}/items/${publicId}`).delete();
      } catch {
        // Ignore missing file and continue clearing metadata.
      }

      if (requestId && requestType === "RTP") {
        await clearRtpDocumentByRequestUuid(requestId);
      }
      if (requestId && requestType === "PBL") {
        await clearPblDocumentByRequestUuid(requestId);
      }
      if (requestId && requestType === "PP") {
        await clearPpDocumentByRequestUuid(requestId);
      }
      if (requestId && (requestType === "PCCA" || requestType === "R-PCCA")) {
        await clearPccaDocumentByRequestUuid(requestId, requestType);
      }
      if (requestId && requestType === "VAP") {
        await clearVapDocumentByRequestUuid(requestId);
      }
      if (requestId && requestType === "RPP") {
        await clearRppDocumentByRequestUuid(requestId);
      }
      if (requestId && requestType === "OTHERS") {
        await clearOthersDocumentByRequestUuid(requestId);
      }
      if (requestId && requestType === "CAA") {
        await clearCaaUploadedFieldByPublicId(requestId, publicId);
      }
      if (requestId && requestType === "CPR") {
        await clearCprDocumentByRequestUuid(requestId);
      }
      if (requestId && requestType === "CI") {
        await clearCiDocumentByRequestUuid(requestId);
      }
      if (requestId && requestType === "JVP") {
        await clearJvpUploadedFieldByPublicId(requestId, publicId);
      }
      if (requestId && requestType === "STSP") {
        await clearStspUploadedFieldByPublicId(requestId, publicId);
      }

      return NextResponse.json({ success: true }, { status: 200 });
    }

    const deletedFile = await deleteFromCloudinary(publicId);
    if (!deletedFile.success) {
      return NextResponse.json({ message: "Failed to delete uploaded file." }, { status: 502 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ message: "Failed to delete uploaded file." }, { status: 500 });
  }
}
