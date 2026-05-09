import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth/get-current-user";
import { hasRole } from "@/src/lib/auth/has-role";
import {
  createSignatoryMember,
  listSignatoryMembersOrdered,
  type SPSignatoryMemberRow,
} from "@/lib/sharepoint/signatories";

const GROUPS = ["prepared", "confirmed"] as const;
type SignatoryGroup = (typeof GROUPS)[number];

function normalizeGroup(value: unknown): SignatoryGroup | null {
  if (typeof value !== "string") return null;
  const g = value.trim().toLowerCase();
  return GROUPS.includes(g as SignatoryGroup) ? (g as SignatoryGroup) : null;
}

function memberGroup(row: SPSignatoryMemberRow): string {
  return String(row.signatoryGroup ?? row.group ?? "").trim().toLowerCase();
}

function mapMemberToApi(row: SPSignatoryMemberRow & { id: string }) {
  return {
    id: row.id,
    group: memberGroup(row),
    name: row.Title ?? "",
    email: row.email ?? "",
    sortOrder: Number(row.sortOrder ?? 0),
  };
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !hasRole(user, "admin")) {
      return NextResponse.json({ error: "Only admins can view signatory members" }, { status: 403 });
    }

    const members = await listSignatoryMembersOrdered();
    return NextResponse.json(members.map((m) => mapMemberToApi(m)));
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

    const members = await listSignatoryMembersOrdered();
    const inGroup = members.filter((m) => memberGroup(m) === group);
    const lastOrder = inGroup.reduce((max, m) => Math.max(max, Number(m.sortOrder ?? 0)), -1);
    const sortOrder = lastOrder + 1;

    const created = await createSignatoryMember({
      group,
      name,
      email,
      emailLower,
      sortOrder,
    });

    return NextResponse.json(mapMemberToApi(created));
  } catch (error) {
    console.error("Error creating signatory member:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
