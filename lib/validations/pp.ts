import { z } from "zod";
import {
  RTP_ALLOWED_DOCUMENT_MIME_TYPES,
  RTP_MAX_DOCUMENT_SIZE_BYTES,
} from "./rtp";

export const PP_FORM_CODE = "PP" as const;
export const PP_REQUEST_TITLE = "Procurement Plan";
export const PP_ALLOWED_DOCUMENT_MIME_TYPES = RTP_ALLOWED_DOCUMENT_MIME_TYPES;
export const PP_MAX_DOCUMENT_SIZE_BYTES = RTP_MAX_DOCUMENT_SIZE_BYTES;

const routingTypes = ["GCP", "GCPC"] as const;
const allowedDocumentMimeTypes = new Set(PP_ALLOWED_DOCUMENT_MIME_TYPES);

export const createPpBaseRequestSchema = z
  .object({
    requestType: z.literal(PP_FORM_CODE),
    routingType: z.enum(routingTypes),
    requestTitle: z.string().trim().min(1).max(160),
    category: z.enum(routingTypes),
    requestorId: z.string().trim().min(1),
    requestorName: z.string().trim().min(1).max(120),
    requestorEmail: z.string().trim().email(),
    companyId: z.string().trim().min(1),
    companyCode: z.string().trim().min(1).max(20),
    companyName: z.string().trim().min(1).max(120),
  })
  .superRefine((value, ctx) => {
    if (value.category !== value.routingType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Category must match the selected channel",
        path: ["category"],
      });
    }
  });

export const savePpDetailsSchema = z.object({
  requestId: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
  projectCode: z.string().trim().max(60).optional().or(z.literal("")),
  companyId: z.string().trim().min(1),
  companyCode: z.string().trim().min(1).max(20),
  companyName: z.string().trim().min(1).max(120),
});

export const submitPpRequestSchema = z.object({
  requestId: z.string().trim().min(1),
  acknowledgement: z.boolean().refine((value) => value),
  documentUrl: z.string().trim().url(),
  documentPublicId: z.string().trim().min(1),
  documentFileName: z.string().trim().min(1).max(180),
  documentMimeType: z
    .string()
    .trim()
    .min(1)
    .refine(
      (value) =>
        allowedDocumentMimeTypes.has(
          value as (typeof PP_ALLOWED_DOCUMENT_MIME_TYPES)[number]
        ),
      "Unsupported document type"
    ),
  documentSizeBytes: z.number().int().positive().max(PP_MAX_DOCUMENT_SIZE_BYTES),
});

export type CreatePpBaseRequestInput = z.infer<typeof createPpBaseRequestSchema>;
export type SavePpDetailsInput = z.infer<typeof savePpDetailsSchema>;
export type SubmitPpRequestInput = z.infer<typeof submitPpRequestSchema>;
