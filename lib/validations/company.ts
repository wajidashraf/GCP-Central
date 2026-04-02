import { z } from "zod";
import { COMPANY_CODES, SECTORS } from "@/src/constants/enums";

const validCompanyCodes = new Set(COMPANY_CODES.map((option) => option.label));
const validSectors = new Set(SECTORS.map((option) => option.label));

export const companySchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(1, "Company Name is required")
    .max(120, "Company Name must be at most 120 characters"),
  companyCode: z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => validCompanyCodes.has(value), {
      message: "Invalid Company Code",
    }),
  sector: z
    .string()
    .trim()
    .refine((value) => validSectors.has(value), {
      message: "Invalid Sector",
    }),
}).strict();

export const companySeedSchema = z
  .array(companySchema)
  .min(1, "At least one company record is required")
  .superRefine((companies, ctx) => {
    const seenCodes = new Set<string>();
    companies.forEach((company, index) => {
      if (seenCodes.has(company.companyCode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate company code found: ${company.companyCode}`,
          path: [index, "companyCode"],
        });
      }
      seenCodes.add(company.companyCode);
    });
  });

export type CompanyValidationType = z.infer<typeof companySchema>;
export type CompanySeedValidationType = z.infer<typeof companySeedSchema>;
