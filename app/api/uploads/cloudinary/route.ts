import { NextResponse } from "next/server";
import { deleteFromCloudinary, uploadToCloudinary } from "@/lib/cloudinary";
import prisma from "@/lib/prisma";
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

    const deletedFile = await deleteFromCloudinary(publicId);
    if (!deletedFile.success) {
      return NextResponse.json({ message: "Failed to delete uploaded file." }, { status: 502 });
    }

    if (requestId && requestType) {
      const clearData = {
        documentUrl: null,
        documentPublicId: null,
        documentFileName: null,
        documentMimeType: null,
        documentSizeBytes: null,
      };

      if (requestType === "RTP") {
        await prisma.rtpRequest.updateMany({ where: { requestId }, data: clearData });
      } else if (requestType === "PBL") {
        await prisma.pblRequest.updateMany({ where: { requestId }, data: clearData });
      } else if (requestType === "JVP") {
        await prisma.jvpRequest.updateMany({ where: { requestId }, data: clearData });
      } else if (requestType === "STSP") {
        await prisma.stspRequest.updateMany({ where: { requestId }, data: clearData });
      } else if (requestType === "CAA") {
        await prisma.caaRequest.updateMany({ where: { requestId }, data: clearData });
      } else if (requestType === "PCCA" || requestType === "R-PCCA") {
        await prisma.pccaRequest.updateMany({ where: { requestId }, data: clearData });
      } else if (requestType === "PP") {
        await prisma.ppRequest.updateMany({ where: { requestId }, data: clearData });
      } else if (requestType === "RPP") {
        await prisma.rppRequest.updateMany({ where: { requestId }, data: clearData });
      } else if (requestType === "VAP") {
        await prisma.vapRequest.updateMany({ where: { requestId }, data: clearData });
      } else if (
        requestType === "CPR" ||
        requestType === "CI" ||
        requestType === "OTHERS"
      ) {
        // CPR, CI, and OTHERS forms persist uploads on `OtherRequest` (see _actions/cpr.ts, ci.ts, others.ts).
        await prisma.otherRequest.updateMany({ where: { requestId }, data: clearData });
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ message: "Failed to delete uploaded file." }, { status: 500 });
  }
}
