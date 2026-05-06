import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { companySchema } from "@/lib/validations/company";
import { createCompany, listCompanies } from "@/lib/sharepoint/lists";

type CompanyRecord = {
  companyName: string;
  companyCode: string;
  sector: string;
};

export async function POST() {
  try {
    const filePath = path.join(process.cwd(), "prisma", "company-records.json");
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return NextResponse.json(
        { message: "company-records.json must contain an array" },
        { status: 400 }
      );
    }

    const sourceCompanies: CompanyRecord[] = [];
    for (const item of parsed) {
      const validation = companySchema.safeParse(item);
      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid company record in company-records.json",
            record: item,
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }
      sourceCompanies.push(validation.data);
    }

    const existing = await listCompanies();
    const existingCodes = new Set(
      existing.map((company) => company.companyCode.trim().toUpperCase())
    );

    let created = 0;
    let skipped = 0;
    const failed: Array<{ companyCode: string; reason: string }> = [];

    for (const company of sourceCompanies) {
      const code = company.companyCode.trim().toUpperCase();

      if (existingCodes.has(code)) {
        skipped += 1;
        continue;
      }

      try {
        await createCompany({
          companyName: company.companyName,
          companyCode: code,
          sector: company.sector,
          guid: randomUUID(),
        });
        existingCodes.add(code);
        created += 1;
      } catch (error: unknown) {
        failed.push({
          companyCode: code,
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json(
      {
        message: "Company migration to SharePoint completed",
        totalInFile: sourceCompanies.length,
        created,
        skipped,
        failedCount: failed.length,
        failed,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        message: "Migration failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
