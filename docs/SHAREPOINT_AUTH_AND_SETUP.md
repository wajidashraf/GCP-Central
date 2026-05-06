# SharePoint Integration — Authentication Architecture & Setup Guide

> ⚠️ **If you shared your Client Secret anywhere (chat, email, docs):** Regenerate it immediately in  
> Azure Portal → App Registrations → your app → Certificates & secrets → delete old → New client secret.

---

## Table of Contents

1. [Your Current App Registration Status](#1-your-current-app-registration-status)
2. [Missing Permissions & What to Fix](#2-missing-permissions--what-to-fix)
3. [Authentication Architecture Decision](#3-authentication-architecture-decision)
4. [How Authentication Works — Step by Step](#4-how-authentication-works--step-by-step)
5. [Environment Variables for Your App](#5-environment-variables-for-your-app)
6. [Exact Azure Portal Steps to Complete Setup](#6-exact-azure-portal-steps-to-complete-setup)
7. [Code: Graph Client Using Your Credentials](#7-code-graph-client-using-your-credentials)
8. [Code: Authentication Flow (NextAuth)](#8-code-authentication-flow-nextauth)
9. [SharePoint Site Setup](#9-sharepoint-site-setup)
10. [Testing the Connection](#10-testing-the-connection)

---

## 1. Your Current App Registration Status

| Item | Value | Status |
|---|---|---|
| Client ID | `c64c8fa1-5602-4b6b-b45e-e2f312ac6e18` | ✅ Registered |
| Tenant ID | `d6d261ac-ed7f-452b-8e1e-49890c9c58d7` | ✅ Registered |
| Client Secret | *(regenerate — see warning above)* | ⚠️ Regenerate |
| `Files.ReadWrite.All` | Application permission | ✅ Set |
| `Lists.ReadWrite.All` | Application permission | ✅ Set |
| `Mail.Send` | Application permission | ✅ Set |
| `User.Read` | Delegated permission | ✅ Set (but see note below) |
| `User.Read.All` | Application permission | ✅ Set |
| **Admin consent granted** | Required for all Application permissions | ❓ Verify |
| `Sites.ReadWrite.All` | Application permission | ❌ Missing — need to add |

---

## 2. Missing Permissions & What to Fix

### 2.1 Add `Sites.ReadWrite.All`

`Lists.ReadWrite.All` covers reading/writing list **items**, but you also need `Sites.ReadWrite.All` to:
- Read site metadata (to get the site ID and drive ID)
- Access Document Libraries
- Create, update, and manage lists programmatically

**How to add:**

1. Azure Portal → **App registrations** → your app → **API permissions**
2. Click **Add a permission** → **Microsoft Graph** → **Application permissions**
3. Search `Sites.ReadWrite.All` → check it → **Add permissions**
4. Click **Grant admin consent for [your tenant]** → Confirm

### 2.2 Grant Admin Consent for ALL Application Permissions

Application permissions (anything used server-to-server without a logged-in user) **require admin consent**. Without this, every API call returns `401 Unauthorized`.

Check: In **API permissions**, each permission should show a green tick under **Status** column saying  
**"Granted for [Tenant Name]"**

If any show **"Not granted"** → click **Grant admin consent for [Tenant Name]** at the top of the permissions page.

**Permissions that need admin consent (all Application type):**

| Permission | Type | Purpose |
|---|---|---|
| `Sites.ReadWrite.All` | Application | Read/write SharePoint sites, lists, items |
| `Lists.ReadWrite.All` | Application | Read/write SharePoint list items |
| `Files.ReadWrite.All` | Application | Upload/download files in Document Libraries |
| `Mail.Send` | Application | Send emails on behalf of a mailbox |
| `User.Read.All` | Application | Read user profiles from Entra ID directory |

### 2.3 About `User.Read` (Delegated)

`User.Read` is a **delegated** permission (works only when a user is signed in). Since GCP Central uses a server-side credentials flow (not Microsoft SSO login for all users), this delegated permission will not be used by the server. It is not harmful to keep it, but it will not be exercised.

**Recommendation:** Keep it if you plan to eventually add Microsoft SSO login for some users. Remove it if you want a minimal, clean permission set.

---

## 3. Authentication Architecture Decision

### The Problem

GCP Central serves **multiple types of users** — internal GCPC staff, requestors from external companies, reviewers, HOCs, etc. Not all of these users will have a Microsoft 365 account in your tenant.

This means **you cannot switch purely to Entra ID (SSO) for all users** — external users would be locked out.

### The Recommended Approach: Hybrid

```
┌─────────────────────────────────────────────────────────────────┐
│                      Two Layers of Auth                         │
│                                                                 │
│  Layer 1: END-USER AUTH (how users log in to GCP Central)       │
│  ─────────────────────────────────────────────────────────      │
│  Keep current: Username + Password                              │
│  Store: User records in SharePoint Users list                   │
│  Passwords: Still bcrypt-hashed, stored in the list item        │
│  Session: JWT (same as today via NextAuth Credentials)          │
│                                                                 │
│  Layer 2: SERVER-TO-SHAREPOINT AUTH (how the app reads/writes)  │
│  ─────────────────────────────────────────────────────────      │
│  Use: Client Credentials (App-Only) flow                        │
│  Your Azure App → gets token → calls Graph API                  │
│  No user involved at this layer — purely machine-to-machine     │
└─────────────────────────────────────────────────────────────────┘
```

**Why this is the right choice:**

| Factor | Entra ID SSO for all users | Hybrid (recommended) |
|---|---|---|
| External company users (requestors) | ❌ Need M365 guest accounts | ✅ Works with any email |
| Internal staff | ✅ Works | ✅ Works |
| Migration effort | Very high | Moderate |
| Existing user/password data | Must be discarded | Can migrate to new list |
| App behaviour change for users | Big change (login screen) | Minimal (same login form) |

---

## 4. How Authentication Works — Step by Step

### 4.1 End-User Login (unchanged for users)

```
User enters username + password on /login
        │
        ▼
NextAuth Credentials provider (same as today)
        │
        ▼
Server looks up user in SharePoint Users list
  → GET /sites/{siteId}/lists/Users/items?$filter=fields/usernameLower eq '{username}'
        │
        ▼
bcryptjs.compare(password, item.fields.passwordHash)
        │
        ▼
If match → create JWT with id, name, roles, companyId
        │
        ▼
User is logged in — session cookie set
```

**Key change:** Instead of `prisma.user.findFirst(...)`, the lookup calls the SharePoint Graph API. Everything else (JWT, session cookie, role checks) stays identical.

### 4.2 Server → SharePoint Access (new, invisible to users)

```
Next.js server action or API route needs data
        │
        ▼
getGraphClient() — called once, singleton
        │
        ▼
@azure/identity ClientSecretCredential
  (AZURE_TENANT_ID + AZURE_CLIENT_ID + AZURE_CLIENT_SECRET)
        │
        ▼
OAuth 2.0 Client Credentials flow
  POST https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token
  grant_type=client_credentials
  scope=https://graph.microsoft.com/.default
        │
        ▼
Access token received (valid 1 hour, auto-refreshed by SDK)
        │
        ▼
Graph API call:
  GET  /sites/{siteId}/lists/Requests/items
  POST /sites/{siteId}/lists/Requests/items
  PATCH /drives/{driveId}/items/{fileId}
  etc.
```

**Token is never exposed to the browser.** It lives only on the server (server actions and API routes are always server-side in Next.js).

### 4.3 What Replaces What

| Current | New |
|---|---|
| `prisma.user.findFirst(...)` | `listItems("Users", { filter: "fields/emailLower eq '...'" })` |
| `prisma.request.findMany(...)` | `listItems("Requests", { filter: "...", select: "..." })` |
| `prisma.request.create(...)` | `createItem("Requests", { ...fields })` |
| `prisma.request.update(...)` | `updateItem("Requests", itemId, { ...fields })` |
| `uploadToCloudinary(...)` | `uploadFile(folder, filename, buffer, mime)` |
| `deleteFromCloudinary(publicId)` | `deleteFile(sharePointFileId)` |
| `sendEmail(...)` via Nodemailer | `sendEmail(...)` via Graph `sendMail` |

---

## 5. Environment Variables for Your App

Update your `.env.local` with the following. Replace `YOUR_NEW_SECRET` with the regenerated secret:

```env
# ── Microsoft Azure / Graph API ──────────────────────────────────────────────
AZURE_TENANT_ID=d6d261ac-ed7f-452b-8e1e-49890c9c58d7
AZURE_CLIENT_ID=c64c8fa1-5602-4b6b-b45e-e2f312ac6e18
AZURE_CLIENT_SECRET=YOUR_NEW_SECRET_AFTER_REGENERATING

# ── SharePoint Site ───────────────────────────────────────────────────────────
# Get SHAREPOINT_SITE_ID by calling (replace with your tenant/site):
#   GET https://graph.microsoft.com/v1.0/sites/yourtenant.sharepoint.com:/sites/GCPCentral
# The "id" field in the response is your site ID (looks like: abc123.sharepoint.com,guid1,guid2)
SHAREPOINT_SITE_URL=https://yourtenant.sharepoint.com/sites/GCPCentral
SHAREPOINT_SITE_ID=FILL_AFTER_STEP_9

# Get SHAREPOINT_DRIVE_ID by calling:
#   GET https://graph.microsoft.com/v1.0/sites/{SHAREPOINT_SITE_ID}/drives
# Find the drive named "Documents" and copy its "id"
SHAREPOINT_DRIVE_ID=FILL_AFTER_STEP_9

# ── Auth (keep existing NextAuth setup) ──────────────────────────────────────
AUTH_SECRET=your-existing-nextauth-secret
NEXTAUTH_URL=https://yourapp.com

# ── Email via Microsoft Graph ─────────────────────────────────────────────────
# This must be a licensed M365 mailbox in your tenant that the app can send from
GRAPH_MAIL_FROM=noreply@yourtenant.onmicrosoft.com
EMAIL_FROM_NAME=GCP Central

# ── App URL ───────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://yourapp.com

# ── Remove these once fully migrated ─────────────────────────────────────────
# MONGODB_URI=...              ← delete after migration
# CLOUDINARY_CLOUD_NAME=...    ← delete after migration
# CLOUDINARY_API_KEY=...       ← delete after migration
# CLOUDINARY_API_SECRET=...    ← delete after migration
# EMAIL_USER=...               ← delete after migration
# EMAIL_PASSWORD=...           ← delete after migration
```

---

## 6. Exact Azure Portal Steps to Complete Setup

### Step 1 — Add `Sites.ReadWrite.All`

1. Go to [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations**
2. Click your app (`GCP Central` or whatever name you gave it)
3. Left panel → **API permissions**
4. Click **+ Add a permission** → **Microsoft Graph** → **Application permissions**
5. In the search box type `Sites.ReadWrite` → expand **Sites** → check `Sites.ReadWrite.All`
6. Click **Add permissions**

### Step 2 — Grant Admin Consent

1. Still on the **API permissions** page
2. Click the button **"Grant admin consent for [Your Tenant Name]"**
3. A dialog appears — click **Yes**
4. All permissions should now show a green ✅ under **Status**

### Step 3 — Verify the Redirect URI (for future SSO option)

1. Left panel → **Authentication**
2. Under **Web** → **Redirect URIs** add: `https://yourapp.com/api/auth/callback/azure-ad`
3. Also add `http://localhost:3000/api/auth/callback/azure-ad` for local dev
4. Under **Implicit grant and hybrid flows** — leave both boxes **unchecked** (you are using client credentials, not implicit)
5. Save

### Step 4 — Note the Token Endpoint

Under **Overview** → **Endpoints** button — note the **OAuth 2.0 token endpoint (v2)** URL. It should be:

```
https://login.microsoftonline.com/d6d261ac-ed7f-452b-8e1e-49890c9c58d7/oauth2/v2.0/token
```

You will not need this directly because the SDK handles it, but it is useful for testing with Postman.

---

## 7. Code: Graph Client Using Your Credentials

**File to create:** `lib/graph.ts`

```typescript
import "server-only";
import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import {
  TokenCredentialAuthenticationProvider,
} from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";

let _client: Client | null = null;

export function getGraphClient(): Client {
  if (_client) return _client;

  const credential = new ClientSecretCredential(
    process.env.AZURE_TENANT_ID!,    // d6d261ac-ed7f-452b-8e1e-49890c9c58d7
    process.env.AZURE_CLIENT_ID!,    // c64c8fa1-5602-4b6b-b45e-e2f312ac6e18
    process.env.AZURE_CLIENT_SECRET! // YOUR_NEW_SECRET
  );

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });

  _client = Client.initWithMiddleware({ authProvider });
  return _client;
}

export const SITE_ID  = () => process.env.SHAREPOINT_SITE_ID!;
export const DRIVE_ID = () => process.env.SHAREPOINT_DRIVE_ID!;
```

**Install packages:**

```bash
npm install @microsoft/microsoft-graph-client @azure/identity @azure/msal-node
npm install --save-dev @microsoft/microsoft-graph-types
```

---

## 8. Code: Authentication Flow (NextAuth)

### 8.1 Credentials Provider — Keep but point to SharePoint

The user-facing login stays exactly the same (username + password form). Only the lookup changes from Prisma to Graph.

**Updated `src/lib/auth/auth.config.ts`:**

```typescript
import { compare } from "bcryptjs";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getGraphClient, SITE_ID } from "@/lib/graph";
import { USER_ROLES, type UserRole } from "@/src/types/auth";

const FALLBACK_ROLE: UserRole = "requestor";

function isUserRole(v: string): v is UserRole {
  return (USER_ROLES as readonly string[]).includes(v);
}
function normalizeRole(v: string | null | undefined): UserRole {
  if (!v) return FALLBACK_ROLE;
  return isUserRole(v.trim().toLowerCase()) ? (v.trim().toLowerCase() as UserRole) : FALLBACK_ROLE;
}

export const authConfig: NextAuthConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        identifier: { label: "Username or Email", type: "text" },
        password:   { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const identifier = String(credentials?.identifier ?? "").trim().toLowerCase();
        const password   = String(credentials?.password ?? "").trim();
        if (!identifier || !password) return null;

        // ── Look up user in SharePoint Users list ──────────────────────────
        const client = getGraphClient();
        const res = await client
          .api(`/sites/${SITE_ID()}/lists/Users/items`)
          .query({
            $filter: `fields/emailLower eq '${identifier}' or fields/usernameLower eq '${identifier}'`,
            $expand: "fields",
            $top: "1",
          })
          .get();

        const item = res.value?.[0];
        if (!item) return null;

        const f = item.fields as Record<string, unknown>;
        if (!f.isActive) return null;

        // ── Verify password ────────────────────────────────────────────────
        const passwordMatches = await compare(password, String(f.passwordHash ?? ""));
        if (!passwordMatches) return null;

        // ── Parse roles ────────────────────────────────────────────────────
        let roles: UserRole[];
        try {
          roles = (JSON.parse(String(f.roles ?? "[]")) as string[]).map(normalizeRole);
        } catch {
          roles = [normalizeRole(String(f.primaryRole))];
        }

        return {
          id:          String(item.id),          // SharePoint item ID
          name:        String(f.name ?? ""),
          email:       String(f.email ?? ""),
          username:    String(f.username ?? ""),
          role:        normalizeRole(String(f.primaryRole ?? "")),
          roles,
          companyId:   f.companyId ? String(f.companyId) : undefined,
          companyCode: f.companyCode ? String(f.companyCode) : undefined,
          companyName: f.companyName ? String(f.companyName) : undefined,
        };
      },
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.username    = user.username;
        token.role        = normalizeRole(user.role);
        token.roles       = Array.isArray(user.roles) ? user.roles : [normalizeRole(user.role)];
        token.companyId   = user.companyId ?? null;
        token.companyCode = user.companyCode ?? null;
        token.companyName = user.companyName ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id          = token.sub ?? "";
        session.user.username    = String(token.username ?? "");
        session.user.role        = normalizeRole(String(token.role ?? ""));
        session.user.roles       = Array.isArray(token.roles) ? token.roles.map((r: unknown) => normalizeRole(String(r))) : [session.user.role];
        session.user.companyId   = typeof token.companyId   === "string" ? token.companyId   : undefined;
        session.user.companyCode = typeof token.companyCode === "string" ? token.companyCode : undefined;
        session.user.companyName = typeof token.companyName === "string" ? token.companyName : undefined;
      }
      return session;
    },
  },
};
```

> **The login page (`app/login/page.tsx`) and login form do not need to change** — the user still types their username and password exactly as before.

### 8.2 Future Option: Add Microsoft SSO for Internal Staff (Optional)

If you later want internal M365 users to log in with "Sign in with Microsoft":

```bash
npm install next-auth  # already present
```

Add a second provider **alongside** Credentials:

```typescript
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

// In providers array, add:
MicrosoftEntraID({
  clientId:     process.env.AZURE_AD_CLIENT_ID!,
  clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
  tenantId:     process.env.AZURE_AD_TENANT_ID!,
}),
```

This lets some users sign in via Microsoft while external users still use username/password. NextAuth handles both simultaneously.

---

## 9. SharePoint Site Setup

### 9.1 Create the SharePoint Site

1. Go to [SharePoint Admin Center](https://admin.microsoft.com) → **Sites** → **Active sites** → **Create**
2. Choose **Team site** (or **Communication site** if no team membership needed)
3. Site name: `GCP Central` → Site address: `GCPCentral`
4. Note the full URL: `https://yourtenant.sharepoint.com/sites/GCPCentral`

### 9.2 Get Your Site ID and Drive ID

**Option A — Graph Explorer (easiest):**

1. Open [https://developer.microsoft.com/en-us/graph/graph-explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
2. Sign in with your tenant admin account
3. Run this GET request (replace with your tenant and site names):
   ```
   GET https://graph.microsoft.com/v1.0/sites/yourtenant.sharepoint.com:/sites/GCPCentral
   ```
4. Copy the `"id"` field from the response → this is your `SHAREPOINT_SITE_ID`
5. Run:
   ```
   GET https://graph.microsoft.com/v1.0/sites/{SITE_ID}/drives
   ```
6. Find the drive with `"name": "Documents"` → copy its `"id"` → this is your `SHAREPOINT_DRIVE_ID`

**Option B — Postman / curl (using your app credentials):**

First get an access token:
```bash
curl -X POST \
  "https://login.microsoftonline.com/d6d261ac-ed7f-452b-8e1e-49890c9c58d7/oauth2/v2.0/token" \
  -d "grant_type=client_credentials" \
  -d "client_id=c64c8fa1-5602-4b6b-b45e-e2f312ac6e18" \
  -d "client_secret=YOUR_NEW_SECRET" \
  -d "scope=https://graph.microsoft.com/.default"
```

Then use the `access_token` from the response:
```bash
curl -H "Authorization: Bearer ACCESS_TOKEN" \
  "https://graph.microsoft.com/v1.0/sites/yourtenant.sharepoint.com:/sites/GCPCentral"
```

### 9.3 Grant the App Access to the Site

With `Sites.ReadWrite.All` (application permission + admin consent), your registered app can access all sites in the tenant automatically. No extra site-level permission step is needed.

If you later want to use **`Sites.Selected`** (restrict to only one site):

```bash
# Grant app access to a specific site only
POST https://graph.microsoft.com/v1.0/sites/{siteId}/permissions
{
  "roles": ["write"],
  "grantedToIdentities": [{
    "application": {
      "id": "c64c8fa1-5602-4b6b-b45e-e2f312ac6e18",
      "displayName": "GCP Central"
    }
  }]
}
```

---

## 10. Testing the Connection

Create a simple test API route to verify everything works before you start migrating data:

**File:** `app/api/test-sharepoint/route.ts`

```typescript
import { NextResponse } from "next/server";
import { getGraphClient, SITE_ID, DRIVE_ID } from "@/lib/graph";

export async function GET() {
  try {
    const client = getGraphClient();

    // Test 1: Read site info
    const site = await client.api(`/sites/${SITE_ID()}`).get();

    // Test 2: List drives
    const drives = await client.api(`/sites/${SITE_ID()}/drives`).get();

    // Test 3: List top-level lists
    const lists = await client.api(`/sites/${SITE_ID()}/lists`).select("name,id").get();

    return NextResponse.json({
      ok: true,
      site: { id: site.id, name: site.displayName, url: site.webUrl },
      drives: drives.value.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name })),
      lists: lists.value.map((l: { id: string; name: string }) => ({ id: l.id, name: l.name })),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
```

Navigate to `http://localhost:3000/api/test-sharepoint` — if you see site info, drives, and lists, your credentials and permissions are working correctly.

**Delete this route before deploying to production.**

---

## Summary Checklist

- [ ] Regenerate Client Secret in Azure Portal
- [ ] Add `Sites.ReadWrite.All` permission in Azure Portal
- [ ] Click **Grant admin consent** — verify all permissions show green ✅
- [ ] Add Redirect URIs in Azure Portal → Authentication
- [ ] Create SharePoint site `GCPCentral`
- [ ] Get Site ID via Graph Explorer and add to `.env.local`
- [ ] Get Drive ID via Graph Explorer and add to `.env.local`
- [ ] Install: `@microsoft/microsoft-graph-client`, `@azure/identity`, `@azure/msal-node`
- [ ] Create `lib/graph.ts` with Graph client singleton
- [ ] Create test route and verify connection
- [ ] Start building SharePoint list helpers (`lib/sharepoint/lists.ts`)
- [ ] Migrate auth config to use SharePoint for user lookup
- [ ] Migrate data models one list at a time (see `SHAREPOINT_MIGRATION_GUIDE.md`)

---

*Last updated: May 2026*
