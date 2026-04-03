import { readFile } from "node:fs/promises";
import bcrypt from "bcryptjs";
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

const ROLE_DEFINITIONS = [
  { slug: "requestor", name: "Requestor" },
  { slug: "verifier", name: "Verifier" },
  { slug: "reviewer", name: "Reviewer" },
  { slug: "working_gcpc", name: "Working GCPC" },
  { slug: "hoc", name: "HOC" },
  { slug: "endorser", name: "Endorser" },
  { slug: "main_committee", name: "Main Committee" },
  { slug: "admin", name: "Admin" },
];

const ROLE_PRIORITY = [
  "admin",
  "main_committee",
  "endorser",
  "reviewer",
  "verifier",
  "hoc",
  "working_gcpc",
  "requestor",
];

const USER_SEED_INPUT = [
  {
    roleSlug: "requestor",
    email: "izniibrahim2701@gmail.com",
    companyName: "Shorefield Sdn. Bhd.",
    username: "izniibrahim",
    password: "Izniibrahim_2701",
  },
  {
    roleSlug: "requestor",
    email: "iqbaalhakimz@gmail.com",
    companyName: "Javel Engineering Sdn. Bhd.",
    username: "iqbaalhakimz",
    password: "Iqbaalhakimz_2701",
  },
  {
    roleSlug: "verifier",
    email: "iqbaal@O3CS.my",
    username: "iqbaal",
    password: "Iqbaal_2701",
  },
  {
    roleSlug: "reviewer",
    email: "iqbaal@O3CS.my",
    username: "iqbaal",
    password: "Iqbaal_2701",
  },
  {
    roleSlug: "reviewer",
    email: "dayang_izni@O3CS.my",
    username: "dayang izni",
    password: "Dayangizni_2701",
  },
  {
    roleSlug: "working_gcpc",
    email: "dayang_izni@O3CS.my",
    username: "dayang izni",
    password: "Dayangizni_2701",
  },
  {
    roleSlug: "working_gcpc",
    email: "azzaimah@O3CS.my",
    username: "azzaimah",
    password: "Azzaimah_2701",
  },
  {
    roleSlug: "working_gcpc",
    email: "bobby@obyu.com",
    username: "bobby",
    password: "Bobby_2701",
  },
  {
    roleSlug: "hoc",
    email: "iqbaalhakim@ymail.com",
    companyName: "Shorefield Sdn. Bhd.",
    username: "iqbaalhakim",
    password: "Iqbaalhakim_2701",
  },
  {
    roleSlug: "hoc",
    email: "fareezaff26@gmail.com",
    companyName: "Javel Engineering Sdn. Bhd.",
    username: "fareezaff26",
    password: "Fareezaff_26",
  },
  {
    roleSlug: "endorser",
    email: "azzaimah@O3CS.my",
  },
  {
    roleSlug: "main_committee",
    email: "fareez@O3CS.my",
  },
  {
    roleSlug: "admin",
    email: "iqbaal@O3CS.my",
    username: "iqbaal",
    password: "Iqbaal_2701",
  },
];

const roleSlugSet = new Set(ROLE_DEFINITIONS.map((role) => role.slug));

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

async function upsertRoles(roles, prisma) {
  let created = 0;
  let updated = 0;

  for (const role of roles) {
    const existing = await prisma.role.findUnique({
      where: { slug: role.slug },
      select: { id: true },
    });

    await prisma.role.upsert({
      where: { slug: role.slug },
      update: {
        name: role.name,
      },
      create: role,
    });

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  return { created, updated };
}

function normalizeLookupValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function deterministicIndex(seedText, listLength) {
  if (listLength < 1) {
    return 0;
  }

  let hash = 17;
  for (const character of seedText) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash % listLength;
}

function pickDeterministicCompany(companies, seedText) {
  const index = deterministicIndex(seedText, companies.length);
  return companies[index];
}

function resolveCompany(preferredCompanyName, companies, seedText) {
  if (preferredCompanyName) {
    const normalizedPreferred = normalizeLookupValue(preferredCompanyName);
    const exact = companies.find(
      (company) => normalizeLookupValue(company.companyName) === normalizedPreferred
    );
    if (exact) {
      return exact;
    }

    const relaxed = companies.find((company) => {
      const normalizedCompany = normalizeLookupValue(company.companyName);
      return (
        normalizedCompany.includes(normalizedPreferred) ||
        normalizedPreferred.includes(normalizedCompany)
      );
    });
    if (relaxed) {
      return relaxed;
    }
  }

  return pickDeterministicCompany(companies, seedText);
}

function sanitizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
}

function ensureUniqueUsername(baseUsername, reservedUsernames) {
  const safeBase = baseUsername || "user";
  if (!reservedUsernames.has(safeBase)) {
    return safeBase;
  }

  let suffix = 2;
  while (reservedUsernames.has(`${safeBase}${suffix}`)) {
    suffix += 1;
  }
  return `${safeBase}${suffix}`;
}

function toDisplayName(username, email) {
  const source = String(username || email || "User")
    .replace(/[^a-zA-Z0-9._-]/g, " ")
    .replace(/[._-]/g, " ")
    .trim();

  if (!source) {
    return "User";
  }

  return source
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildGeneratedPassword(username, email) {
  const baseSource = sanitizeUsername(username) || sanitizeUsername(email.split("@")[0]) || "user";
  const withLeadingCapital = `${baseSource.charAt(0).toUpperCase()}${baseSource.slice(1)}`;
  return `${withLeadingCapital}_2701`;
}

function sortRolesByPriority(roles) {
  return [...roles].sort(
    (left, right) => ROLE_PRIORITY.indexOf(left) - ROLE_PRIORITY.indexOf(right)
  );
}

function pickPrimaryRole(roles) {
  for (const role of ROLE_PRIORITY) {
    if (roles.includes(role)) {
      return role;
    }
  }
  return "requestor";
}

function normalizeUserSeedEntries(rawUsers, companies, existingUsers) {
  const existingByEmailLower = new Map(existingUsers.map((user) => [user.emailLower, user]));
  const reservedUsernames = new Set(existingUsers.map((user) => user.usernameLower));
  const aggregatedByEmail = new Map();

  for (const rawUser of rawUsers) {
    const roleSlug = String(rawUser.roleSlug || "").trim();
    if (!roleSlugSet.has(roleSlug)) {
      throw new Error(`Unknown role slug "${roleSlug}" in USER_SEED_INPUT.`);
    }

    const email = String(rawUser.email || "").trim();
    if (!email) {
      throw new Error(`Missing email for role "${roleSlug}" in USER_SEED_INPUT.`);
    }

    const emailLower = email.toLowerCase();
    const providedCompanyName = rawUser.companyName ? String(rawUser.companyName).trim() : "";
    const providedUsername = rawUser.username ? String(rawUser.username).trim() : "";
    const providedPassword = rawUser.password ? String(rawUser.password).trim() : "";
    const resolvedCompany = resolveCompany(providedCompanyName || null, companies, emailLower);

    const existingAggregate = aggregatedByEmail.get(emailLower);
    if (!existingAggregate) {
      aggregatedByEmail.set(emailLower, {
        email,
        emailLower,
        companyId: resolvedCompany.id,
        companyCode: resolvedCompany.companyCode,
        companyName: resolvedCompany.companyName,
        hasProvidedCompany: Boolean(providedCompanyName),
        usernameInput: providedUsername,
        hasProvidedUsername: Boolean(providedUsername),
        passwordInput: providedPassword,
        hasProvidedPassword: Boolean(providedPassword),
        roles: new Set([roleSlug]),
      });
      continue;
    }

    existingAggregate.roles.add(roleSlug);

    if (providedCompanyName && !existingAggregate.hasProvidedCompany) {
      existingAggregate.companyId = resolvedCompany.id;
      existingAggregate.companyCode = resolvedCompany.companyCode;
      existingAggregate.companyName = resolvedCompany.companyName;
      existingAggregate.hasProvidedCompany = true;
    }

    if (providedUsername && !existingAggregate.hasProvidedUsername) {
      existingAggregate.usernameInput = providedUsername;
      existingAggregate.hasProvidedUsername = true;
    }

    if (providedPassword && !existingAggregate.hasProvidedPassword) {
      existingAggregate.passwordInput = providedPassword;
      existingAggregate.hasProvidedPassword = true;
    }
  }

  const normalizedUsers = [];
  const generatedEntries = [];

  const orderedAggregates = [...aggregatedByEmail.values()].sort((left, right) =>
    left.emailLower.localeCompare(right.emailLower)
  );

  for (const aggregate of orderedAggregates) {
    const existingUser = existingByEmailLower.get(aggregate.emailLower);
    if (existingUser?.usernameLower) {
      reservedUsernames.delete(existingUser.usernameLower);
    }

    const usernameSeed = sanitizeUsername(
      aggregate.usernameInput || aggregate.emailLower.split("@")[0]
    );
    const usernameLower = ensureUniqueUsername(usernameSeed, reservedUsernames);
    reservedUsernames.add(usernameLower);

    const password = aggregate.passwordInput || buildGeneratedPassword(usernameLower, aggregate.emailLower);
    const sortedRoles = sortRolesByPriority([...aggregate.roles]);
    const primaryRole = pickPrimaryRole(sortedRoles);

    normalizedUsers.push({
      email: aggregate.email,
      emailLower: aggregate.emailLower,
      username: usernameLower,
      usernameLower,
      password,
      name: toDisplayName(usernameLower, aggregate.emailLower),
      companyId: aggregate.companyId,
      companyCode: aggregate.companyCode,
      companyName: aggregate.companyName,
      roles: sortedRoles,
      primaryRole,
    });

    if (
      !aggregate.hasProvidedCompany ||
      !aggregate.hasProvidedUsername ||
      !aggregate.hasProvidedPassword
    ) {
      generatedEntries.push({
        email: aggregate.email,
        username: usernameLower,
        password,
        companyName: aggregate.companyName,
        roles: sortedRoles.join(", "),
      });
    }
  }

  return { normalizedUsers, generatedEntries };
}

async function upsertUsers(users, prisma) {
  let created = 0;
  let updated = 0;

  for (const user of users) {
    const existing = await prisma.user.findUnique({
      where: { emailLower: user.emailLower },
      select: { id: true },
    });

    const passwordHash = await bcrypt.hash(user.password, 10);

    await prisma.user.upsert({
      where: { emailLower: user.emailLower },
      update: {
        name: user.name,
        email: user.email,
        username: user.username,
        usernameLower: user.usernameLower,
        passwordHash,
        primaryRole: user.primaryRole,
        roles: user.roles,
        companyId: user.companyId,
        isActive: true,
      },
      create: {
        name: user.name,
        email: user.email,
        emailLower: user.emailLower,
        username: user.username,
        usernameLower: user.usernameLower,
        passwordHash,
        primaryRole: user.primaryRole,
        roles: user.roles,
        companyId: user.companyId,
        isActive: true,
      },
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
    const companySummary = await upsertCompanies(validatedCompanies, prisma);
    const allCompanies = await prisma.company.findMany({
      orderBy: { companyCode: "asc" },
      select: {
        id: true,
        companyCode: true,
        companyName: true,
      },
    });

    if (allCompanies.length < 1) {
      throw new Error("No companies available after seeding; cannot seed users.");
    }

    const roleSummary = await upsertRoles(ROLE_DEFINITIONS, prisma);
    const existingUsers = await prisma.user.findMany({
      select: {
        emailLower: true,
        usernameLower: true,
      },
    });
    const { normalizedUsers, generatedEntries } = normalizeUserSeedEntries(
      USER_SEED_INPUT,
      allCompanies,
      existingUsers
    );
    const userSummary = await upsertUsers(normalizedUsers, prisma);

    console.log(
      `✓ Company seed completed. Created: ${companySummary.created}, Updated: ${companySummary.updated}, Total: ${validatedCompanies.length}`
    );
    console.log(
      `✓ Role seed completed. Created: ${roleSummary.created}, Updated: ${roleSummary.updated}, Total: ${ROLE_DEFINITIONS.length}`
    );
    console.log(
      `✓ User seed completed. Created: ${userSummary.created}, Updated: ${userSummary.updated}, Total: ${normalizedUsers.length}`
    );

    if (generatedEntries.length > 0) {
      console.log("⚠ Generated defaults for users with missing username/password/company:");
      for (const entry of generatedEntries) {
        console.log(
          `  - ${entry.email} | username=${entry.username} | password=${entry.password} | company=${entry.companyName} | roles=${entry.roles}`
        );
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("✗ Seed failed:", error);
  process.exitCode = 1;
});
