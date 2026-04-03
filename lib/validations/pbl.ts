import { z } from "zod";
import {
  RTP_ALLOWED_DOCUMENT_MIME_TYPES,
  RTP_MAX_DOCUMENT_SIZE_BYTES,
} from "./rtp";

export const PBL_FORM_CODE = "PBL" as const;
export const PBL_REQUEST_TITLE = "Prospective Bidders List";
export const PBL_MIN_BIDDERS_WITHOUT_JUSTIFICATION = 3;
export const PBL_MAX_BIDDERS = 50;

const routingTypes = ["GCP", "GCPC"] as const;
const procurementMethods = [0, 1] as const;
const allowedDocumentMimeTypes = new Set(RTP_ALLOWED_DOCUMENT_MIME_TYPES);

export const pblBidderInputSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(1, "Company name is required")
    .max(120, "Company name must be at most 120 characters"),
  location: z
    .string()
    .trim()
    .max(180, "Location must be at most 180 characters")
    .optional()
    .or(z.literal("")),
  personInCharge: z
    .string()
    .trim()
    .min(1, "Person in charge is required")
    .max(120, "Person in charge must be at most 120 characters"),
  picContactNumber: z
    .string()
    .trim()
    .min(1, "PIC contact number is required")
    .max(40, "PIC contact number must be at most 40 characters"),
  sourcesFrom: z
    .string()
    .trim()
    .min(1, "Sources from is required")
    .max(180, "Sources from must be at most 180 characters"),
  recommendationBy: z
    .string()
    .trim()
    .min(1, "Recommendation by is required")
    .max(180, "Recommendation by must be at most 180 characters"),
});

export const createPblBaseRequestSchema = z
  .object({
    requestType: z.literal(PBL_FORM_CODE),
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

export const savePblDetailsSchema = z.object({
  requestId: z.string().trim().min(1, "Request id is required"),
  projectId: z.string().trim().min(1, "Project is required"),
  projectCode: z
    .string()
    .trim()
    .max(60, "Project code must be at most 60 characters")
    .optional()
    .or(z.literal("")),
  procurementMethod: z
    .coerce.number()
    .int()
    .refine(
      (value) => procurementMethods.includes(value as (typeof procurementMethods)[number]),
      "Invalid procurement method"
    ),
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

export const savePblBiddersSchema = z
  .object({
    requestId: z.string().trim().min(1, "Request id is required"),
    bidders: z
      .array(pblBidderInputSchema)
      .min(1, "At least one bidder is required")
      .max(PBL_MAX_BIDDERS, `A maximum of ${PBL_MAX_BIDDERS} bidders is allowed`),
    justificationForLessBidders: z
      .string()
      .trim()
      .max(2_000, "Justification must be at most 2000 characters")
      .optional()
      .or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    const shouldRequireJustification =
      value.bidders.length < PBL_MIN_BIDDERS_WITHOUT_JUSTIFICATION;
    const justification = value.justificationForLessBidders?.trim() ?? "";

    if (shouldRequireJustification && justification.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Justification is required when fewer than 3 bidders are added",
        path: ["justificationForLessBidders"],
      });
    }
  });

export const submitPblRequestSchema = z.object({
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

export type PblBidderInput = z.infer<typeof pblBidderInputSchema>;
export type CreatePblBaseRequestInput = z.infer<typeof createPblBaseRequestSchema>;
export type SavePblDetailsInput = z.infer<typeof savePblDetailsSchema>;
export type SavePblBiddersInput = z.infer<typeof savePblBiddersSchema>;
export type SubmitPblRequestInput = z.infer<typeof submitPblRequestSchema>;
