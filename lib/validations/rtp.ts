import { z } from "zod";

export const RTP_FORM_CODE = "RTP" as const;
export const RTP_REQUEST_TITLE = "Registration of Tender & Proposal List";
export const RTP_MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

export const RTP_ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
] as const;

const routingTypes = ["GCP", "GCPC"] as const;
const registrationTypes = [1, 2] as const;
const allowedDocumentMimeTypes = new Set(RTP_ALLOWED_DOCUMENT_MIME_TYPES);
const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateInput(value: string) {
  if (!dateOnlyPattern.test(value)) {
    return false;
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsedDate.getTime());
}

function addDaysToDateOnly(baseDate: string, daysToAdd: number) {
  const parsedDate = new Date(`${baseDate}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  parsedDate.setUTCDate(parsedDate.getUTCDate() + daysToAdd);
  return parsedDate.toISOString().slice(0, 10);
}

export const createRtpBaseRequestSchema = z
  .object({
    requestType: z.literal(RTP_FORM_CODE),
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

export const saveRtpDetailsSchema = z
  .object({
    requestId: z.string().trim().min(1, "Request id is required"),
    clientName: z
      .string()
      .trim()
      .min(1, "Client name is required")
      .max(120, "Client name must be at most 120 characters"),
    registrationType: z
      .coerce.number()
      .int()
      .refine(
        (value) => registrationTypes.includes(value as (typeof registrationTypes)[number]),
        "Invalid registration type"
      ),
    tenderClosingDate: z.string().trim().optional().or(z.literal("")),
    numberOfDaysAfterTenderClosingDate: z.string().trim().optional().or(z.literal("")),
    validityPeriod: z.string().trim().optional().or(z.literal("")),
    projectName: z
      .string()
      .trim()
      .min(1, "Project name is required")
      .max(160, "Project name must be at most 160 characters"),
    projectDescription: z
      .string()
      .trim()
      .min(1, "Project description is required")
      .max(5_000, "Project description must be at most 5000 characters"),
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
    const shouldRequireTenderDate = value.registrationType === 1;
    const tenderClosingDate = value.tenderClosingDate?.trim() ?? "";
    const numberOfDaysAfterTenderClosingDate =
      value.numberOfDaysAfterTenderClosingDate?.trim() ?? "";
    const validityPeriod = value.validityPeriod?.trim() ?? "";

    if (shouldRequireTenderDate && tenderClosingDate.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tender closing date is required for Tender List",
        path: ["tenderClosingDate"],
      });
      return;
    }

    if (tenderClosingDate.length > 0 && !isValidDateInput(tenderClosingDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tender closing date must be a valid date",
        path: ["tenderClosingDate"],
      });
    }

    if (tenderClosingDate.length === 0 && numberOfDaysAfterTenderClosingDate.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tender closing date is required before entering number of days",
        path: ["numberOfDaysAfterTenderClosingDate"],
      });
      return;
    }

    if (tenderClosingDate.length === 0 && validityPeriod.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Validity period requires a tender closing date",
        path: ["validityPeriod"],
      });
      return;
    }

    if (tenderClosingDate.length > 0) {
      if (numberOfDaysAfterTenderClosingDate.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Number of days after tender closing date is required",
          path: ["numberOfDaysAfterTenderClosingDate"],
        });
        return;
      }

      const parsedDays = Number(numberOfDaysAfterTenderClosingDate);
      if (!Number.isInteger(parsedDays) || parsedDays < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Number of days must be a whole number greater than or equal to 0",
          path: ["numberOfDaysAfterTenderClosingDate"],
        });
        return;
      }

      const computedValidityPeriod = addDaysToDateOnly(tenderClosingDate, parsedDays);
      if (!computedValidityPeriod) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Unable to calculate validity period from tender closing date",
          path: ["validityPeriod"],
        });
        return;
      }

      if (!isValidDateInput(validityPeriod)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Validity period must be a valid date",
          path: ["validityPeriod"],
        });
        return;
      }

      if (validityPeriod !== computedValidityPeriod) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Validity period must match tender closing date plus the provided number of days",
          path: ["validityPeriod"],
        });
      }
    }
  });

export const submitRtpRequestSchema = z.object({
  requestId: z.string().trim().min(1, "Request id is required"),
  acknowledgement: z
    .boolean()
    .refine((value) => value, "Acknowledgement is required before submission"),
  specialProject: z.boolean().optional().default(false),
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

export type CreateRtpBaseRequestInput = z.infer<typeof createRtpBaseRequestSchema>;
export type SaveRtpDetailsInput = z.infer<typeof saveRtpDetailsSchema>;
export type SubmitRtpRequestInput = z.infer<typeof submitRtpRequestSchema>;
