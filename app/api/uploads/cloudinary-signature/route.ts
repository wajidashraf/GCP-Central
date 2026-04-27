import { NextResponse } from "next/server";
import { uploadToCloudinary } from "@/lib/cloudinary";
import {
  SIGNATURE_ALLOWED_MIME_SET,
  SIGNATURE_MAX_BYTES,
} from "@/lib/validations/signature";
import { getCurrentUser } from "@/src/lib/auth/get-current-user";

export const runtime = "nodejs";

function sanitizeFolder(folder: string) {
  return folder
    .trim()
    .replace(/[^a-zA-Z0-9/_-]/g, "")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const folderValue = formData.get("folder");

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "A signature image file is required." }, { status: 400 });
    }

    const mimeType = file.type?.trim().toLowerCase() || "application/octet-stream";
    if (!SIGNATURE_ALLOWED_MIME_SET.has(mimeType)) {
      return NextResponse.json(
        { message: "Unsupported file type. Please upload PNG, JPEG, GIF, or WebP." },
        { status: 415 }
      );
    }

    if (file.size <= 0 || file.size > SIGNATURE_MAX_BYTES) {
      return NextResponse.json(
        { message: `File must be greater than 0 bytes and no larger than ${SIGNATURE_MAX_BYTES / (1024 * 1024)}MB.` },
        { status: 400 }
      );
    }

    const folder =
      typeof folderValue === "string" && folderValue.trim()
        ? sanitizeFolder(folderValue)
        : "gcp-central/signatures";

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const base64 = fileBuffer.toString("base64");
    const dataUri = `data:${mimeType};base64,${base64}`;

    const uploadedFile = await uploadToCloudinary(dataUri, folder || "gcp-central/signatures");

    if (!uploadedFile.success || !uploadedFile.result) {
      return NextResponse.json({ message: "Cloudinary upload failed." }, { status: 502 });
    }

    return NextResponse.json(
      {
        documentUrl: uploadedFile.result.secure_url,
        documentPublicId: uploadedFile.result.public_id,
        documentFileName: file.name || "signature.png",
        documentMimeType: mimeType,
        documentSizeBytes: file.size,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ message: "Failed to upload signature." }, { status: 500 });
  }
}
