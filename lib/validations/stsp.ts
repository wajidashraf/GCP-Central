import { z } from "zod";
import {
  RTP_ALLOWED_DOCUMENT_MIME_TYPES,
  RTP_MAX_DOCUMENT_SIZE_BYTES,
} from "./rtp";

export const STSP_FORM_CODE = "STSP" as const;
export const STSP_REQUEST_TITLE = "Submission of Tender / Proposal";
export const STSP_ALLOWED_DOCUMENT_MIME_TYPES = RTP_ALLOWED_DOCUMENT_MIME_TYPES;
export const STSP_MAX_DOCUMENT_SIZE_BYTES = RTP_MAX_DOCUMENT_SIZE_BYTES;

const routingTypes = ["GCP", "GCPC"] as const;
const allowedDocumentMimeTypes = new Set(STSP_ALLOWED_DOCUMENT_MIME_TYPES);
const POINTS_MAX_ITEMS = 20;
const POINT_MAX_LENGTH = 500;

const uploadedAssetSchema = z.object({
  url: z.string().trim().url("Uploaded file URL is invalid"),
  publicId: z.string().trim().min(1, "Uploaded file public id is required"),
  fileName: z
    .string()
    .trim()
    .min(1, "Uploaded file name is required")
    .max(180, "Uploaded file name must be at most 180 characters"),
  mimeType: z
    .string()
    .trim()
    .min(1, "Uploaded file type is required")
    .refine(
      (value) =>
        allowedDocumentMimeTypes.has(
          value as (typeof STSP_ALLOWED_DOCUMENT_MIME_TYPES)[number]
        ),
      "Unsupported uploaded file type"
    ),
  sizeBytes: z
    .number()
    .int()
    .positive("Uploaded file size must be greater than 0")
    .max(STSP_MAX_DOCUMENT_SIZE_BYTES, "Uploaded file must be 10MB or smaller"),
});

const stspPointItemSchema = z
  .string()
  .trim()
  .min(1, "Point cannot be empty")
  .max(POINT_MAX_LENGTH, `Point must be at most ${POINT_MAX_LENGTH} characters`);

const stspPointListSchema = z
  .array(stspPointItemSchema)
  .min(1, "At least one point is required")
  .max(POINTS_MAX_ITEMS, `A maximum of ${POINTS_MAX_ITEMS} points is allowed`);

const stspRiskItemSchema = z.object({
  riskIdentified: z
    .string()
    .trim()
    .min(1, "Risk identified is required")
    .max(POINT_MAX_LENGTH, `Risk identified must be at most ${POINT_MAX_LENGTH} characters`),
  mitigationPlan: z
    .string()
    .trim()
    .min(1, "Mitigation plan is required")
    .max(POINT_MAX_LENGTH, `Mitigation plan must be at most ${POINT_MAX_LENGTH} characters`),
});

export const createStspBaseRequestSchema = z
  .object({
    requestType: z.literal(STSP_FORM_CODE),
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

export const saveStspProjectDetailsSchema = z.object({
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
  tenderProposalSubmissionDate: z.string().date("Submission date must be valid"),
  tenderValidityPeriodDays: z
    .number()
    .int()
    .nonnegative("Tender validity period cannot be negative")
    .max(3650, "Tender validity period must be at most 3650 days"),
});

export const stspPicDetailsSchema = z.object({
  teamLeader: z.string().trim().min(1, "Team lead is required").max(120),
  financialMatters: z.string().trim().min(1, "Financial matters PIC is required").max(120),
  technicalMatters: z.string().trim().min(1, "Technical matters PIC is required").max(120),
  contractMatters: z.string().trim().min(1, "Contract matters PIC is required").max(120),
  procurementMatters: z.string().trim().min(1, "Procurement matters PIC is required").max(120),
  costingAndEstimationMatters: z
    .string()
    .trim()
    .min(1, "Costing and estimation matters PIC is required")
    .max(120),
  implementationStage: z.string().trim().min(1, "Implementation stage is required").max(180),
});

export const saveStspDetailsSchema = z.object({
  requestId: z.string().trim().min(1, "Request id is required"),
  ...stspPicDetailsSchema.shape,
  backgroundReview: z.string().trim().min(1, "Background review is required").max(3000),
  scopeOfWorks: z.string().trim().min(1, "Scope of works is required").max(3000),
  keyTerms: z.string().trim().min(1, "Key terms are required").max(3000),
  financialPoints: stspPointListSchema,
  technical: z.string().trim().min(1, "Technical details are required").max(3000),
  procurementStrategyWorkPackages: z
    .string()
    .trim()
    .min(1, "Procurement strategy & work packages are required")
    .max(3000),
  sourcingReference: z.string().trim().min(1, "Sourcing reference is required").max(3000),
  costBreakdown: z.string().trim().min(1, "Cost breakdown is required").max(3000),
  riskReviewMitigationItems: z
    .array(stspRiskItemSchema)
    .min(1, "At least one risk review item is required")
    .max(50, "A maximum of 50 risk review items is allowed"),
  contractStructureUrl: uploadedAssetSchema.shape.url.optional(),
  contractStructurePublicId: uploadedAssetSchema.shape.publicId.optional(),
  contractStructureFileName: uploadedAssetSchema.shape.fileName.optional(),
  contractStructureMimeType: uploadedAssetSchema.shape.mimeType.optional(),
  contractStructureSizeBytes: uploadedAssetSchema.shape.sizeBytes.optional(),
  revenueVsCostUrl: uploadedAssetSchema.shape.url.optional(),
  revenueVsCostPublicId: uploadedAssetSchema.shape.publicId.optional(),
  revenueVsCostFileName: uploadedAssetSchema.shape.fileName.optional(),
  revenueVsCostMimeType: uploadedAssetSchema.shape.mimeType.optional(),
  revenueVsCostSizeBytes: uploadedAssetSchema.shape.sizeBytes.optional(),
  cashflowUrl: uploadedAssetSchema.shape.url.optional(),
  cashflowPublicId: uploadedAssetSchema.shape.publicId.optional(),
  cashflowFileName: uploadedAssetSchema.shape.fileName.optional(),
  cashflowMimeType: uploadedAssetSchema.shape.mimeType.optional(),
  cashflowSizeBytes: uploadedAssetSchema.shape.sizeBytes.optional(),
});

export const submitStspRequestSchema = z.object({
  requestId: z.string().trim().min(1, "Request id is required"),
  acknowledgement: z
    .boolean()
    .refine((value) => value, "Acknowledgement is required before submission"),
  documentUrl: z.string().trim().url("Document URL is invalid"),
  documentPublicId: z.string().trim().min(1, "Document public id is required"),
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
      (value) =>
        allowedDocumentMimeTypes.has(
          value as (typeof STSP_ALLOWED_DOCUMENT_MIME_TYPES)[number]
        ),
      "Unsupported document type"
    ),
  documentSizeBytes: z
    .number()
    .int()
    .positive("Document size must be greater than 0")
    .max(STSP_MAX_DOCUMENT_SIZE_BYTES, "Document must be 10MB or smaller"),
});

export type CreateStspBaseRequestInput = z.infer<typeof createStspBaseRequestSchema>;
export type SaveStspProjectDetailsInput = z.infer<typeof saveStspProjectDetailsSchema>;
export type StspPicDetailsInput = z.infer<typeof stspPicDetailsSchema>;
export type SaveStspDetailsInput = z.infer<typeof saveStspDetailsSchema>;
export type SubmitStspRequestInput = z.infer<typeof submitStspRequestSchema>;
export type StspRiskItemInput = z.infer<typeof stspRiskItemSchema>;
