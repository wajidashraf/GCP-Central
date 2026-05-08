import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { companySchema } from "@/lib/validations/company";
import { createCompany, findCompanyByCode, listCompanies } from "@/lib/sharepoint/lists";
import { SHAREPOINT_LIST_FILES } from "@/lib/sharepoint/constants";

type CompanyRecord = {
  companyName: string;
  companyCode: string;
  sector: string;
};

async function seedCompaniesToSharePointOnce() {
  const existingCompanies = await listCompanies();
  if (existingCompanies.length > 0) {
    return { created: 0, skipped: 0, totalInFile: 0, alreadySeeded: true };
  }

  const filePath = path.join(process.cwd(), "prisma", SHAREPOINT_LIST_FILES.companiesSeed);
  const raw = await readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Invalid company-records.json: expected an array");
  }

  const sourceCompanies: CompanyRecord[] = [];
  for (const item of parsed) {
    const validation = companySchema.safeParse(item);
    if (!validation.success) {
      throw new Error("Invalid company record found in company-records.json");
    }
    sourceCompanies.push(validation.data);
  }

  let created = 0;
  let skipped = 0;
  const seenCodes = new Set<string>();

  for (const company of sourceCompanies) {
    const code = company.companyCode.trim().toUpperCase();
    if (seenCodes.has(code)) {
      skipped += 1;
      continue;
    }

    await createCompany({
      companyName: company.companyName,
      companyCode: code,
      sector: company.sector,
      guid: randomUUID(),
    });
    seenCodes.add(code);
    created += 1;
  }

  return { created, skipped, totalInFile: sourceCompanies.length, alreadySeeded: false };
}

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { message: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const validationResult = companySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { message: "Validation failed", errors: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { companyName, companyCode, sector } = validationResult.data;

    const existingCompany = await findCompanyByCode(companyCode);
    if (existingCompany) {
      return NextResponse.json(
        { message: "A company with this code already exists" },
        { status: 409 }
      );
    }

    const newCompany = await createCompany({
      companyName,
      companyCode,
      sector,
    });

    return NextResponse.json(
      { message: "Company record created successfully", company: newCompany },
      { status: 201 }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await seedCompaniesToSharePointOnce();
    const companies = await listCompanies();
    return NextResponse.json({ companies }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
