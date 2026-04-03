import { NextResponse } from "next/server";
import { companySchema } from "@/lib/validations/company";
import prisma from "@/lib/prisma";

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

    const newCompany = await prisma.company.create({
      data: {
        companyName,
        companyCode,
        sector,
      },
    });

    return NextResponse.json(
      { message: "Company record created successfully", company: newCompany },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { message: "A company with this code already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const companies = await prisma.company.findMany({
      orderBy: [{ companyCode: "asc" }],
    });
    return NextResponse.json({ companies }, { status: 200 });
  } catch {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
