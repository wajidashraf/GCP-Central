# SharePoint as Database — Migration Feasibility & Implementation Guide

> **Scope:** This document covers whether GCP Central can be migrated from MongoDB + Cloudinary to SharePoint Lists (structured records) + SharePoint Document Libraries (files and images), what the technical requirements are, and what code changes are required across the application.

---

## Table of Contents

1. [Is It Possible?](#1-is-it-possible)
2. [Architecture Comparison](#2-architecture-comparison)
3. [SharePoint Concepts Used](#3-sharepoint-concepts-used)
4. [Prerequisites & Requirements](#4-prerequisites--requirements)
5. [New Environment Variables](#5-new-environment-variables)
6. [Data Layer — Replacing Prisma + MongoDB](#6-data-layer--replacing-prisma--mongodb)
7. [File Storage — Replacing Cloudinary](#7-file-storage--replacing-cloudinary)
8. [Authentication — Migrating Credentials to Entra ID (AAD)](#8-authentication--migrating-credentials-to-entra-id-aad)
9. [Email — Replacing Nodemailer with Graph API / Exchange](#9-email--replacing-nodemailer-with-graph-api--exchange)
10. [Per-File Code Changes Summary](#10-per-file-code-changes-summary)
11. [Data Migration (Existing Records)](#11-data-migration-existing-records)
12. [Limitations & Risks](#12-limitations--risks)
13. [Recommended Migration Path](#13-recommended-migration-path)

---

## 1. Is It Possible?

**Yes — but with significant effort and trade-offs.**

SharePoint Lists can store structured relational-style records (rows + columns) via the Microsoft Graph API. SharePoint Document Libraries can store files and images. Together they can replace MongoDB (records) and Cloudinary (files), but SharePoint is **not** a database — it is a document management and collaboration platform. The following rules apply:

| Capability | MongoDB + Prisma | SharePoint Lists |
|---|---|---|
| Typed schema | Prisma schema | Defined at List column level; no compile-time types natively |
| Relational lookups | `$lookup` / `include` | Lookup columns; limited joins via multiple Graph API calls |
| Unique constraints | Unique indexes | Not enforced by default; must check client-side |
| Transactions | Yes (`$transaction`) | No multi-item transactions in Graph API |
| Complex queries (AND/OR/range) | Full Prisma/Mongo API | OData `$filter` — limited expressiveness |
| Auto-increment IDs | ObjectId | No; use GUID or `ID` (int) provided by SharePoint |
| Row limit per List | N/A | **5,000-item view threshold** (items can be more, but queries get throttled) |
| Throughput | High | Throttled; Graph API has per-app/per-tenant rate limits |
| JSON columns | Yes | Not natively; store as text and `JSON.parse` |
| Full-text search | Atlas Search | SharePoint search API |

---

## 2. Architecture Comparison

### Current Architecture

```
Browser / Server Components
      │
      ▼
Next.js App (app router, server components, server actions)
      │
      ├── Prisma Client ──────► MongoDB Atlas  (structured data)
      ├── Cloudinary SDK ─────► Cloudinary CDN  (files, images)
      ├── Nodemailer ─────────► SMTP / Gmail  (email)
      └── NextAuth v5 ────────► JWT sessions + bcrypt (auth)
```

### Target Architecture (SharePoint)

```
Browser / Server Components
      │
      ▼
Next.js App (app router, server components, server actions)
      │
      ├── @microsoft/microsoft-graph-client ──► SharePoint Lists  (structured data)
      ├── @microsoft/microsoft-graph-client ──► SharePoint Document Library (files)
      ├── @microsoft/microsoft-graph-client ──► Microsoft 365 Mail / Exchange (email)
      └── next-auth (Microsoft Entra ID provider) ─► Entra ID / AAD (auth)
```

---

## 3. SharePoint Concepts Used

| App Concept | SharePoint Equivalent |
|---|---|
| MongoDB Collection / Prisma Model | **SharePoint List** |
| Document record (subdocuments) | **SharePoint List Item** (JSON or separate List) |
| Relationship (foreign key) | **Lookup Column** (by item ID) |
| File / Image upload | **Document Library** folder |
| `publicId` / CDN URL | SharePoint `DriveItem` ID + `/sites/{site}/drive/items/{id}/content` URL |
| User record + password | **Entra ID (Azure AD) User** + MSAL token |
| Email | **Microsoft Graph** `sendMail` or Exchange |

---

## 4. Prerequisites & Requirements

### 4.1 Microsoft 365 Tenant & SharePoint Online

- An active **Microsoft 365 tenant** (Business or Enterprise plan that includes SharePoint Online).
- A **SharePoint Site** (e.g., `https://yourtenant.sharepoint.com/sites/GCPCentral`) to host all Lists and Document Libraries.
- The site collection owner must create the Lists and columns (see section 6).

### 4.2 Azure App Registration (Entra ID)

You need to register an **Azure AD Application** to allow the Next.js server to call Microsoft Graph:

1. Go to [Azure Portal → App Registrations → New Registration](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade).
2. Set **Redirect URI** (type: Web) to `https://yourapp.com/api/auth/callback/azure-ad`.
3. Under **API Permissions** (Application permissions — for server-to-server data access):
   - `Sites.ReadWrite.All` — read/write SharePoint Lists and Document Libraries
   - `Files.ReadWrite.All` — upload/download files
   - `Mail.Send` — send email via Graph (if replacing Nodemailer)
   - `User.Read.All` — read user details for authentication (if using app-only auth)
4. Create a **Client Secret** (or use certificate for production).
5. Note: `Tenant ID`, `Client ID`, `Client Secret`.

> **Delegated vs Application permissions:** If users sign in with Entra ID (recommended), use **delegated** permissions and act on behalf of the signed-in user. If the server acts in the background (e.g., cron, server actions without user context), use **application** permissions with client credentials flow.

### 4.3 Node.js / NPM Packages to Install

```bash
npm install @microsoft/microsoft-graph-client @azure/msal-node @azure/identity
npm install @auth/core  # already present via next-auth
```

Remove packages that are no longer needed after migration:

```bash
npm uninstall @prisma/client prisma bcryptjs cloudinary mongoose
```

### 4.4 SharePoint Site Structure to Create

Create the following Lists and one Document Library on your SharePoint site before running the app:

| Name | Type | Notes |
|---|---|---|
| `Roles` | List | Columns: `slug` (text), `name` (text) |
| `Users` | List | Columns: `name`, `email`, `emailLower`, `username`, `usernameLower`, `entraId` (text), `primaryRole` (text), `roles` (multi-select or text JSON), `companyId` (Lookup → Companies), `isActive` (boolean) |
| `Companies` | List | Columns: `companyName`, `companyCode` (unique), `sector` |
| `Requests` | List | All Request columns mapped (see section 6.2) |
| `RtpRequests` | List | Per-type subdocument columns |
| `PblRequests` | List | Per-type subdocument columns |
| `JvpRequests`, `StspRequests`, `CaaRequests`, `PccaRequests`, `PpRequests`, `VapRequests`, `OtherRequests`, `RppRequests` | Lists | Per-type subdocument columns |
| `PblBidders` | List | Child items for PBL |
| `Projects` | List | `projectName`, `projectCode`, `projectStatus`, `companyId`, `createdFromRequestId` |
| `EngagementSlots` | List | Columns for slots |
| `Engagements` | List | Linked to Requests + Slots |
| `SignatoryMembers` | List | Directory |
| `RequestSignatures` | List | Per-request per-member |
| `VerifierComments` | List | One per request |
| `ReviewerSuggestions` | List | Many per request |
| `GCPDocuments` | **Document Library** | All uploaded files (subfolders by request type + ID) |

---

## 5. New Environment Variables

Replace the existing MongoDB / Cloudinary variables with these in `.env.local`:

```env
# --- SharePoint / Microsoft Graph ---
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret

# The root URL of your SharePoint site
SHAREPOINT_SITE_URL=https://yourtenant.sharepoint.com/sites/GCPCentral
# Site ID (GUID) — get this from: GET https://graph.microsoft.com/v1.0/sites/yourtenant.sharepoint.com:/sites/GCPCentral
SHAREPOINT_SITE_ID=your-site-guid

# Document Library drive ID (get from Graph: GET /sites/{siteId}/drives)
SHAREPOINT_DRIVE_ID=your-drive-guid

# --- NextAuth / Entra ID ---
AUTH_SECRET=your-nextauth-secret
AZURE_AD_CLIENT_ID=your-client-id        # same as AZURE_CLIENT_ID above
AZURE_AD_CLIENT_SECRET=your-client-secret
AZURE_AD_TENANT_ID=your-tenant-id

# --- App URL ---
NEXT_PUBLIC_APP_URL=https://yourapp.com

# --- Email (Graph) ---
GRAPH_MAIL_FROM=noreply@yourtenant.onmicrosoft.com
EMAIL_FROM_NAME=GCP Central
```

**Remove:** `MONGODB_URI`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_SERVICE`, `EMAIL_HOST`, `EMAIL_PORT`

---

## 6. Data Layer — Replacing Prisma + MongoDB

### 6.1 Create a Graph API Client

**New file:** `lib/graph.ts`

```typescript
import "server-only";
import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from
  "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";

let _client: Client | null = null;

export function getGraphClient(): Client {
  if (_client) return _client;
  const credential = new ClientSecretCredential(
    process.env.AZURE_TENANT_ID!,
    process.env.AZURE_CLIENT_ID!,
    process.env.AZURE_CLIENT_SECRET!
  );
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });
  _client = Client.initWithMiddleware({ authProvider });
  return _client;
}

export const SITE_ID = process.env.SHAREPOINT_SITE_ID!;
export const DRIVE_ID = process.env.SHAREPOINT_DRIVE_ID!;
```

### 6.2 Replace `lib/prisma.ts` with a SharePoint data access layer

**New file:** `lib/sharepoint/lists.ts`

```typescript
import "server-only";
import { getGraphClient, SITE_ID } from "@/lib/graph";

/**
 * Get all items from a SharePoint List with optional OData $filter/$select/$expand.
 */
export async function listItems<T = Record<string, unknown>>(
  listName: string,
  options: { filter?: string; select?: string; expand?: string } = {}
): Promise<T[]> {
  const client = getGraphClient();
  const params = new URLSearchParams();
  if (options.filter)  params.set("$filter",  options.filter);
  if (options.select)  params.set("$select",  options.select);
  if (options.expand)  params.set("$expand",  options.expand);
  const qs = params.toString();
  const url = `/sites/${SITE_ID}/lists/${listName}/items?${qs}&$expand=fields`;
  const res = await client.api(url).get();
  return (res.value as Array<{ fields: T }>).map((item) => item.fields);
}

/**
 * Create an item in a SharePoint List.
 */
export async function createItem<T = Record<string, unknown>>(
  listName: string,
  fields: Record<string, unknown>
): Promise<T> {
  const client = getGraphClient();
  const res = await client.api(`/sites/${SITE_ID}/lists/${listName}/items`).post({ fields });
  return res.fields as T;
}

/**
 * Update an item in a SharePoint List by SharePoint item ID.
 */
export async function updateItem(
  listName: string,
  itemId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const client = getGraphClient();
  await client.api(`/sites/${SITE_ID}/lists/${listName}/items/${itemId}/fields`).patch(fields);
}

/**
 * Delete an item from a SharePoint List.
 */
export async function deleteItem(listName: string, itemId: string): Promise<void> {
  const client = getGraphClient();
  await client.api(`/sites/${SITE_ID}/lists/${listName}/items/${itemId}`).delete();
}
```

### 6.3 Example: Replace a Prisma call

**Before (MongoDB/Prisma):**

```typescript
import prisma from "@/lib/prisma";

const users = await prisma.user.findMany({
  where: { isActive: true },
  orderBy: { usernameLower: "asc" },
});
```

**After (SharePoint Graph):**

```typescript
import { listItems } from "@/lib/sharepoint/lists";

const users = await listItems("Users", {
  filter: "fields/isActive eq true",
  select: "fields/id,fields/name,fields/email,fields/username,fields/primaryRole,fields/roles",
});
// Sort manually if OData $orderby not available
users.sort((a, b) => a.usernameLower.localeCompare(b.usernameLower));
```

### 6.4 Mapping of Current Prisma Models → SharePoint Lists

| Prisma Model | SharePoint List Name | Key Notes |
|---|---|---|
| `User` | `Users` | Remove `passwordHash`; identity moves to Entra ID. Store `entraId` (Object ID from AAD). |
| `Role` | `Roles` | Simple lookup list |
| `Company` | `Companies` | `companyCode` must be enforced unique in app logic |
| `Request` | `Requests` | JSON columns (`reviewerCommentList`, `reviewerCommentTable`) stored as multi-line text; parse on read |
| `RtpRequest` | `RtpRequests` | `requestId` becomes a Lookup column → `Requests` |
| `PblRequest` | `PblRequests` | Same pattern |
| *…all other request types…* | *matching List names* | Same pattern |
| `PblBidder` | `PblBidders` | Child of `PblRequests` via Lookup |
| `Project` | `Projects` | — |
| `EngagementSlot` | `EngagementSlots` | `attendees[]` stored as JSON text or multi-value field |
| `Engagement` | `Engagements` | — |
| `SignatoryMember` | `SignatoryMembers` | — |
| `RequestSignature` | `RequestSignatures` | — |
| `VerifierComment` | `VerifierComments` | — |
| `ReviewerSuggestion` | `ReviewerSuggestions` | — |

### 6.5 ID Strategy

SharePoint auto-assigns an integer `ID` to each item. This does **not** replace ObjectId. You have two options:

1. **Use SharePoint integer IDs** — simplest; requires updating all type definitions.
2. **Add a `customId` text column** — generate a UUID on creation and store it. Enables compatibility with existing URL patterns (`/requests/[id]`).

**Recommended:** Option 2 for minimum URL/routing disruption.

### 6.6 Remove Prisma

- Delete `prisma/` directory and `prisma/schema.prisma`.
- Remove `@prisma/client` and `prisma` from `package.json`.
- Remove `lib/prisma.ts`.
- Remove `predev`/`prebuild` scripts (`prisma generate`).
- Remove `prisma db seed` script; replace with a Graph-based seed script.

---

## 7. File Storage — Replacing Cloudinary

### 7.1 Upload to SharePoint Document Library

**New file:** `lib/sharepoint/files.ts`

```typescript
import "server-only";
import { getGraphClient, SITE_ID, DRIVE_ID } from "@/lib/graph";

/**
 * Upload a file buffer to SharePoint Document Library.
 * Returns { id, webUrl, name }
 */
export async function uploadFile(
  folder: string,
  filename: string,
  buffer: Buffer,
  mimeType: string
): Promise<{ id: string; webUrl: string; name: string }> {
  const client = getGraphClient();
  const path = encodeURIComponent(`${folder}/${filename}`);
  const res = await client
    .api(`/drives/${DRIVE_ID}/root:/${path}:/content`)
    .header("Content-Type", mimeType)
    .put(buffer);
  return { id: res.id, webUrl: res.webUrl, name: res.name };
}

/**
 * Delete a file by its SharePoint DriveItem ID.
 */
export async function deleteFile(fileId: string): Promise<void> {
  const client = getGraphClient();
  await client.api(`/drives/${DRIVE_ID}/items/${fileId}`).delete();
}

/**
 * Get a short-lived download URL for a file.
 */
export async function getDownloadUrl(fileId: string): Promise<string> {
  const client = getGraphClient();
  const res = await client
    .api(`/drives/${DRIVE_ID}/items/${fileId}`)
    .select("@microsoft.graph.downloadUrl")
    .get();
  return res["@microsoft.graph.downloadUrl"] as string;
}
```

### 7.2 Replace the Cloudinary Upload API Route

**Current:** `app/api/uploads/cloudinary/route.ts` — receives multipart file, calls `uploadToCloudinary`.

**New:** `app/api/uploads/sharepoint/route.ts`

```typescript
import { uploadFile } from "@/lib/sharepoint/files";
// ... receive FormData, extract file Buffer, call uploadFile(folder, filename, buffer, mime)
// Return: { documentUrl: res.webUrl, documentId: res.id, ... }
```

**DB fields to rename:**

| Old | New |
|---|---|
| `documentPublicId` | `documentSharePointId` (store DriveItem ID) |
| `documentUrl` | `documentUrl` (store `webUrl`, no change in name) |

### 7.3 Replace the Cloudinary Delete API Route

**Current:** `app/api/uploads/cloudinary/route.ts` DELETE method — calls `deleteFromCloudinary(publicId)`.

**New:** call `deleteFile(sharePointId)` using the stored DriveItem ID.

### 7.4 Signature Images

**Current:** `app/api/uploads/cloudinary-signature/route.ts` — uploads base64 data URI.

**New:** convert base64 to `Buffer`, call `uploadFile("signatures", ...)`, store result ID + URL.

### 7.5 Update All Components That Reference `documentPublicId`

All client-side components (submit forms, upload preview, sign modal) that pass `publicId` for delete/replace must switch to passing `documentSharePointId`.

---

## 8. Authentication — Migrating Credentials to Entra ID (AAD)

### 8.1 Current Setup

- **Credentials provider** (username/email + bcrypt password stored in MongoDB).
- `passwordHash` in `User` model.
- JWT session with `role`, `roles`, `companyId`, `companyCode`, `companyName`.

### 8.2 SharePoint-compatible Auth

Microsoft 365 manages identity. Use **Entra ID (Azure AD) OAuth** via NextAuth:

**New `src/lib/auth/auth.config.ts`:**

```typescript
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

export const authConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        // Look up user record in SharePoint Users list by entraId
        // Attach role / roles / companyId to token
        token.entraId = profile?.sub;
        // ... fetch from SharePoint Users list ...
      }
      return token;
    },
    async session({ session, token }) {
      // attach roles to session.user
      return session;
    },
  },
  pages: { signIn: "/login" },
};
```

### 8.3 Password Management

- **Remove:** `bcryptjs` package, `passwordHash` column, all `hash()` / `compare()` calls.
- **Remove:** `app/admin/roles/actions.ts` — `createUserWithRolesAction` password fields.
- **Replace:** Create users in Entra ID using Graph API (`POST /users`) with a temporary password and `forceChangePasswordNextSignIn: true`.
  - Required Graph permission: `User.ReadWrite.All`.

**New user creation flow (admin):**

```typescript
import { getGraphClient } from "@/lib/graph";

async function createEntraUser(name: string, email: string, tempPassword: string) {
  const client = getGraphClient();
  await client.api("/users").post({
    displayName: name,
    mailNickname: email.split("@")[0],
    userPrincipalName: email,
    passwordProfile: { password: tempPassword, forceChangePasswordNextSignIn: true },
    accountEnabled: true,
  });
}
```

### 8.4 Login Page

- Replace the current username/password login form with a **"Sign in with Microsoft"** button.
- Redirect to `/api/auth/signin?callbackUrl=/dashboard`.

---

## 9. Email — Replacing Nodemailer with Graph API / Exchange

### 9.1 Send Email via Microsoft Graph

**New file:** `lib/email/graph-email.ts`

```typescript
import "server-only";
import { getGraphClient } from "@/lib/graph";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  const client = getGraphClient();
  const toAddresses = (Array.isArray(to) ? to : [to]).map((address) => ({
    emailAddress: { address },
  }));

  await client.api(`/users/${process.env.GRAPH_MAIL_FROM}/sendMail`).post({
    message: {
      subject,
      body: { contentType: "HTML", content: html },
      toRecipients: toAddresses,
    },
    saveToSentItems: false,
  });
}
```

### 9.2 Update All Call Sites

Replace every `import { sendEmail } from "@/lib/email/email-service"` with the new Graph-based `sendEmail` from `@/lib/email/graph-email`. The function signature is compatible.

### 9.3 Remove

- `lib/email/email-service.ts`
- `nodemailer` and `@types/nodemailer` packages
- All `EMAIL_SERVICE`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD` env vars

---

## 10. Per-File Code Changes Summary

| File | Change Required |
|---|---|
| `lib/prisma.ts` | **Delete** — replace with `lib/graph.ts` + `lib/sharepoint/lists.ts` |
| `prisma/schema.prisma` | **Delete** — schema lives in SharePoint column definitions |
| `prisma/seed.mjs` | **Replace** with a Graph-API seed script |
| `lib/cloudinary.ts` | **Delete** — replace with `lib/sharepoint/files.ts` |
| `lib/email/email-service.ts` | **Delete** — replace with `lib/email/graph-email.ts` |
| `lib/env.ts` | Remove Cloudinary/SMTP/MongoDB vars; add `AZURE_TENANT_ID`, `SHAREPOINT_SITE_ID`, etc. |
| `src/lib/auth/auth.config.ts` | Remove Credentials provider; add Entra ID provider; remove bcrypt |
| `app/login/login-form.tsx` | Replace username/password form with "Sign in with Microsoft" button |
| `app/api/auth/[...nextauth]/route.ts` | No structural change; auth config drives it |
| `app/api/uploads/cloudinary/route.ts` | **Replace** with `app/api/uploads/sharepoint/route.ts` |
| `app/api/uploads/cloudinary-signature/route.ts` | **Replace** — same pattern, different folder |
| `app/admin/roles/actions.ts` | Replace all Prisma calls; remove bcrypt; replace user creation with Graph `/users` |
| `app/admin/roles/page.tsx` | Replace all Prisma calls with `listItems("Users", ...)` |
| `app/requests/page.tsx` | Replace Prisma calls; rewrite OData filter for project/company/status |
| `app/requests/[id]/page.tsx` | Replace Prisma calls with Graph item lookup by custom ID |
| `app/submit/*/_actions/*.ts` (12 files) | Replace Prisma `create` with `createItem("Requests", ...)` + sub-type list |
| `src/components/requests/filterbar.tsx` | No change needed — pure UI |
| All API routes under `app/api/requests/` | Replace Prisma with `updateItem()` calls |
| `app/api/admin/**` | Replace Prisma with SharePoint List calls |
| `lib/email/request-notifications.ts` | Replace `sendEmail` import; replace Prisma user lookup |
| `lib/request-no.ts` | Replace Prisma count-based logic; use `listItems` with `$orderby=ID desc&$top=1` |
| `src/lib/auth/get-current-user.ts` | Replace Prisma user lookup with `listItems("Users", { filter: "fields/entraId eq '...'" })` |
| `src/lib/auth/has-role.ts` | No change — pure logic |
| All submit form components | Update `documentPublicId` → `documentSharePointId` references |

---

## 11. Data Migration (Existing Records)

If you have existing data in MongoDB that must be carried over:

### 11.1 Step-by-step

1. **Export MongoDB:** Use `mongoexport` or a Prisma script to dump each collection to JSON.
2. **Transform IDs:** Map MongoDB ObjectId strings to new UUID-style `customId` values (or keep them as-is stored in a text column).
3. **Create SharePoint Lists** with the column structure from section 4.4.
4. **Batch-import via Graph API** using `POST /sites/{siteId}/lists/{listId}/items` in batches (SharePoint Graph batching supports up to 20 requests per `$batch` call).
5. **Migrate files:** Download each file from Cloudinary using its stored URL, then re-upload to SharePoint Document Library using `uploadFile()`.
6. **Update URL references:** After upload, update `documentUrl` and `documentSharePointId` fields in the newly created List items.
7. **Verify** record counts and spot-check 5–10 records per List.

### 11.2 Rate Limits During Migration

- SharePoint throttles large batch writes (HTTP 429). Use exponential back-off with `Retry-After` header.
- Cloudinary download + SharePoint upload for each file can be slow for large datasets. Run migration off-peak hours.

---

## 12. Limitations & Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **No transactions** | If a `Request` create succeeds but the sub-type (`RtpRequest`) create fails, data is inconsistent | Implement a compensating rollback function; or use a single "wide" List for each request type |
| **5,000-item view threshold** | Queries against Lists with >5,000 items may be throttled or fail without a proper index column | Create indexed columns (SharePoint column index) on lookup/filter fields (`status`, `companyName`, `requestorId`) |
| **OData filter expressiveness** | Complex queries (nested OR/AND with multi-field joins) are hard to express | Fetch broader results and filter in Node.js (less efficient) |
| **No compile-time schema** | Loss of Prisma type safety | Write manual TypeScript types that mirror SharePoint column definitions |
| **Latency** | Graph API round-trips are slower than direct MongoDB queries | Add `React.cache` / Next.js `unstable_cache` for frequently-read reference data (Roles, Companies) |
| **Auth change** | All existing users have bcrypt passwords; switching to Entra ID requires re-provisioning accounts | Coordinate with all users; provide a migration window |
| **Licensing cost** | SharePoint Online requires M365 licences for all users who access data | Confirm licence coverage for all users |
| **Read-only public access** | SharePoint Online does not support anonymous read without extra config | If requests must be publicly accessible (e.g., submission forms by non-M365 users), keep a hybrid approach |

---

## 13. Recommended Migration Path

Given the complexity, a **phased hybrid approach** is recommended rather than a big-bang rewrite:

### Phase 1 — Auth only (2–3 weeks)

- Add Entra ID as a **second auth provider** alongside Credentials.
- New users created via Graph; existing users keep bcrypt passwords temporarily.
- Store both `passwordHash` (legacy) and `entraId` (new) on the User record in MongoDB.

### Phase 2 — File storage (1–2 weeks)

- Add `app/api/uploads/sharepoint/route.ts` alongside the Cloudinary route.
- New file uploads go to SharePoint; existing `documentUrl` links continue to point to Cloudinary.
- Migrate old files in a background script.

### Phase 3 — Email (1 week)

- Swap `sendEmail` to the Graph-based implementation.
- Keep Nodemailer as fallback for local dev if Graph credentials are not available.

### Phase 4 — Data layer (6–10 weeks)

- Build `lib/sharepoint/lists.ts` helpers.
- Migrate one model at a time starting with read-heavy, simple ones (`Roles`, `Companies`, `SignatoryMembers`).
- Migrate `Requests` + sub-types last (highest complexity).
- Remove Prisma only after all models are migrated and verified.

### Phase 5 — Remove legacy deps

- Remove MongoDB, Prisma, Cloudinary, Nodemailer, bcryptjs.
- Clean up environment variables.

---

*Last updated: May 2026*
*Author: GCP Central Dev Team*
