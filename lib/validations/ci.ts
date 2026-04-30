import { z } from "zod";
import { RTP_ALLOWED_DOCUMENT_MIME_TYPES, RTP_MAX_DOCUMENT_SIZE_BYTES } from "./rtp";

export const CI_FORM_CODE = "CI" as const;
export const CI_REQUEST_TITLE = "Contractual Issue Relating to Payment";
export const CI_ALLOWED_DOCUMENT_MIME_TYPES = RTP_ALLOWED_DOCUMENT_MIME_TYPES;
export const CI_MAX_DOCUMENT_SIZE_BYTES = RTP_MAX_DOCUMENT_SIZE_BYTES;

const routingTypes = ["GCP", "GCPC"] as const;
const allowedDocumentMimeTypes = new Set(CI_ALLOWED_DOCUMENT_MIME_TYPES);

export const createCiBaseRequestSchema = z
  .object({
    requestType: z.literal(CI_FORM_CODE),
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

export const saveCiDetailsSchema = z.object({
  requestId: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
  projectCode: z.string().trim().max(60).optional().or(z.literal("")),
  companyId: z.string().trim().min(1),
  companyCode: z.string().trim().min(1).max(20),
  companyName: z.string().trim().min(1).max(120),
  companyRoleInIssue: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(120),
  voBriefOfIssues: z.string().trim().min(1).max(4000),
  voChronologyOfEvent: z.string().trim().min(1).max(4000),
  voTimeAndCostImpact: z.string().trim().min(1).max(4000),
  voContractClauseEntitlement: z.string().trim().min(1).max(4000),
  voAdvisoryRequiredFromGcp: z.string().trim().min(1).max(4000),
  paymentBriefOfIssues: z.string().trim().min(1).max(4000),
  paymentChronologyOfEvent: z.string().trim().min(1).max(4000),
  paymentContractClauseEntitlement: z.string().trim().min(1).max(4000),
  paymentAdvisoryRequiredFromGcp: z.string().trim().min(1).max(4000),
});

export const submitCiRequestSchema = z.object({
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
        allowedDocumentMimeTypes.has(value as (typeof CI_ALLOWED_DOCUMENT_MIME_TYPES)[number]),
      "Unsupported document type"
    ),
  documentSizeBytes: z.number().int().positive().max(CI_MAX_DOCUMENT_SIZE_BYTES),
});

export type CreateCiBaseRequestInput = z.infer<typeof createCiBaseRequestSchema>;
export type SaveCiDetailsInput = z.infer<typeof saveCiDetailsSchema>;
export type SubmitCiRequestInput = z.infer<typeof submitCiRequestSchema>;
