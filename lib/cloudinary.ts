import { v2 as cloudinary } from "cloudinary";
import { env } from "@/lib/env";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Uploads a file (base64 or remote URL) to Cloudinary.
 *
 * @param fileUri - The file URI or Base64 string to upload
 * @param folder - The target folder in Cloudinary (defaults to 'gcp-central')
 * @returns The upload result or error
 */
export async function uploadToCloudinary(
  fileUri: string,
  folder: string = "gcp-central"
): Promise<{ success: boolean; result?: CloudinaryUploadResult; error?: unknown }> {
  try {
    const result = await cloudinary.uploader.upload(fileUri, {
      folder,
      resource_type: "auto",
    });

    return {
      success: true,
      result: {
        public_id: result.public_id,
        secure_url: result.secure_url,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
      },
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return { success: false, error };
  }
}

/**
 * Deletes a resource from Cloudinary by its public ID.
 * Tries image/raw/video resource types so files uploaded with `resource_type: auto` can be deleted reliably.
 *
 * @param publicId - The public ID of the resource to delete
 * @returns Success status and optional error
 */
export async function deleteFromCloudinary(
  publicId: string
): Promise<{ success: boolean; error?: unknown }> {
  const resourceTypes: Array<"image" | "raw" | "video"> = ["image", "raw", "video"];
  let lastError: unknown = null;

  for (const resourceType of resourceTypes) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      if (result.result === "ok" || result.result === "not found") {
        return { success: true };
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    console.error("Cloudinary delete error:", lastError);
  }

  return { success: false, error: lastError };
}

export default cloudinary;
