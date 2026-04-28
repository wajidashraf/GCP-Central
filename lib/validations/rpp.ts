import { z } from "zod";
import {
  RTP_ALLOWED_DOCUMENT_MIME_TYPES,
  RTP_MAX_DOCUMENT_SIZE_BYTES,
} from "./rtp";

export const RPP_FORM_CODE = "RPP" as const;
export const RPP_REQUEST_TITLE = "Revised Procurement Plan (RPP)";

const routingTypes = ["GCP", "GCPC"] as const;
const allowedDocumentMimeTypes = new Set(RTP_ALLOWED_DOCUMENT_MIME_TYPES);

export const createRppBaseRequestSchema = z
  .object({
    requestType: z.literal(RPP_FORM_CODE),
    routingType: z.enum(routingTypes),
    requestTitle: z
      .string()
      .trim()
      .min(1, "Request title is required")
      .max(160, "Request title must be at most 160 characters"),
    category: z.enum(routingTypes),
    requestorId: z.string().trim().min(1, "Requestor id is required"),
    requestorName: z
      .string()
      .trim()
      .min(1, "Requestor name is required")
      .max(120, "Requestor name must be at most 120 characters"),
    requestorEmail: z.string().trim().email("Requestor email must be valid"),
    companyId: z.string().trim().min(1, "Company is required"),
    companyCode: z
      .string()
      .trim()
      .min(1, "Company code is required")
      .max(20, "Company code must be at most 20 characters"),
    companyName: z
      .string()
      .trim()
      .min(1, "Company name is required")
      .max(120, "Company name must be at most 120 characters"),
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

export const saveRppDetailsSchema = z.object({
  requestId: z.string().trim().min(1, "Request id is required"),
  projectId: z.string().trim().min(1, "Project is required"),
  projectCode: z
    .string()
    .trim()
    .max(60, "Project code must be at most 60 characters")
    .optional()
    .or(z.literal("")),
  companyId: z.string().trim().min(1, "Company is required"),
  companyCode: z
    .string()
    .trim()
    .min(1, "Company code is required")
    .max(20, "Company code must be at most 20 characters"),
  companyName: z
    .string()
    .trim()
    .min(1, "Company name is required")
    .max(120, "Company name must be at most 120 characters"),
});

export const submitRppRequestSchema = z.object({
  requestId: z.string().trim().min(1, "Request id is required"),
  acknowledgement: z
    .boolean()
    .refine((value) => value, "Acknowledgement is required before submission"),
  documentUrl: z.string().trim().url("Document URL is invalid"),
  documentPublicId: z
    .string()
    .trim()
    .min(1, "Document public id is required"),
  documentFileName: z
    .string()
    .trim()
    .min(1, "Document filename is required")
    .max(180, "Document filename must be at most 180 characters"),
  documentMimeType: z
    .string()
    .trim()
    .min(1, "Document type is required")
    .refine(
      (value) => allowedDocumentMimeTypes.has(value as (typeof RTP_ALLOWED_DOCUMENT_MIME_TYPES)[number]),
      "Unsupported document type"
    ),
  documentSizeBytes: z
    .number()
    .int()
    .positive("Document size must be greater than 0")
    .max(RTP_MAX_DOCUMENT_SIZE_BYTES, "Document must be 10MB or smaller"),
});

export type CreateRppBaseRequestInput = z.infer<typeof createRppBaseRequestSchema>;
export type SaveRppDetailsInput = z.infer<typeof saveRppDetailsSchema>;
export type SubmitRppRequestInput = z.infer<typeof submitRppRequestSchema>;
