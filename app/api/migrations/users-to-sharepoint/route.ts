import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { getGraphClient, getSiteId } from "@/lib/graph";
import { createUser, listCompanies, listUsers } from "@/lib/sharepoint/lists";

type UserSeedRecord = {
  name: string;
  email: string;
  emailLower: string;
  username: string;
  usernameLower: string;
  primaryRole: string;
  roles: string[];
  isActive: boolean;
};

const PASSWORD_BY_EMAIL: Record<string, string> = {
  "requestoro3@outlook.com": "RequestorO3_2701",
  "verifiero3@outlook.com": "VerifierO3_2701",
  "reviewero3@outlook.com": "ReviewerO3_2701",
  "workgcpc@outlook.com": "Workgcpc_2701",
  "hogcpc@outlook.com": "Hogcpc_2701",
  "endorsero3@outlook.com": "EndorserO3_2701",
  "maincomo3@outlook.com": "MaincomO3_2701",
  "iqbaalhakimz@gmail.com": "Iqbaalhakimz_2701",
  "iqbaal@o3cs.my": "Iqbaal_2701",
  "dayang_izni@o3cs.my": "Dayangizni_2701",
  "azzaimah@o3cs.my": "Azzaimah_2701",
  "bobby@obyu.com": "Bobby_2701",
  "iqbaalhakim@ymail.com": "Iqbaalhakim_2701",
  "fareezaff26@gmail.com": "Fareezaff_26",
};

const PASSWORD_BY_USERNAME: Record<string, string> = {
  izniibrahim: "Izniibrahim_2701",
};

function pickRandom<T>(items: T[]): T {
  const index = Math.floor(Math.random() * items.length);
  return items[index];
}

function getPassword(record: UserSeedRecord): string {
  const byEmail = PASSWORD_BY_EMAIL[record.emailLower];
  if (byEmail) return byEmail;
  const byUsername = PASSWORD_BY_USERNAME[record.usernameLower];
  if (byUsername) return byUsername;
  return `${record.username}_2701`;
}

async function getCompanyLookupFieldInternalName(): Promise<string | null> {
  const usersListId = process.env.USERS_LIST_ID;
  if (!usersListId) {
    throw new Error("USERS_LIST_ID is not set in .env.local");
  }

  const client = getGraphClient();
  const siteId = getSiteId();
  const res = await client.api(`/sites/${siteId}/lists/${usersListId}/columns`).get();
  const columns = Array.isArray(res?.value) ? res.value : [];

  const lookupColumn = columns.find(
    (column: { name?: string; displayName?: string; lookup?: unknown }) =>
      Boolean(column.lookup) &&
      ((column.name ?? "").toLowerCase() === "companyid" ||
        (column.displayName ?? "").toLowerCase() === "companyid")
  );

  return lookupColumn?.name ?? null;
}

export async function POST() {
  try {
    const existingUsers = await listUsers();
    if (existingUsers.length > 0) {
      return NextResponse.json(
        {
          message: "Users list already has records. Seed skipped.",
          alreadySeeded: true,
          existingCount: existingUsers.length,
        },
        { status: 200 }
      );
    }

    const companies = await listCompanies();
    if (companies.length === 0) {
      return NextResponse.json(
        { message: "No companies found. Seed companies first." },
        { status: 400 }
      );
    }

    const companyLookupField = await getCompanyLookupFieldInternalName();

    const filePath = path.join(process.cwd(), "prisma", "users-records.json");
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return NextResponse.json(
        { message: "users-records.json must contain an array" },
        { status: 400 }
      );
    }

    const users = parsed as UserSeedRecord[];
    const results: Array<{ emailLower: string; status: "created" | "failed"; reason?: string }> = [];
    let created = 0;

    for (const user of users) {
      try {
        const randomCompany = pickRandom(companies);
        const plainPassword = getPassword(user);
        const passwordHash = await hash(plainPassword, 10);

        const fields: Record<string, unknown> = {
          Title: user.name,
          uuid: randomUUID(),
          isActive: user.isActive,
          username: user.username,
          usernameLower: user.usernameLower,
          primaryRole: user.primaryRole,
          companyCode: randomCompany.companyCode,
          companyName: randomCompany.Title ?? randomCompany.companyCode,
          email: user.email,
          emailLower: user.emailLower,
          passwordHash,
          roles: JSON.stringify(user.roles),
        };

        if (companyLookupField) {
          fields[`${companyLookupField}LookupId`] = Number(randomCompany.id);
        }

        await createUser(fields);
        created += 1;
        results.push({ emailLower: user.emailLower, status: "created" });
      } catch (error: unknown) {
        results.push({
          emailLower: user.emailLower,
          status: "failed",
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json(
      {
        message: "Users seed completed",
        alreadySeeded: false,
        totalInFile: users.length,
        created,
        failed: results.filter((r) => r.status === "failed"),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        message: "Users seed failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
