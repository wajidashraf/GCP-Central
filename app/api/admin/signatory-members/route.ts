import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/src/lib/auth/get-current-user";
import { hasRole } from "@/src/lib/auth/has-role";

const GROUPS = ["prepared", "confirmed"] as const;
type SignatoryGroup = (typeof GROUPS)[number];

function normalizeGroup(value: unknown): SignatoryGroup | null {
  if (typeof value !== "string") return null;
  const g = value.trim().toLowerCase();
  return GROUPS.includes(g as SignatoryGroup) ? (g as SignatoryGroup) : null;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !hasRole(user, "admin")) {
      return NextResponse.json({ error: "Only admins can view signatory members" }, { status: 403 });
    }

    const members = await prisma.signatoryMember.findMany({
      orderBy: [{ group: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error("Error listing signatory members:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasRole(user, "admin")) {
      return NextResponse.json({ error: "Only admins can add signatory members" }, { status: 403 });
    }

    const body = await request.json();
    const group = normalizeGroup(body.group);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const emailLower = email.toLowerCase();

    if (!group || !name || !email) {
      return NextResponse.json({ error: "Group, name, and email are required" }, { status: 400 });
    }

    const last = await prisma.signatoryMember.findFirst({
      where: { group },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const sortOrder = (last?.sortOrder ?? -1) + 1;

    const created = await prisma.signatoryMember.create({
      data: {
        group,
        name,
        email,
        emailLower,
        sortOrder,
      },
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error("Error creating signatory member:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
