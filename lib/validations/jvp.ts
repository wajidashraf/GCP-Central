import { z } from "zod";
import {
  RTP_ALLOWED_DOCUMENT_MIME_TYPES,
  RTP_MAX_DOCUMENT_SIZE_BYTES,
} from "./rtp";

export const JVP_FORM_CODE = "JVP" as const;
export const JVP_REQUEST_TITLE = "JV / Partnership";
export const JVP_ALLOWED_DOCUMENT_MIME_TYPES = RTP_ALLOWED_DOCUMENT_MIME_TYPES;
export const JVP_MAX_DOCUMENT_SIZE_BYTES = RTP_MAX_DOCUMENT_SIZE_BYTES;

const routingTypes = ["GCP", "GCPC"] as const;
const allowedDocumentMimeTypes = new Set(JVP_ALLOWED_DOCUMENT_MIME_TYPES);
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
          value as (typeof JVP_ALLOWED_DOCUMENT_MIME_TYPES)[number]
        ),
      "Unsupported uploaded file type"
    ),
  sizeBytes: z
    .number()
    .int()
    .positive("Uploaded file size must be greater than 0")
    .max(JVP_MAX_DOCUMENT_SIZE_BYTES, "Uploaded file must be 10MB or smaller"),
});

const jvpPointItemSchema = z
  .string()
  .trim()
  .min(1, "Point cannot be empty")
  .max(POINT_MAX_LENGTH, `Point must be at most ${POINT_MAX_LENGTH} characters`);

const jvpPointListSchema = z
  .array(jvpPointItemSchema)
  .min(1, "At least one point is required")
  .max(POINTS_MAX_ITEMS, `A maximum of ${POINTS_MAX_ITEMS} points is allowed`);

const jvpRiskItemSchema = z.object({
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

export const createJvpBaseRequestSchema = z
  .object({
    requestType: z.literal(JVP_FORM_CODE),
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

export const saveJvpProjectDetailsSchema = z.object({
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

export const jvpPicDetailsSchema = z.object({
  teamLeader: z
    .string()
    .trim()
    .min(1, "Team lead is required")
    .max(120, "Team lead must be at most 120 characters"),
  financialMatters: z
    .string()
    .trim()
    .min(1, "Financial matters PIC is required")
    .max(120, "Financial matters PIC must be at most 120 characters"),
  technicalMatters: z
    .string()
    .trim()
    .min(1, "Technical matters PIC is required")
    .max(120, "Technical matters PIC must be at most 120 characters"),
  contractMatters: z
    .string()
    .trim()
    .min(1, "Contract matters PIC is required")
    .max(120, "Contract matters PIC must be at most 120 characters"),
  procurementMatters: z
    .string()
    .trim()
    .min(1, "Procurement matters PIC is required")
    .max(120, "Procurement matters PIC must be at most 120 characters"),
  costingAndEstimationMatters: z
    .string()
    .trim()
    .min(1, "Costing and estimation matters PIC is required")
    .max(120, "Costing and estimation matters PIC must be at most 120 characters"),
  implementationStage: z
    .string()
    .trim()
    .min(1, "Implementation stage is required")
    .max(180, "Implementation stage must be at most 180 characters"),
});

export const saveJvpDetailsSchema = z.object({
  requestId: z.string().trim().min(1, "Request id is required"),
  ...jvpPicDetailsSchema.shape,
  backgroundOfCollabPoints: jvpPointListSchema,
  scopeOfCollabPoints: jvpPointListSchema,
  proposedStructurePoints: jvpPointListSchema,
  keyTermsPoints: jvpPointListSchema,
  financialOverviewPoints: jvpPointListSchema,
  technicalCapabilitiesPoints: jvpPointListSchema,
  workPackagesDivisionPoints: jvpPointListSchema,
  resourcesContributionPoints: jvpPointListSchema,
  riskReviewMitigationItems: z
    .array(jvpRiskItemSchema)
    .min(1, "At least one risk review item is required")
    .max(50, "A maximum of 50 risk review items is allowed"),
  cashflowForecastUrl: uploadedAssetSchema.shape.url,
  cashflowForecastPublicId: uploadedAssetSchema.shape.publicId,
  cashflowForecastFileName: uploadedAssetSchema.shape.fileName,
  cashflowForecastMimeType: uploadedAssetSchema.shape.mimeType,
  cashflowForecastSizeBytes: uploadedAssetSchema.shape.sizeBytes,
  costStructureUrl: uploadedAssetSchema.shape.url,
  costStructurePublicId: uploadedAssetSchema.shape.publicId,
  costStructureFileName: uploadedAssetSchema.shape.fileName,
  costStructureMimeType: uploadedAssetSchema.shape.mimeType,
  costStructureSizeBytes: uploadedAssetSchema.shape.sizeBytes,
});

export const submitJvpRequestSchema = z.object({
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
      (value) =>
        allowedDocumentMimeTypes.has(
          value as (typeof JVP_ALLOWED_DOCUMENT_MIME_TYPES)[number]
        ),
      "Unsupported document type"
    ),
  documentSizeBytes: z
    .number()
    .int()
    .positive("Document size must be greater than 0")
    .max(JVP_MAX_DOCUMENT_SIZE_BYTES, "Document must be 10MB or smaller"),
});

export type CreateJvpBaseRequestInput = z.infer<typeof createJvpBaseRequestSchema>;
export type SaveJvpProjectDetailsInput = z.infer<typeof saveJvpProjectDetailsSchema>;
export type JvpPicDetailsInput = z.infer<typeof jvpPicDetailsSchema>;
export type SaveJvpDetailsInput = z.infer<typeof saveJvpDetailsSchema>;
export type SubmitJvpRequestInput = z.infer<typeof submitJvpRequestSchema>;
export type JvpRiskItemInput = z.infer<typeof jvpRiskItemSchema>;
