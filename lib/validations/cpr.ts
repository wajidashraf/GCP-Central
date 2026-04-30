import { z } from "zod";
import { RTP_ALLOWED_DOCUMENT_MIME_TYPES, RTP_MAX_DOCUMENT_SIZE_BYTES } from "./rtp";

export const CPR_FORM_CODE = "CPR" as const;
export const CPR_REQUEST_TITLE = "Monthly Information Update";
export const CPR_ALLOWED_DOCUMENT_MIME_TYPES = RTP_ALLOWED_DOCUMENT_MIME_TYPES;
export const CPR_MAX_DOCUMENT_SIZE_BYTES = RTP_MAX_DOCUMENT_SIZE_BYTES;

const routingTypes = ["GCP", "GCPC"] as const;
const allowedDocumentMimeTypes = new Set(CPR_ALLOWED_DOCUMENT_MIME_TYPES);

export const createCprBaseRequestSchema = z
  .object({
    requestType: z.literal(CPR_FORM_CODE),
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

export const saveCprDetailsSchema = z.object({
  requestId: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
  projectCode: z.string().trim().max(60).optional().or(z.literal("")),
  companyId: z.string().trim().min(1),
  companyCode: z.string().trim().min(1).max(20),
  companyName: z.string().trim().min(1).max(120),
  eotLatestNo: z.string().trim().optional().default(""),
  eotLatestDate: z.string().trim().optional().default(""),
  eotNewApplicationDate: z.string().trim().optional().default(""),
  eotNewCompletionDate: z.string().trim().optional().default(""),
  eotApplicationStatus: z.string().trim().min(1).max(20),
  eotNewJustifications: z.string().trim().optional().default(""),
  voLatestNo: z.string().trim().optional().default(""),
  voLatestApprovedCumulativeAmount: z.string().trim().optional().default(""),
  voNewApplicationAmount: z.string().trim().optional().default(""),
  voNewApplicationNo: z.string().trim().optional().default(""),
  voNewApplicationDate: z.string().trim().optional().default(""),
  voApplicationStatus: z.string().trim().min(1).max(20),
  voNewJustification: z.string().trim().optional().default(""),
  cumulativeClaimApplicationAmountToDate: z.string().trim().optional().default(""),
  cumulativeClaimCertifiedAmountToDate: z.string().trim().optional().default(""),
  pendingCertifiedAmountToDate: z.string().trim().optional().default(""),
  noOfClaimsForPendingCertifiedAmount: z.string().trim().optional().default(""),
  newNetCertifiedAmount: z.string().trim().optional().default(""),
  claimDateForPendingCertifiedAmount: z.string().trim().optional().default(""),
});

export const submitCprRequestSchema = z.object({
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
        allowedDocumentMimeTypes.has(value as (typeof CPR_ALLOWED_DOCUMENT_MIME_TYPES)[number]),
      "Unsupported document type"
    ),
  documentSizeBytes: z.number().int().positive().max(CPR_MAX_DOCUMENT_SIZE_BYTES),
});

export type CreateCprBaseRequestInput = z.infer<typeof createCprBaseRequestSchema>;
export type SaveCprDetailsInput = z.infer<typeof saveCprDetailsSchema>;
export type SubmitCprRequestInput = z.infer<typeof submitCprRequestSchema>;
