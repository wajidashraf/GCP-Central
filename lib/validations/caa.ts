import { z } from "zod";
import {
  RTP_ALLOWED_DOCUMENT_MIME_TYPES,
  RTP_MAX_DOCUMENT_SIZE_BYTES,
} from "./rtp";

export const CAA_FORM_CODE = "CAA" as const;
export const CAA_REQUEST_TITLE = "Client - Acceptance of Award";
export const CAA_ALLOWED_DOCUMENT_MIME_TYPES = RTP_ALLOWED_DOCUMENT_MIME_TYPES;
export const CAA_MAX_DOCUMENT_SIZE_BYTES = RTP_MAX_DOCUMENT_SIZE_BYTES;

const routingTypes = ["GCP", "GCPC"] as const;
const allowedDocumentMimeTypes = new Set(CAA_ALLOWED_DOCUMENT_MIME_TYPES);

const uploadedAssetSchema = z.object({
  url: z.string().trim().url("Uploaded file URL is invalid"),
  publicId: z.string().trim().min(1, "Uploaded file public id is required"),
  fileName: z.string().trim().min(1).max(180),
  mimeType: z
    .string()
    .trim()
    .min(1)
    .refine(
      (value) =>
        allowedDocumentMimeTypes.has(
          value as (typeof CAA_ALLOWED_DOCUMENT_MIME_TYPES)[number]
        ),
      "Unsupported uploaded file type"
    ),
  sizeBytes: z.number().int().positive().max(CAA_MAX_DOCUMENT_SIZE_BYTES),
});

const tableRowSchema = z.object({
  no_of_days: z.string().trim().optional().default(""),
  clause_reference: z.string().trim().optional().default(""),
  description: z.string().trim().optional().default(""),
});

export const createCaaBaseRequestSchema = z
  .object({
    requestType: z.literal(CAA_FORM_CODE),
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

export const saveCaaProjectDetailsSchema = z.object({
  requestId: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
  projectCode: z.string().trim().max(60).optional().or(z.literal("")),
  companyId: z.string().trim().min(1),
  companyCode: z.string().trim().min(1).max(20),
  companyName: z.string().trim().min(1).max(120),
});

export const saveCaaDetailsSchema = z.object({
  requestId: z.string().trim().min(1),
  tenderProposalPrice: z.number().nonnegative().optional(),
  finalContractAmount: z.number().nonnegative().optional(),
  estimatedBudgetCost: z.number().nonnegative().optional(),
  estimatedMarginPercent: z.number().nonnegative().optional(),
  tenderProposalRefNo: z.string().trim().optional(),
  loaDate: z.string().date().optional(),
  contractCommencementDate: z.string().date().optional(),
  contractCompletionDate: z.string().date().optional(),
  contractPeriodDays: z.number().int().nonnegative().optional(),
  performanceBondForProject: z.string().trim().optional(),
  stampDutyInclusiveLegalFees: z.number().nonnegative().optional(),
  insurance: z.string().trim().optional(),
  bumiputeraParticipation: z.string().trim().optional(),
  formationOfJvCompany: z.string().trim().optional(),
  criticalActivityMilestone: z.string().trim().optional(),
  defectLiabilityPeriodDlp: z.string().trim().optional(),
  liquidatedDamagesRate: z.number().nonnegative().optional(),
  paymentTerm: z.string().trim().optional(),
  typeOfContract: z.string().trim().optional(),
  formOfContractCondition: z.string().trim().optional(),
  projectDirector: z.string().trim().optional(),
  contactPersonAtSite: z.string().trim().optional(),
  claimApplicationProcess: z.array(tableRowSchema).optional().default([]),
  claimCertificationProcess: z.array(tableRowSchema).optional().default([]),
  variationOrderApplicationProcess: z.array(tableRowSchema).optional().default([]),
  extensionOfTimeApplicationProcess: z.array(tableRowSchema).optional().default([]),
  commissioningCompletionManagementSystems: z.array(tableRowSchema).optional().default([]),
  keyDeliveryMilestone: z.array(tableRowSchema).optional().default([]),
  mandatoryTestingRequiredToCommission: z.array(tableRowSchema).optional().default([]),
  documentRequiredForContractualAcceptance: z.array(tableRowSchema).optional().default([]),
  preRequisiteDocumentsForDlp: z.array(tableRowSchema).optional().default([]),
  organisationAndManpowerChartUrl: uploadedAssetSchema.shape.url.optional(),
  organisationAndManpowerChartPublicId: uploadedAssetSchema.shape.publicId.optional(),
  organisationAndManpowerChartFileName: uploadedAssetSchema.shape.fileName.optional(),
  organisationAndManpowerChartMimeType: uploadedAssetSchema.shape.mimeType.optional(),
  organisationAndManpowerChartSizeBytes: uploadedAssetSchema.shape.sizeBytes.optional(),
});

export const submitCaaRequestSchema = z.object({
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
          value as (typeof CAA_ALLOWED_DOCUMENT_MIME_TYPES)[number]
        ),
      "Unsupported document type"
    ),
  documentSizeBytes: z.number().int().positive().max(CAA_MAX_DOCUMENT_SIZE_BYTES),
});

export type CreateCaaBaseRequestInput = z.infer<typeof createCaaBaseRequestSchema>;
export type SaveCaaProjectDetailsInput = z.infer<typeof saveCaaProjectDetailsSchema>;
export type SaveCaaDetailsInput = z.infer<typeof saveCaaDetailsSchema>;
export type SubmitCaaRequestInput = z.infer<typeof submitCaaRequestSchema>;
