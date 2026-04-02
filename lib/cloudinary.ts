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
      } 
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return { success: false, error };
  }
}

/**
 * Deletes an image from Cloudinary by its public ID.
 * 
 * @param publicId - The public ID of the resource to delete
 * @returns Success status and optional error
 */
export async function deleteFromCloudinary(
  publicId: string
): Promise<{ success: boolean; error?: unknown }> {
  try {
    await cloudinary.uploader.destroy(publicId);
    return { success: true };
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    return { success: false, error };
  }
}

export default cloudinary;
