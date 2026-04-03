# GCP Central — Developer Guide

A complete reference for new developers joining this project. Read this document before writing any code.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Folder Structure](#2-folder-structure)
3. [Tech Stack](#3-tech-stack)
4. [Environment Variables](#4-environment-variables)
5. [Database Setup — MongoDB + Prisma](#5-database-setup--mongodb--prisma)
6. [Prisma Schema Reference](#6-prisma-schema-reference)
7. [Adding a New Database Model (Table)](#7-adding-a-new-database-model-table)
8. [Enum Constants System](#8-enum-constants-system)
9. [Zod Validation — Patterns & Rules](#9-zod-validation--patterns--rules)
10. [Database Seeding](#10-database-seeding)
11. [Fetching Data with Server Components](#11-fetching-data-with-server-components)
12. [Forms with Server Actions + Dual Validation](#12-forms-with-server-actions--dual-validation)
13. [API Routes Reference](#13-api-routes-reference)
14. [Cloudinary File Uploads](#14-cloudinary-file-uploads)
15. [Adding New Features — End-to-End Checklist](#15-adding-new-features--end-to-end-checklist)
16. [UI Components](#16-ui-components)
17. [Authentication — Structure & Roadmap](#17-authentication--structure--roadmap)
18. [Implementation Status](#18-implementation-status)

---

## 1. Project Overview

**GCP Central** is a procurement and governance management platform built with Next.js 16 App Router. It manages companies, projects, requests, and procurement workflows for a group of related entities. Data lives in MongoDB Atlas, accessed through Prisma ORM, with Zod for runtime validation and Cloudinary for file/image storage.

---

## 2. Folder Structure

```
gcp-central/
├── app/                              # Next.js App Router
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts          # NextAuth handler (STUB — not yet active)
│   │   └── company/
│   │       └── route.ts              # Company CRUD endpoints (POST + GET)
│   ├── admin/
│   │   └── page.tsx                  # Admin panel (STUB — Sprint 3)
│   ├── dashboard/
│   │   └── page.tsx                  # Dashboard (STUB — Sprint 3)
│   ├── login/
│   │   └── page.tsx                  # Login page (STUB — needs NextAuth)
│   ├── requests/
│   │   └── page.tsx                  # Review Requests listing (STUB — Sprint 1)
│   ├── submit/
│   │   └── page.tsx                  # Create Request — form type selector
│   │   # TODO: add /submit/gcpc/[type] and /submit/gcp/[type] sub-routes
│   ├── layout.tsx                    # Root layout — wraps all pages in AppShell
│   ├── page.tsx                      # Home page (IMPLEMENTED)
│   └── globals.css                   # Full design system (CSS custom properties)
│
├── lib/                              # Shared server-side utilities
│   ├── prisma.ts                     # Singleton Prisma client
│   ├── db.ts                         # Mongoose connection helper (for aggregations)
│   ├── env.ts                        # Typed environment variable config
│   ├── cloudinary.ts                 # Cloudinary upload/delete helpers
│   ├── constants.ts                  # App-wide constants
│   ├── utils.ts                      # Generic utility functions
│   └── validations/                  # Zod schemas (one file per domain model)
│       └── company.ts
│
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── app-shell.tsx         # Root layout wrapper (header + main + footer)
│   │   │   ├── header.tsx            # Top navigation bar (IMPLEMENTED)
│   │   │   └── footer.tsx            # Footer with form type reference (IMPLEMENTED)
│   │   └── ui/
│   │       └── button.tsx            # Typed Button component (href → Link)
│   │       # TODO: add Input, Select, Badge, Modal, Toast components
│   │
│   ├── config/
│   │   └── navigation.ts             # Role-filtered nav items
│   │
│   ├── constants/
│   │   └── enums/                    # All select/dropdown values
│   │       ├── index.ts              # Barrel export — always import from here
│   │       ├── types.ts              # SelectOption<T> type
│   │       ├── companyCodes.ts       # 16 company codes
│   │       ├── sectors.ts            # 7 business sectors
│   │       ├── organizational.ts     # Roles, decision codes
│   │       ├── status.ts             # Engagement, project, SLA statuses
│   │       ├── procurement.ts        # Procurement methods, request categories
│   │       ├── requestStatus.ts      # 20-state request workflow
│   │       ├── matters.ts            # 14 matter types, 9 outcomes
│   │       ├── soaCodes.ts           # 14 SOA codes
│   │       └── utils.ts              # getLabelByValue, isValidEnumValue, etc.
│   │
│   ├── lib/
│   │   └── auth/
│   │       ├── auth.config.ts        # NextAuth config (STUB — ready to uncomment)
│   │       └── get-current-user.ts   # Currently returns hardcoded mock user
│   │
│   ├── types/
│   │   └── auth.ts                   # CurrentUser, UserRole types
│   │
│   └── UI/
│       └── theme.ts                  # Design tokens (JS/TS mirror of globals.css)
│
├── prisma/
│   ├── schema.prisma                 # Prisma models (MongoDB)
│   ├── seed.mjs                      # Idempotent seed script
│   └── company-records.json          # 16 canonical company records
│
├── public/                           # Static assets
├── tailwind.config.ts                # Custom design system tokens for Tailwind
├── .env.local                        # Local secrets (never commit)
├── package.json
├── tsconfig.json                     # @/* path alias → project root
└── DEVELOPER_GUIDE.md
```

---

## 3. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Framework | Next.js 16 (App Router) | SSR, Server Components, Server Actions |
| Database | MongoDB Atlas | Primary data store |
| ORM | Prisma 6 | Type-safe DB access |
| Validation | Zod 4 | Runtime schema validation |
| File Storage | Cloudinary | Image and document uploads |
| Styling | Tailwind CSS 4 + CSS Custom Properties | Utility-first CSS + design system |
| Language | TypeScript 5 (strict) | Type safety throughout |
| Auth | NextAuth.js (PENDING) | Session management, RBAC |

---

## 4. Environment Variables

All env vars are typed and validated in `lib/env.ts`. Never read `process.env` directly anywhere except that file.

**Required in `.env.local`:**

```
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/GCP-DataBase
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**Reading env vars in code:**

```typescript
// lib/env.ts exports a typed `env` object
import { env } from "@/lib/env";

const uri = env.MONGODB_URI;
```

Never use `process.env.MONGODB_URI` inline elsewhere — always go through `lib/env.ts`.

---

## 5. Database Setup — MongoDB + Prisma

### How Prisma connects to MongoDB

Prisma reads `MONGODB_URI` from the environment and uses it to talk to MongoDB Atlas. The `@id` field on every model maps to MongoDB's `_id` ObjectId.

**The singleton Prisma client** is in `lib/prisma.ts`. It is reused across hot-reloads in development:

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => new PrismaClient()

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
```

**Always import `prisma` from this file.** Never instantiate `new PrismaClient()` in a route or component.

```typescript
import prisma from "@/lib/prisma";
```

### Why there is also a `lib/db.ts` (Mongoose)

`lib/db.ts` provides a Mongoose connection helper that may be needed for advanced MongoDB features (aggregation pipelines, text search) not covered by Prisma. For standard CRUD, always prefer Prisma.

---

## 6. Prisma Schema Reference

**File:** `prisma/schema.prisma`

```prisma
datasource db {
  provider = "mongodb"
  url      = env("MONGODB_URI")
}

model Company {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  companyName String
  companyCode String   @unique
  sector      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### Key rules for every model

- `@id @default(auto()) @map("_id") @db.ObjectId` — required on every model for MongoDB.
- `@unique` on natural keys (like `companyCode`) prevents duplicate records.
- `createdAt` and `updatedAt` are always included for audit trails.
- Field names use `camelCase` (Prisma convention).

### After changing the schema

Run this command to regenerate the Prisma client types:

```bash
npx prisma generate
```

You do **not** need to run migrations for MongoDB. Prisma generates the TypeScript client from the schema; MongoDB creates collections on first write.

---

## 7. Adding a New Database Model (Table)

Follow these five steps every time you add a new model.

### Step 1 — Add the model to `prisma/schema.prisma`

```prisma
model Project {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  title       String
  companyCode String
  status      Int      @default(1)   // references PROJECT_STATUS enum value
  sector      Int                    // references SECTORS enum value
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

Then regenerate the client:

```bash
npx prisma generate
```

### Step 2 — Add a Zod schema in `lib/validations/`

Create `lib/validations/project.ts`:

```typescript
import { z } from "zod";
import { SECTORS, PROJECT_STATUS, isValidEnumValue } from "@/src/constants/enums";

export const projectSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  companyCode: z.string().trim().min(1, "Company Code is required"),
  status: z
    .number()
    .int()
    .refine((val) => isValidEnumValue(PROJECT_STATUS, val), "Invalid status"),
  sector: z
    .number()
    .int()
    .refine((val) => isValidEnumValue(SECTORS, val), "Invalid sector"),
}).strict();

export type ProjectValidationType = z.infer<typeof projectSchema>;
```

### Step 3 — Add an API route in `app/api/`

Create `app/api/project/route.ts`:

```typescript
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { projectSchema } from "@/lib/validations/project";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON payload" }, { status: 400 });
    }

    const result = projectSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { message: "Validation failed", errors: result.error.format() },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({ data: result.data });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ message: "Record already exists" }, { status: 409 });
    }
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ projects }, { status: 200 });
  } catch {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
```

### Step 4 — Add seed data if the model has canonical records

Add to `prisma/seed.mjs` or create a separate `prisma/seed-projects.mjs` following the same pattern as the company seed.

### Step 5 — Add enum constants if the model introduces new select fields

Follow the pattern in `src/constants/enums/` (detailed in section 8).

---

## 8. Enum Constants System

All dropdown/select values — statuses, codes, sectors — live in `src/constants/enums/`. This is the **single source of truth** for all categorical values.

### Files and their purpose

| File | What it contains |
|---|---|
| `types.ts` | `SelectOption<T>` type used by every enum |
| `companyCodes.ts` | 16 company codes (US01, PRO01, etc.) |
| `sectors.ts` | 7 business sectors |
| `organizational.ts` | Company roles, decision codes |
| `status.ts` | Engagement, project, and SLA states |
| `procurement.ts` | Procurement methods, registration types, request categories |
| `requestStatus.ts` | 20-state request workflow + phase groups |
| `matters.ts` | 14 matter types + 9 outcome codes |
| `soaCodes.ts` | 14 SOA codes |
| `utils.ts` | Helper functions: `getLabelByValue`, `isValidEnumValue`, etc. |
| `index.ts` | Barrel export — **always import from here** |

### How enums are structured

Every enum file exports three things:

```typescript
// 1. Array — used in form dropdowns
export const SECTORS: SelectOption<number>[] = [
  { value: 1, label: 'Utility' },
  { value: 2, label: 'Construction' },
] as const;

// 2. Map — used for type-safe direct access
export const SECTORS_MAP = {
  UTILITY: { value: 1, label: 'Utility' },
  CONSTRUCTION: { value: 2, label: 'Construction' },
} as const;

// 3. Type union — used in function signatures
export type SectorValue = typeof SECTORS[number]['value'];
export const SECTOR_VALUES = [1, 2, 3, 4, 5, 6, 7] as const;
export type SectorValueUnion = (typeof SECTOR_VALUES)[number];
```

### Importing enums

```typescript
// Always import from the barrel export
import { SECTORS, SECTORS_MAP, type SectorValue } from "@/src/constants/enums";

// In a form dropdown
SECTORS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)

// Direct access by key
const label = SECTORS_MAP.UTILITY.label; // 'Utility'

// Getting a label from a stored numeric value
import { getLabelByValue } from "@/src/constants/enums";
const label = getLabelByValue(SECTORS, 1); // 'Utility'
```

### Adding a new enum

1. Create `src/constants/enums/myDomain.ts` following the pattern above.
2. Export it from `src/constants/enums/index.ts`.
3. If new helper functions are needed, add them to `utils.ts`.

---

## 9. Zod Validation — Patterns & Rules

Zod is used for **all** data validation — both in API routes (server) and form components (client, via the same schema).

### Where schemas live

All Zod schemas go in `lib/validations/`. One file per domain model.

### Standard schema patterns

**String fields:**
```typescript
z.string().trim().min(1, "Required").max(200, "Too long")
```

**Enum-validated string fields (companyCode, sector label):**
```typescript
const validCodes = new Set(COMPANY_CODES.map((c) => c.label));
z.string().trim().toUpperCase().refine((val) => validCodes.has(val), "Invalid code")
```

**Enum-validated numeric fields (status, sector value):**
```typescript
z.number().int().refine((val) => isValidEnumValue(SECTORS, val), "Invalid sector")
```

**Optional fields:**
```typescript
z.string().trim().optional()
z.number().optional()
```

**Arrays with cross-record validation:**
```typescript
z.array(itemSchema).superRefine((items, ctx) => {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (seen.has(item.code)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate code: ${item.code}`,
        path: [index, "code"],
      });
    }
    seen.add(item.code);
  });
});
```

### Always use `.strict()`

Add `.strict()` to object schemas to reject unknown fields submitted by clients:

```typescript
export const companySchema = z.object({ ... }).strict();
```

### Always export the inferred type

```typescript
export type CompanyValidationType = z.infer<typeof companySchema>;
```

This type is used in both the API route and form component without duplication.

---

## 10. Database Seeding

Seed data populates required lookup records (companies, reference data) that the app depends on to function.

### Running the seed

```bash
npm run db:seed
```

This is idempotent — running it multiple times will not create duplicates. It upserts by the unique natural key.

### Seed files

| File | Purpose |
|---|---|
| `prisma/seed.mjs` | Seed runner script (ESM, auto-loads `.env.local`) |
| `prisma/company-records.json` | Canonical list of all 16 company records |

### How the seed works

1. Loads `.env` and `.env.local` to make `MONGODB_URI` available.
2. Reads `company-records.json`.
3. Validates every record against the Zod schema (same rules as the API).
4. For each record, calls `prisma.company.upsert()` keyed on `companyCode`.
5. Reports how many records were created vs. updated.

### Adding seed data for a new model

Create `prisma/my-model-records.json` with the data array, then add a section to `prisma/seed.mjs`:

```javascript
async function seedMyModel(prisma) {
  const recordsUrl = new URL("./my-model-records.json", import.meta.url);
  const raw = JSON.parse(await readFile(recordsUrl, "utf8"));
  const records = myModelSchema.array().parse(raw);

  let created = 0, updated = 0;
  for (const record of records) {
    const existing = await prisma.myModel.findUnique({
      where: { uniqueKey: record.uniqueKey },
      select: { id: true },
    });
    await prisma.myModel.upsert({
      where: { uniqueKey: record.uniqueKey },
      update: { ...record },
      create: record,
    });
    existing ? updated++ : created++;
  }
  console.log(`✓ MyModel seed: Created ${created}, Updated ${updated}`);
}
```

---

## 11. Fetching Data with Server Components

In the App Router, **Server Components** (any component without `"use client"`) can query the database directly without an API round-trip. This is the preferred approach for read-only pages.

### Direct Prisma query in a Server Component

```typescript
// app/companies/page.tsx
// No "use client" — this is a Server Component

import prisma from "@/lib/prisma";
import { getLabelByValue } from "@/src/constants/enums";
import { SECTORS } from "@/src/constants/enums";

export default async function CompaniesPage() {
  const companies = await prisma.company.findMany({
    orderBy: { companyCode: "asc" },
  });

  return (
    <main>
      <h1>Companies</h1>
      <ul>
        {companies.map((company) => (
          <li key={company.id}>
            <strong>{company.companyCode}</strong> — {company.companyName}
            <span> ({company.sector})</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

### Fetching a single record

```typescript
// app/companies/[code]/page.tsx
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const company = await prisma.company.findUnique({
    where: { companyCode: code.toUpperCase() },
  });

  if (!company) notFound();

  return (
    <div>
      <h1>{company.companyName}</h1>
      <p>Code: {company.companyCode}</p>
      <p>Sector: {company.sector}</p>
    </div>
  );
}
```

### Parallel data fetching

Fetch independent data in parallel using `Promise.all` to avoid waterfall queries:

```typescript
export default async function DashboardPage() {
  const [companies, projects] = await Promise.all([
    prisma.company.findMany({ orderBy: { companyCode: "asc" } }),
    prisma.project.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  return (
    <div>
      <CompanyList companies={companies} />
      <RecentProjects projects={projects} />
    </div>
  );
}
```

### Caching and revalidation

By default, Server Components in the App Router cache at the request level. To revalidate data on a schedule or after a mutation:

```typescript
// In a Server Component — revalidate every 60 seconds
import { unstable_cache } from "next/cache";

const getCompanies = unstable_cache(
  async () => prisma.company.findMany({ orderBy: { companyCode: "asc" } }),
  ["companies"],
  { revalidate: 60 }
);

export default async function CompaniesPage() {
  const companies = await getCompanies();
  // ...
}
```

After a form mutation, call `revalidatePath("/companies")` in the Server Action (see section 12).

---

## 12. Forms with Server Actions + Dual Validation

The recommended pattern for forms is:
- **Client-side**: Zod validates before submission (immediate feedback, no server round-trip).
- **Server-side**: The same Zod schema re-validates inside the Server Action (guards against bypassed clients).

### The validation schema is shared

Both client and server import from `lib/validations/`:

```typescript
import { companySchema, type CompanyValidationType } from "@/lib/validations/company";
```

### Step 1 — Server Action

Create `app/companies/_actions/createCompany.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { companySchema } from "@/lib/validations/company";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type ActionResult =
  | { success: true }
  | { success: false; errors: Record<string, string[]> | string };

export async function createCompany(
  formData: FormData
): Promise<ActionResult> {
  // Parse raw FormData into a plain object
  const raw = {
    companyName: formData.get("companyName"),
    companyCode: formData.get("companyCode"),
    sector: formData.get("sector"),
  };

  // Server-side Zod validation (always runs — cannot be bypassed)
  const result = companySchema.safeParse(raw);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await prisma.company.create({ data: result.data });
    revalidatePath("/companies"); // clear the Server Component cache
    return { success: true };
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        errors: { companyCode: ["A company with this code already exists"] },
      };
    }
    return { success: false, errors: "An unexpected error occurred" };
  }
}
```

### Step 2 — Client Form Component with client-side Zod

Create `app/companies/_components/CreateCompanyForm.tsx`:

```typescript
"use client";

import { useState, useTransition } from "react";
import { companySchema } from "@/lib/validations/company";
import { COMPANY_CODES, SECTORS } from "@/src/constants/enums";
import { createCompany, type ActionResult } from "../_actions/createCompany";

export default function CreateCompanyForm() {
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    setServerError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);

    // Step 1: Client-side Zod validation for instant feedback
    const raw = {
      companyName: formData.get("companyName") as string,
      companyCode: formData.get("companyCode") as string,
      sector: formData.get("sector") as string,
    };

    const clientResult = companySchema.safeParse(raw);
    if (!clientResult.success) {
      setFieldErrors(clientResult.error.flatten().fieldErrors);
      return; // stop here — do not hit the server
    }

    // Step 2: Submit to Server Action
    startTransition(async () => {
      const result: ActionResult = await createCompany(formData);
      if (result.success) {
        setSuccess(true);
        (e.target as HTMLFormElement).reset();
      } else if (typeof result.errors === "string") {
        setServerError(result.errors);
      } else {
        setFieldErrors(result.errors);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="companyName">Company Name</label>
        <input id="companyName" name="companyName" type="text" />
        {fieldErrors.companyName && (
          <p className="text-red-500">{fieldErrors.companyName[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="companyCode">Company Code</label>
        <select id="companyCode" name="companyCode">
          <option value="">Select a code</option>
          {COMPANY_CODES.map((opt) => (
            <option key={opt.value} value={opt.label}>
              {opt.label}
            </option>
          ))}
        </select>
        {fieldErrors.companyCode && (
          <p className="text-red-500">{fieldErrors.companyCode[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="sector">Sector</label>
        <select id="sector" name="sector">
          <option value="">Select a sector</option>
          {SECTORS.map((opt) => (
            <option key={opt.value} value={opt.label}>
              {opt.label}
            </option>
          ))}
        </select>
        {fieldErrors.sector && (
          <p className="text-red-500">{fieldErrors.sector[0]}</p>
        )}
      </div>

      {serverError && <p className="text-red-600">{serverError}</p>}
      {success && <p className="text-green-600">Company created successfully.</p>}

      <button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Create Company"}
      </button>
    </form>
  );
}
```

### Step 3 — Compose in a Server Component page

```typescript
// app/companies/new/page.tsx
import CreateCompanyForm from "../_components/CreateCompanyForm";

export default function NewCompanyPage() {
  // Server Component — can also fetch data to pre-populate selects
  return (
    <main>
      <h1>Add Company</h1>
      <CreateCompanyForm />
    </main>
  );
}
```

### Validation flow summary

```
User submits form
        │
        ▼
[Client-side Zod] ──FAIL──▶ Show inline errors immediately
        │
       PASS
        │
        ▼
[Server Action] ──▶ [Server-side Zod] ──FAIL──▶ Return structured errors to client
                                │
                               PASS
                                │
                                ▼
                        [Prisma .create()]
                                │
                      ┌─────────┴──────────┐
                    SUCCESS           DB ERROR (P2002)
                      │                    │
               revalidatePath        Return 409-style error
               return { success: true }
```

---

## 13. API Routes Reference

For cases where you need a traditional REST endpoint (external consumers, webhooks, client-side `fetch`), use `app/api/` routes.

### Current endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/company` | Create a single company record |
| `GET` | `/api/company` | List all companies (ordered by `companyCode`) |

### Standard response shapes

**Success (201 Created):**
```json
{ "message": "Company record created successfully", "company": { ... } }
```

**Validation error (400):**
```json
{ "message": "Validation failed", "errors": { "companyCode": { "_errors": ["Invalid Company Code"] } } }
```

**Duplicate key (409):**
```json
{ "message": "A company with this code already exists" }
```

**Server error (500):**
```json
{ "message": "Internal server error" }
```

### Prisma error codes to handle

| Code | Meaning | HTTP status |
|---|---|---|
| `P2002` | Unique constraint violation | 409 |
| `P2025` | Record not found | 404 |
| `P2003` | Foreign key constraint failed | 400 |

---

## 14. Cloudinary File Uploads

File storage is handled through `lib/cloudinary.ts`.

### Uploading a file

```typescript
import { uploadToCloudinary } from "@/lib/cloudinary";

// fileUri can be a base64 data URI or a remote URL
const { success, result, error } = await uploadToCloudinary(fileUri, "gcp-central/documents");

if (success && result) {
  console.log(result.secure_url);  // use this URL to store in DB
  console.log(result.public_id);   // store this to delete later
}
```

### Deleting a file

```typescript
import { deleteFromCloudinary } from "@/lib/cloudinary";

const { success } = await deleteFromCloudinary(publicId);
```

### Storing file references in the DB

Add `fileUrl` and `filePublicId` string fields to your Prisma model to persist uploaded files:

```prisma
model Document {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  fileName    String
  fileUrl     String   // Cloudinary secure_url
  filePublicId String  // Cloudinary public_id (for deletion)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

## 15. Adding New Features — End-to-End Checklist

Use this checklist whenever you build a new feature.

**Schema & Database**
- Add the model to `prisma/schema.prisma`
- Run `npx prisma generate`
- Add seed data in `prisma/` if the model has lookup records
- Run `npm run db:seed` to populate

**Enums (if new select fields are needed)**
- Add a new file in `src/constants/enums/`
- Export it from `src/constants/enums/index.ts`

**Validation**
- Add a Zod schema in `lib/validations/<model>.ts`
- Export both the schema and the inferred TypeScript type
- Apply enum validators using `isValidEnumValue` or `z.enum()`

**API Route (if REST endpoint is needed)**
- Add `app/api/<model>/route.ts`
- Use `Prisma.PrismaClientKnownRequestError` for DB error handling
- Validate with `.safeParse()` — never trust raw `req.json()` output directly

**Server Component (read)**
- Query Prisma directly (no `fetch()` needed)
- Use `Promise.all` for multiple parallel queries
- Use `unstable_cache` or `revalidatePath` to manage cache

**Server Action + Form (write)**
- Create `app/<feature>/_actions/<action>.ts` with `"use server"`
- Call `revalidatePath()` after successful mutations
- In the client form component (`"use client"`), run Zod client-side first before calling the action
- Display field-level errors from `result.error.flatten().fieldErrors`

**Lint & Build**
```bash
npm run lint
npm run build
```

Both must pass with zero errors before opening a PR.

---

## 16. UI Components

Reusable components live in `src/components/ui/`. Always prefer these over writing raw HTML.

### Button

File: `src/components/ui/button.tsx`

```typescript
import Button from '@/src/components/ui/button';

// Renders a <button>
<Button variant="primary" size="lg" onClick={handleSave}>Save</Button>

// Renders a <Link> (Next.js)
<Button variant="secondary" href="/requests">View All</Button>

// Loading state
<Button variant="primary" loading={isPending}>Saving...</Button>
```

Variants: `primary` | `secondary` | `ghost` | `accent` | `danger`
Sizes: `sm` | `md` | `lg` | `xl`

All variants map directly to the `.btn` CSS classes in `globals.css`.

### Planned UI Components (TODO)

Create these in `src/components/ui/` as the project grows:
- `input.tsx` — wraps `.input` class with error state and label
- `select.tsx` — wraps `.select` class
- `badge.tsx` — wraps `.badge` and status variants
- `modal.tsx` — wraps `.modal-backdrop` + `.modal`
- `toast.tsx` — notification system
- `upload-zone.tsx` — wraps `.upload-zone` for Cloudinary uploads

---

## 17. Authentication — Structure & Roadmap

Authentication is **not yet implemented**. The structure is in place and ready to activate.

### What exists today

| File | Purpose |
|---|---|
| `src/types/auth.ts` | `CurrentUser` and `UserRole` TypeScript types |
| `src/lib/auth/get-current-user.ts` | Returns a **hardcoded mock user** — replace with real session |
| `src/lib/auth/auth.config.ts` | NextAuth config — fully commented out, ready to activate |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth API handler stub (returns 501) |
| `app/login/page.tsx` | Login UI shell — disabled, pending NextAuth wiring |

### Roles (already typed)

```typescript
// src/types/auth.ts
export type UserRole =
  | 'requestor'    // Submits requests
  | 'verifier'     // Verifies request completeness (GCP staff)
  | 'reviewer'     // Manages GCP/GCPC engagement sessions
  | 'committee'    // Main Committee — read-only dashboard access
  | 'admin';       // Full system access + role management
```

### To implement NextAuth

1. Install: `npm install next-auth@beta @auth/prisma-adapter`
2. Add env vars to `.env.local` (see `auth.config.ts` for the full list)
3. Add a `User` model to `prisma/schema.prisma` with a `role` field
4. Uncomment the NextAuth config in `src/lib/auth/auth.config.ts`
5. Replace `app/api/auth/[...nextauth]/route.ts` with the real handler
6. Update `get-current-user.ts` to read from the NextAuth session
7. Create `app/(auth)/layout.tsx` to give auth pages their own layout (no shell)

### Route protection pattern (when auth is live)

```typescript
// In any protected Server Component page:
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { redirect } from 'next/navigation';

export default async function ProtectedPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/dashboard'); // role guard
  // ...
}
```

---

## 18. Implementation Status

Use this section to track what is live, what is in progress, and what is pending.

### ✅ Implemented

| Feature | File(s) | BRD Reference |
|---|---|---|
| Design system CSS | `app/globals.css` | NFR4 |
| Design tokens (Tailwind) | `tailwind.config.ts` | NFR4 |
| Design tokens (TS) | `src/UI/theme.ts` | NFR4 |
| App shell layout | `src/components/layout/app-shell.tsx` | — |
| Header with role-based nav | `src/components/layout/header.tsx` | NFR4 |
| Footer | `src/components/layout/footer.tsx` | NFR4 |
| Home page | `app/page.tsx` | NFR4 |
| Company API (POST + GET) | `app/api/company/route.ts` | — |
| Company Zod schema | `lib/validations/company.ts` | — |
| Prisma singleton | `lib/prisma.ts` | — |
| Cloudinary helpers | `lib/cloudinary.ts` | FR2 |
| All enum constants | `src/constants/enums/` | — |
| Navigation config | `src/config/navigation.ts` | — |
| Auth types | `src/types/auth.ts` | FR17 |
| Auth structure stubs | `src/lib/auth/auth.config.ts` | FR17 |
| Button UI component | `src/components/ui/button.tsx` | — |
| MongoDB seed (companies) | `prisma/seed.mjs` | — |
| Config-driven form renderer | `src/components/forms/config-driven-fields.tsx` | FR1, FR3 |
| GCPC/RTP multi-step request workflow (base request, details, docs, submit) | `app/submit/[channel]/[code]/_components/rtp-multi-step-form.tsx`, `app/submit/[channel]/[code]/_config/rtp-form-schema.ts`, `app/submit/[channel]/[code]/_actions/rtp.ts`, `lib/validations/rtp.ts` | FR1, FR3 |
| GCPC/PBL multi-step request workflow (project selection, bidders list, docs, submit) | `app/submit/[channel]/[code]/_components/pbl-multi-step-form.tsx`, `app/submit/[channel]/[code]/_config/pbl-form-schema.ts`, `app/submit/[channel]/[code]/_actions/pbl.ts`, `lib/validations/pbl.ts` | FR1, FR3 |
| Reusable uploaded document preview UI (file icon + view action) | `src/components/forms/uploaded-document-preview.tsx` | FR2 |
| Submit form route support for RTP/PBL and submit-to-review navigation | `app/submit/[channel]/[code]/page.tsx` | FR1, FR3 |
| PBL persistence models (PblRequest, PblBidder) + projectCode support | `prisma/schema.prisma` | FR1, FR3 |

### 🚧 Stubs (structure exists, logic pending)

| Feature | File(s) | Sprint | BRD |
|---|---|---|---|
| NextAuth authentication | `src/lib/auth/auth.config.ts`, `app/api/auth/[...nextauth]/route.ts` | Pre-Sprint 1 | FR17 |
| Login page | `app/login/page.tsx` | Pre-Sprint 1 | — |
| Submit Request catalog and routing (remaining forms pending) | `app/submit/page.tsx`, `app/submit/[channel]/[code]/page.tsx` | Sprint 1 | FR1, FR3 |
| Review Requests page | `app/requests/page.tsx` | Sprint 1 | FR4, FR5 |
| Dashboard page | `app/dashboard/page.tsx` | Sprint 3 | FR18 |
| Admin page | `app/admin/page.tsx` | Sprint 3 | FR17, FR19 |

### ❌ Not yet started

| Feature | Sprint | BRD Reference |
|---|---|---|
| 11 remaining request form pages (GCPC: JVP, ST/SP, CAA, PCCA, PP, VAP, Others; GCP: R-PCCA, CI, CPR, Others) | Sprint 1 | FR1, FR3 |
| Verifier review + rework flow | Sprint 1 | FR4 |
| GCP/GCPC routing logic | Sprint 1 | FR5 |
| Engagement session scheduling | Sprint 1 | FR6, FR10 |
| Summary Review Report generation | Sprint 1 | FR7, FR11 |
| Acknowledgement letter generation | Sprint 1 | FR9 |
| Endorsement letter generation | Sprint 1 | FR13 |
| Automated notifications | Sprint 2 | FR14 |
| Timestamp tracking | Sprint 2 | FR15 |
| SLA violation flagging | Sprint 2 | FR16 |
| Role management (admin) | Sprint 3 | FR17 |
| Dashboard visualisations | Sprint 3 | FR18 |
| SLA configuration panel | Sprint 3 | FR19 |
| PDF/Excel export | Sprint 3 | FR20 |

---

## 19. RTP & PBL Implementation Details

This section documents the implemented end-to-end behavior for RTP and PBL forms.
Use it as the primary reference before adding new forms (JVP, CAA, etc.) so they follow the same architecture and quality standards.

### 19.1 Shared Architecture (Both Forms)

Both forms use the same overall pattern:

1. **Dynamic route entry**
   - `app/submit/[channel]/[code]/page.tsx`
   - Resolves form by channel/code and renders the correct form component.
2. **Client multi-step form**
   - RTP: `app/submit/[channel]/[code]/_components/rtp-multi-step-form.tsx`
   - PBL: `app/submit/[channel]/[code]/_components/pbl-multi-step-form.tsx`
3. **Config-driven field schema**
   - RTP: `app/submit/[channel]/[code]/_config/rtp-form-schema.ts`
   - PBL: `app/submit/[channel]/[code]/_config/pbl-form-schema.ts`
   - Shared renderer: `src/components/forms/config-driven-fields.tsx`
4. **Server actions**
   - RTP actions: `app/submit/[channel]/[code]/_actions/rtp.ts`
   - PBL actions: `app/submit/[channel]/[code]/_actions/pbl.ts`
5. **Zod validation layer**
   - RTP schemas: `lib/validations/rtp.ts`
   - PBL schemas: `lib/validations/pbl.ts`
6. **Shared upload + preview**
   - Upload API: `app/api/uploads/cloudinary/route.ts`
   - Reusable uploaded file card: `src/components/forms/uploaded-document-preview.tsx`
7. **Stepper UI**
   - `src/components/forms/multi-step-stepper.tsx`

### 19.2 RTP Implementation (GCPC / RTP)

**Route condition**
- Implemented when:
  - `channel = gcpc`
  - `code = RTP`

**Step flow**
1. **Basic Information**
   - Request title, category, requestor, and company are pre-filled and locked.
   - Action: `createRtpBaseRequest()`
   - Persists base `Request` with status `Draft`.
2. **Project Details**
   - Captures client name, registration type, tender date (conditional), project name, description.
   - Action: `saveRtpDetails()`
   - Upserts `RtpRequest`, creates/updates `Project`, updates request status to `Draft-Details`.
3. **Documents & Submit**
   - Upload required document.
   - Must check acknowledgement before submit.
   - Action: `submitRtpRequest()`
   - Updates `RtpRequest` document metadata and marks parent request as `New` + `submittedAt`.

**Key RTP validation rules**
- `requestType` must be `RTP`.
- `category` must match selected routing/channel.
- `tenderClosingDate` is required when registration type = Tender List.
- File type restricted to allowed office/image/pdf MIME types.
- File size max = 10MB.
- Acknowledgement is mandatory for final submission.

### 19.3 PBL Implementation (GCPC / PBL)

**Route condition**
- Implemented when:
  - `channel = gcpc`
  - `code = PBL`

**Step flow**
1. **Basic Information**
   - Request title, category, requestor are pre-filled and locked.
   - Action: `createPblBaseRequest()`
   - Persists base `Request` with status `Draft`.
2. **Project Details**
   - User selects project from DB (restricted to requestor company).
   - Project code auto-populates and is locked.
   - Company is locked.
   - Procurement method is required.
   - Action: `savePblDetails()`
   - Upserts `PblRequest`, updates request status to `Draft-Details`.
3. **Bidders List**
   - User can add multiple bidder records.
   - One PBL request maps to many bidder rows.
   - Conditional rule:
     - if bidder count `< 3` → justification required
     - if bidder count `>= 3` → justification hidden/optional
   - Action: `savePblBidders()`
   - Replaces persisted bidder rows in `PblBidder` for current request and updates status to `Draft-Bidders`.
4. **Documents & Submit**
   - Upload required document and check acknowledgement.
   - Action: `submitPblRequest()`
   - Validates bidder completeness again, stores final document metadata, marks request `New` + `submittedAt`.

**Key PBL validation rules**
- `requestType` must be `PBL`.
- Project must belong to the same company as the base request.
- Procurement method must be valid enum (`Selective Tendering` / `Direct Negotiation`).
- At least one bidder required.
- Justification required when bidders are fewer than 3.
- File type + file size constraints follow shared upload policy (same as RTP).
- Acknowledgement is mandatory for final submission.

### 19.4 Data Model Used by RTP & PBL

**Shared parent model**
- `Request` (request metadata, lifecycle status, acknowledgement, submitted timestamp).

**RTP-specific**
- `RtpRequest` (details, optional special project flag, document metadata).
- `Project` relation used for project linkage.

**PBL-specific**
- `PblRequest` (project/procurement details, justification, document metadata).
- `PblBidder` (one-to-many bidder records linked to PBL request).
- `Project.projectCode` used to auto-populate locked Project Code in Step 2.

### 19.5 Submission Outcome & Navigation

For both RTP and PBL:
- On successful final submit:
  - request status is set to `New`
  - `submittedAt` is set
  - request list cache is revalidated
  - user is redirected to review requests page: `/requests`

### 19.6 Reuse Guidance for Upcoming Forms

When building the remaining forms:
- Keep the same folder pattern under `app/submit/[channel]/[code]/`.
- Use config-driven fields for maintainability and consistency.
- Keep client and server Zod validation aligned.
- Reuse shared document upload + preview component instead of duplicating upload UI.
- Preserve status progression pattern (`Draft` → intermediate draft status → `New` on submit).

---

## Quick Reference Commands

```bash
# Start development server
npm run dev

# Type-check and lint
npm run lint
npm run build

# Regenerate Prisma client after schema change
npx prisma generate

# Seed the database
npm run db:seed

# Open Prisma Studio (visual DB browser)
npx prisma studio
```
