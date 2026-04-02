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

---

## 1. Project Overview

**GCP Central** is a procurement and governance management platform built with Next.js 16 App Router. It manages companies, projects, requests, and procurement workflows for a group of related entities. Data lives in MongoDB Atlas, accessed through Prisma ORM, with Zod for runtime validation and Cloudinary for file/image storage.

---

## 2. Folder Structure

```
gcp-central/
├── app/                        # Next.js App Router
│   ├── api/                    # REST API route handlers
│   │   └── company/route.ts    # Company CRUD endpoints
│   ├── layout.tsx              # Root layout (fonts, metadata)
│   └── page.tsx                # Homepage
│
├── lib/                        # Shared server-side utilities
│   ├── prisma.ts               # Singleton Prisma client
│   ├── db.ts                   # Mongoose connection helper (legacy/parallel)
│   ├── env.ts                  # Typed environment variable config
│   ├── cloudinary.ts           # Cloudinary upload/delete helpers
│   ├── constants.ts            # App-wide constants (HTTP codes, API paths)
│   ├── utils.ts                # Generic utility functions
│   └── validations/            # Zod schema definitions (one file per model)
│       └── company.ts
│
├── src/
│   └── constants/
│       └── enums/              # All enum constants (selects, dropdowns, types)
│           ├── index.ts        # Barrel export — always import from here
│           ├── types.ts        # SelectOption<T> and helper types
│           ├── companyCodes.ts # 16 company codes
│           ├── sectors.ts      # 7 business sectors
│           ├── organizational.ts # Roles, decision codes
│           ├── status.ts       # Engagement, project, SLA statuses
│           ├── procurement.ts  # Procurement methods, registration, categories
│           ├── requestStatus.ts # 20-state request workflow
│           ├── matters.ts      # 14 matter types, 9 outcomes
│           ├── soaCodes.ts     # 14 SOA codes
│           └── utils.ts        # Enum helper functions
│
├── prisma/
│   ├── schema.prisma           # Prisma data models
│   ├── seed.mjs                # Idempotent seed script
│   └── company-records.json   # Canonical company seed data
│
├── public/                     # Static assets
├── lib/env.ts                  # Typed env config
├── .env.local                  # Local secrets (not committed)
├── package.json
├── tsconfig.json
└── DEVELOPER_GUIDE.md          # This file
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
| Styling | Tailwind CSS 4 | Utility-first CSS |
| Language | TypeScript 5 (strict) | Type safety throughout |

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
