import { z } from "zod";
import {
  RTP_ALLOWED_DOCUMENT_MIME_TYPES,
  RTP_MAX_DOCUMENT_SIZE_BYTES,
} from "./rtp";

export const OTHERS_ROUTE_CODE = "OTHERS" as const;
export const OTHERS_GCPC_REQUEST_TYPE = "OTHERS_GCPC" as const;
export const OTHERS_GCP_REQUEST_TYPE = "OTHERS_GCP" as const;
export const OTHERS_ALLOWED_DOCUMENT_MIME_TYPES = RTP_ALLOWED_DOCUMENT_MIME_TYPES;
export const OTHERS_MAX_DOCUMENT_SIZE_BYTES = RTP_MAX_DOCUMENT_SIZE_BYTES;

const routingTypes = ["GCP", "GCPC"] as const;
const requestTypes = [OTHERS_GCP_REQUEST_TYPE, OTHERS_GCPC_REQUEST_TYPE] as const;
const allowedDocumentMimeTypes = new Set(OTHERS_ALLOWED_DOCUMENT_MIME_TYPES);

export const createOthersBaseRequestSchema = z
  .object({
    requestType: z.enum(requestTypes),
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
    const expectedType =
      value.routingType === "GCPC" ? OTHERS_GCPC_REQUEST_TYPE : OTHERS_GCP_REQUEST_TYPE;
    if (value.requestType !== expectedType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Request type does not match the selected channel",
        path: ["requestType"],
      });
    }
  });

export const saveOthersDetailsSchema = z.object({
  requestId: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
  projectCode: z.string().trim().max(60).optional().or(z.literal("")),
  companyId: z.string().trim().min(1),
  companyCode: z.string().trim().min(1).max(20),
  companyName: z.string().trim().min(1).max(120),
  descriptionOfMatters: z.string().trim().min(1).max(4000),
});

export const submitOthersRequestSchema = z.object({
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
          value as (typeof OTHERS_ALLOWED_DOCUMENT_MIME_TYPES)[number]
        ),
      "Unsupported document type"
    ),
  documentSizeBytes: z.number().int().positive().max(OTHERS_MAX_DOCUMENT_SIZE_BYTES),
});

export type CreateOthersBaseRequestInput = z.infer<typeof createOthersBaseRequestSchema>;
export type SaveOthersDetailsInput = z.infer<typeof saveOthersDetailsSchema>;
export type SubmitOthersRequestInput = z.infer<typeof submitOthersRequestSchema>;
