import { z } from "zod";
import {
  RTP_ALLOWED_DOCUMENT_MIME_TYPES,
  RTP_MAX_DOCUMENT_SIZE_BYTES,
} from "./rtp";

export const PCCA_FORM_CODE = "PCCA" as const;
export const PCCA_REQUEST_TITLE = "PCCA";
export const REVISED_PCCA_FORM_CODE = "R-PCCA" as const;
export const REVISED_PCCA_REQUEST_TITLE = "Revised PCCA";
export const PCCA_ALLOWED_DOCUMENT_MIME_TYPES = RTP_ALLOWED_DOCUMENT_MIME_TYPES;
export const PCCA_MAX_DOCUMENT_SIZE_BYTES = RTP_MAX_DOCUMENT_SIZE_BYTES;

const routingTypes = ["GCP", "GCPC"] as const;
const allowedDocumentMimeTypes = new Set(PCCA_ALLOWED_DOCUMENT_MIME_TYPES);

const costRowSchema = z.object({
  work_description_bq: z.string().trim().optional().default(""),
  cost: z.string().trim().optional().default(""),
});

const revenueRowSchema = z.object({
  work_description_bq: z.string().trim().optional().default(""),
  price_revenue_rm: z.string().trim().optional().default(""),
});

const requestTypes = [PCCA_FORM_CODE, REVISED_PCCA_FORM_CODE] as const;

export const createPccaBaseRequestSchema = z
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
  });

export const savePccaProjectDetailsSchema = z.object({
  requestId: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
  projectCode: z.string().trim().max(60).optional().or(z.literal("")),
  companyId: z.string().trim().min(1),
  companyCode: z.string().trim().min(1).max(20),
  companyName: z.string().trim().min(1).max(120),
});

export const savePccaDetailsSchema = z.object({
  requestId: z.string().trim().min(1),
  priceRevenueFromContractBq: z.array(revenueRowSchema).optional().default([]),
  costFromContractBq: z.array(costRowSchema).optional().default([]),
  totalRevenueRm: z.number().nonnegative().optional(),
  totalCostRm: z.number().nonnegative().optional(),
  constructionCostRm: z.number().nonnegative().optional(),
  internalCost: z.number().nonnegative().optional(),
  remarks: z.string().trim().optional(),
});

export const submitPccaRequestSchema = z.object({
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
          value as (typeof PCCA_ALLOWED_DOCUMENT_MIME_TYPES)[number]
        ),
      "Unsupported document type"
    ),
  documentSizeBytes: z.number().int().positive().max(PCCA_MAX_DOCUMENT_SIZE_BYTES),
});

export type CreatePccaBaseRequestInput = z.infer<typeof createPccaBaseRequestSchema>;
export type SavePccaProjectDetailsInput = z.infer<typeof savePccaProjectDetailsSchema>;
export type SavePccaDetailsInput = z.infer<typeof savePccaDetailsSchema>;
export type SubmitPccaRequestInput = z.infer<typeof submitPccaRequestSchema>;
