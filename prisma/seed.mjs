import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const VALID_COMPANY_CODES = [
  "US01",
  "US02",
  "US03",
  "US04",
  "CNS01",
  "CNS02",
  "HSS01",
  "SS01",
  "SS02",
  "SS03",
  "HIM01",
  "PRO01",
  "PRO02",
  "PRO03",
  "PRO04",
  "GCEO",
];

const VALID_SECTORS = [
  "Utility",
  "Construction",
  "Hospital",
  "Services",
  "IT",
  "Property",
  "GCEO Office",
];

const companyRecordSchema = z
  .object({
    companyName: z
      .string()
      .trim()
      .min(1, "Company Name is required")
      .max(120, "Company Name must be at most 120 characters"),
    companyCode: z.enum(VALID_COMPANY_CODES),
    sector: z.enum(VALID_SECTORS),
  })
  .strict();

const companyRecordsSchema = z
  .array(companyRecordSchema)
  .min(1, "At least one company record is required")
  .superRefine((companies, ctx) => {
    const seenCodes = new Set();
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
function parseEnvFile(content) {
  const entries = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    let value = trimmedLine.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries[key] = value;
  }

  return entries;
}

async function loadEnvFiles() {
  const candidateFiles = [".env", ".env.local"];

  for (const fileName of candidateFiles) {
    const envFileUrl = new URL(`../${fileName}`, import.meta.url);

    try {
      const content = await readFile(envFileUrl, "utf8");
      const entries = parseEnvFile(content);

      for (const [key, value] of Object.entries(entries)) {
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }
}

async function loadCompanyRecords() {
  const recordsFileUrl = new URL("./company-records.json", import.meta.url);
  const contents = await readFile(recordsFileUrl, "utf8");
  return JSON.parse(contents);
}

async function upsertCompanies(companies, prisma) {
  let created = 0;
  let updated = 0;

  for (const company of companies) {
    const existing = await prisma.company.findUnique({
      where: { companyCode: company.companyCode },
      select: { id: true },
    });

    await prisma.company.upsert({
      where: { companyCode: company.companyCode },
      update: {
        companyName: company.companyName,
        sector: company.sector,
      },
      create: company,
    });

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  return { created, updated };
}

async function main() {
  await loadEnvFiles();
  const prisma = new PrismaClient();
  const rawCompanyRecords = await loadCompanyRecords();
  const validatedCompanies = companyRecordsSchema.parse(rawCompanyRecords);
  try {
    const { created, updated } = await upsertCompanies(validatedCompanies, prisma);
    console.log(
      `✓ Company seed completed. Created: ${created}, Updated: ${updated}, Total: ${validatedCompanies.length}`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error("✗ Company seed failed:", error);
    process.exitCode = 1;
  });
