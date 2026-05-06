# Azure Entra ID B2C Authentication — Full Implementation Guide for GCP Central

---

## Table of Contents

1. [What Is Azure AD B2C and Why It Fits GCP Central](#1-what-is-azure-ad-b2c-and-why-it-fits-gcp-central)
2. [Critical Distinction: B2C vs Regular Entra ID](#2-critical-distinction-b2c-vs-regular-entra-id)
3. [What You Need (Full List)](#3-what-you-need-full-list)
4. [Architecture With B2C](#4-architecture-with-b2c)
5. [Step-by-Step: Create the B2C Tenant](#5-step-by-step-create-the-b2c-tenant)
6. [Step-by-Step: Register App in B2C Tenant](#6-step-by-step-register-app-in-b2c-tenant)
7. [Step-by-Step: Create User Flows](#7-step-by-step-create-user-flows)
8. [Step-by-Step: Create Users in B2C (Admin Action)](#8-step-by-step-create-users-in-b2c-admin-action)
9. [Environment Variables](#9-environment-variables)
10. [Code: NextAuth with B2C](#10-code-nextauth-with-b2c)
11. [Code: Admin Creates User via Graph → B2C](#11-code-admin-creates-user-via-graph--b2c)
12. [Code: Role Assignment After B2C Login](#12-code-role-assignment-after-b2c-login)
13. [How the Full Login Flow Works](#13-how-the-full-login-flow-works)
14. [User Migration from MongoDB/bcrypt](#14-user-migration-from-mongodbcrypt)
15. [Two App Registrations You Will Have](#15-two-app-registrations-you-will-have)
16. [Cost](#16-cost)
17. [Summary Checklist](#17-summary-checklist)

---

## 1. What Is Azure AD B2C and Why It Fits GCP Central

**Azure AD B2C (Business to Consumer)** is Microsoft's identity service built specifically for applications that serve **external users** — people outside your organization who don't have a Microsoft 365 account.

### Why B2C is the right fit for GCP Central

| Factor | Regular Entra ID | Azure AD B2C |
|---|---|---|
| Internal staff (GCPC team) | ✅ | ✅ |
| External company users (requestors, HoCs) | ❌ Needs expensive guest accounts | ✅ Native support |
| Local accounts (email + password) | ❌ Not designed for this | ✅ First class |
| Social/enterprise login (Google, Microsoft) | Limited | ✅ Optional add-on |
| Users need M365 licence | ✅ Yes (cost per user) | ❌ No (pay per authentication) |
| Handles its own identity (sign-up, sign-in, password reset) | No | ✅ Yes — hosted pages |
| Scales to thousands of external users | No | ✅ Yes |

GCP Central has many users from **different companies** — requestors, verifiers, HoCs — most of whom are not Microsoft 365 users. B2C is designed precisely for this scenario.

---

## 2. Critical Distinction: B2C vs Regular Entra ID

**This is the most important thing to understand before starting.**

You will end up with **two separate Azure things**, each doing a different job:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Thing 1: Your EXISTING App Registration                                │
│  Tenant: d6d261ac-ed7f-452b-8e1e-49890c9c58d7  (your org tenant)       │
│  Client ID: c64c8fa1-5602-4b6b-b45e-e2f312ac6e18                       │
│                                                                         │
│  PURPOSE: Server → SharePoint / Graph API                              │
│  Used for: reading/writing SharePoint Lists, uploading files,           │
│            sending email via Graph — ALL INVISIBLE TO USERS             │
│  Auth type: Client Credentials (machine-to-machine, no user involved)  │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  Thing 2: NEW Azure AD B2C Tenant + App Registration                    │
│  Tenant: gcpcentral.onmicrosoft.com  (new, separate tenant)            │
│  Client ID: (new, created in steps below)                               │
│                                                                         │
│  PURPOSE: User Login to GCP Central                                    │
│  Used for: who can sign in, sign up, reset password                    │
│  Auth type: OAuth 2.0 Authorization Code + PKCE (user sees a           │
│             login page and consents)                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

**B2C cannot be used to call SharePoint.** B2C does not support the `client_credentials` grant. Your existing app registration stays and handles all data operations. B2C only handles login.

---

## 3. What You Need (Full List)

### Azure side (new items needed)

| Item | Status |
|---|---|
| Azure AD B2C tenant (separate from your org tenant) | ❌ Need to create |
| App registration inside the B2C tenant | ❌ Need to create |
| User Flow: Sign-up and Sign-in (SUSI) | ❌ Need to create |
| User Flow: Password Reset | ❌ Need to create |
| Optional: Custom domain for B2C (`login.gcpcentral.com`) | Optional |
| Optional: Branded login page | Optional |

### Existing items (keep as-is)

| Item | Purpose | Status |
|---|---|---|
| App reg in org tenant (Client ID: `c64c8fa1...`) | SharePoint / Graph data access | ✅ Keep |
| `Sites.ReadWrite.All`, `Files.ReadWrite.All`, `Mail.Send` permissions | Data layer | ✅ Keep |

### Code changes needed

| Item | Change |
|---|---|
| `src/lib/auth/auth.config.ts` | Replace Credentials provider with B2C OIDC provider |
| `app/login/page.tsx` + `login-form.tsx` | Replace username/password form with "Sign in" button |
| `app/admin/roles/actions.ts` | `createUserWithRolesAction` creates user in B2C via Graph, not local bcrypt |
| `lib/graph.ts` | Add B2C Graph client for user management |
| `src/lib/auth/get-current-user.ts` | Read roles from SharePoint Users list after B2C token received |
| Remove: `bcryptjs` | No longer needed |
| Remove: `passwordHash` column in Users list | Identity lives in B2C |

### npm packages

```bash
# Add
npm install @azure/msal-node @azure/identity @microsoft/microsoft-graph-client

# Already present
# next-auth (v5) — has built-in B2C support

# Remove after migration
npm uninstall bcryptjs
```

---

## 4. Architecture With B2C

```
USER                        GCP CENTRAL (Next.js)              MICROSOFT CLOUD
────                        ─────────────────────              ───────────────

[Browser]
  │
  │  1. Clicks "Sign in"
  │─────────────────────────► [Next.js /api/auth/signin]
  │                                     │
  │                                     │  2. Redirects to B2C login page
  │◄────────────────────────────────────│──────────────────────────────────────►
  │                                                                [B2C Tenant]
  │  3. User enters email + password                             [Login Page]
  │──────────────────────────────────────────────────────────────────────────►
  │                                                              [B2C validates]
  │  4. B2C redirects back with auth code
  │◄──────────────────────────────────────────────────────────────────────────
  │─────────────────────────► [/api/auth/callback/azure-ad-b2c]
  │                                     │
  │                                     │  5. NextAuth exchanges code for tokens
  │                                     │─────────────────────────────────────►
  │                                     │                        [B2C /token]
  │                                     │◄─────────────────────────────────────
  │                                     │  (id_token with: email, name, objectId)
  │                                     │
  │                                     │  6. Look up roles in SharePoint
  │                                     │─────────────────────────────────────►
  │                                     │                    [SharePoint Users List]
  │                                     │◄─────────────────────────────────────
  │                                     │  (primaryRole, roles[], companyId, ...)
  │                                     │
  │  7. JWT session created with        │
  │     roles + company info            │
  │◄─────────────────────────────────── │
  │
  │  Now browsing as authenticated user
  │─────────────────────────► [Server Components / API Routes]
                                        │
                                        │  Data ops use org tenant app
                                        │─────────────────────────────────────►
                                        │                    [SharePoint Lists]
                                        │◄─────────────────────────────────────
```

**Key insight:** B2C issues the JWT that proves "who this person is". Your SharePoint `Users` list stores "what roles this person has". NextAuth joins them at login (step 6).

---

## 5. Step-by-Step: Create the B2C Tenant

1. Go to [Azure Portal](https://portal.azure.com) → top search bar → search **"Azure AD B2C"** → click **Create a new Azure AD B2C Tenant**
2. Fill in:
   - **Organization name:** `GCP Central`
   - **Initial domain name:** `gcpcentral` → results in `gcpcentral.onmicrosoft.com`
   - **Country/Region:** Malaysia (or your country)
   - **Subscription:** select your Azure subscription
   - **Resource group:** create or select one
3. Click **Review + Create** → **Create**
4. Wait 1–2 minutes for provisioning
5. After creation → click **"Click here to navigate to your new tenant"**

> You are now inside the B2C tenant, which is completely separate from your organization tenant. Notice the tenant name in the top-right changes.

---

## 6. Step-by-Step: Register App in B2C Tenant

You are still inside the B2C tenant for all steps below.

### 6.1 Create the App Registration

1. Search **"App registrations"** → **New registration**
2. Fill in:
   - **Name:** `GCP Central Web App`
   - **Supported account types:** **Accounts in any identity provider or organizational directory** (the third option — this is the B2C option)
   - **Redirect URI:**
     - Type: **Web**
     - Value: `https://yourapp.com/api/auth/callback/azure-ad-b2c`
     - Also add: `http://localhost:3000/api/auth/callback/azure-ad-b2c`
3. Click **Register**
4. Note the **Application (client) ID** → this is your `B2C_CLIENT_ID`

### 6.2 Create a Client Secret

1. Left panel → **Certificates & secrets** → **New client secret**
2. Description: `gcp-central-nextauth` | Expires: `24 months`
3. Copy the **Value** immediately (you cannot see it again)
4. This is your `B2C_CLIENT_SECRET`

### 6.3 Add API Permissions in B2C Tenant

1. Left panel → **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**
2. Add: `openid`, `offline_access`, `profile`, `email`
3. Click **Grant admin consent**

### 6.4 Enable ID Tokens

1. Left panel → **Authentication**
2. Under **Implicit grant and hybrid flows** → check **ID tokens**
3. Save

---

## 7. Step-by-Step: Create User Flows

User flows define how users sign in, sign up, and reset passwords. Still inside the B2C tenant:

1. Search **"Azure AD B2C"** in the portal → click your B2C resource
2. Left panel → **User flows** → **New user flow**

### 7.1 Sign-up and Sign-in Flow (SUSI) — Required

1. Select **Sign up and sign in** → Version: **Recommended** → Create
2. Name: `susi` → full name becomes `B2C_1_susi`
3. **Identity providers:** check **Email signup** (local accounts with email/password)
4. **User attributes and claims** — select what to collect at sign-up:
   - ✅ Display Name (collect + return)
   - ✅ Email Address (collect + return)
   - ✅ Given Name (optional)
   - ✅ Surname (optional)
5. Click **Create**

### 7.2 Password Reset Flow — Required

1. **New user flow** → **Password reset** → Recommended → Create
2. Name: `password_reset` → full name becomes `B2C_1_password_reset`
3. Identity providers: **Reset password using email address**
4. Return claims: Email addresses, Display Name
5. Click **Create**

### 7.3 Profile Editing Flow — Optional

1. **New user flow** → **Profile editing** → Recommended → Create
2. Name: `profile_edit`
3. Add any fields users can edit
4. Click **Create**

### 7.4 Get Your B2C Domain and Policy Metadata URL

Your B2C endpoints follow this pattern:

```
https://gcpcentral.b2clogin.com/gcpcentral.onmicrosoft.com/B2C_1_susi/v2.0
```

The OpenID Connect metadata document (needed by NextAuth):

```
https://gcpcentral.b2clogin.com/gcpcentral.onmicrosoft.com/B2C_1_susi/v2.0/.well-known/openid-configuration
```

Test this URL in a browser — it should return a JSON document. If it does, the flow is ready.

---

## 8. Step-by-Step: Create Users in B2C (Admin Action)

When an admin creates a new user in GCP Central, the app must:
1. Create the user in B2C (identity)
2. Create a record in the SharePoint `Users` list (roles, company, etc.)
3. Send a welcome email with a temporary password

B2C user creation uses the **Microsoft Graph API**, but against the **B2C tenant**, not your org tenant.

### 8.1 Register a Separate App in Your Org Tenant for B2C User Management

B2C user management via Graph requires an app registration in your **org tenant** (not the B2C tenant) with `User.ReadWrite.All` on the B2C directory:

1. Switch back to your org tenant (`d6d261ac...`)
2. **App registrations** → **New registration**
3. Name: `GCP Central B2C Admin`
4. Supported account types: **Accounts in this organizational directory only**
5. No redirect URI (this is server-only, no user login)
6. Register → note the Client ID → create a Client Secret
7. **API permissions** → Add → **Microsoft Graph** → **Application permissions**
   - Add `User.ReadWrite.All`
   - Grant admin consent
8. Under **API permissions** → change the **Directory** to the **B2C tenant** (see note below)

> **Note on B2C Graph access:** B2C user management via Graph requires the app to target `https://graph.microsoft.com` using credentials from the B2C tenant itself. The cleaner approach is to register an app directly inside the B2C tenant with `User.ReadWrite.All` (Application permission). This is separate from the OIDC login app.

**Practical approach:** create a second app registration inside B2C tenant:

1. Switch to **B2C tenant** → App registrations → New registration
2. Name: `GCP Central User Admin`
3. No redirect URI
4. API permissions → Microsoft Graph → Application → `User.ReadWrite.All` → Grant consent
5. Certificates & secrets → New client secret → copy the value
6. Note the Client ID → this is `B2C_ADMIN_CLIENT_ID`

---

## 9. Environment Variables

Add these to `.env.local` **in addition to** the existing SharePoint variables:

```env
# ── Azure AD B2C (User Login) ─────────────────────────────────────────────────

# Your B2C tenant domain
B2C_TENANT_NAME=gcpcentral
# Full tenant domain
B2C_TENANT_DOMAIN=gcpcentral.onmicrosoft.com

# App registration created in B2C tenant (section 6)
B2C_CLIENT_ID=<your-b2c-app-client-id>
B2C_CLIENT_SECRET=<your-b2c-app-client-secret>

# User flow names (created in section 7)
B2C_SUSI_POLICY=B2C_1_susi
B2C_PASSWORD_RESET_POLICY=B2C_1_password_reset

# Constructed from the above — used in NextAuth config
# Format: https://{tenant}.b2clogin.com/{tenantDomain}/{policy}/v2.0
B2C_ISSUER=https://gcpcentral.b2clogin.com/gcpcentral.onmicrosoft.com/B2C_1_susi/v2.0

# ── B2C Admin App (for creating users via Graph) ──────────────────────────────
# App registration in B2C tenant with User.ReadWrite.All (section 8)
B2C_ADMIN_TENANT_ID=<b2c-tenant-id>   # get from B2C tenant Overview page
B2C_ADMIN_CLIENT_ID=<b2c-admin-app-client-id>
B2C_ADMIN_CLIENT_SECRET=<b2c-admin-app-client-secret>

# ── Existing (keep these) ─────────────────────────────────────────────────────
AZURE_TENANT_ID=d6d261ac-ed7f-452b-8e1e-49890c9c58d7
AZURE_CLIENT_ID=c64c8fa1-5602-4b6b-b45e-e2f312ac6e18
AZURE_CLIENT_SECRET=<regenerated-secret>
SHAREPOINT_SITE_ID=<your-site-id>
SHAREPOINT_DRIVE_ID=<your-drive-id>
AUTH_SECRET=<your-nextauth-secret>
NEXT_PUBLIC_APP_URL=https://yourapp.com
```

---

## 10. Code: NextAuth with B2C

B2C is an OIDC-compliant provider. NextAuth v5 supports it as a generic OIDC provider.

**Updated `src/lib/auth/auth.config.ts`:**

```typescript
import type { NextAuthConfig } from "next-auth";
import { getGraphClient, SITE_ID } from "@/lib/graph";
import { USER_ROLES, type UserRole } from "@/src/types/auth";

const FALLBACK_ROLE: UserRole = "requestor";

function normalizeRole(v: unknown): UserRole {
  if (typeof v !== "string") return FALLBACK_ROLE;
  const s = v.trim().toLowerCase();
  return (USER_ROLES as readonly string[]).includes(s) ? (s as UserRole) : FALLBACK_ROLE;
}

const B2C_TENANT    = process.env.B2C_TENANT_NAME!;
const B2C_DOMAIN    = process.env.B2C_TENANT_DOMAIN!;
const SUSI_POLICY   = process.env.B2C_SUSI_POLICY!;
const B2C_ISSUER    = `https://${B2C_TENANT}.b2clogin.com/${B2C_DOMAIN}/${SUSI_POLICY}/v2.0`;

export const authConfig: NextAuthConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },

  providers: [
    {
      id: "azure-ad-b2c",
      name: "GCP Central",
      type: "oidc",
      issuer: B2C_ISSUER,
      clientId:     process.env.B2C_CLIENT_ID!,
      clientSecret: process.env.B2C_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid offline_access profile email",
          response_type: "code",
        },
      },
      // B2C puts user info in the id_token directly
      userinfo: {
        async request({ tokens }) {
          // B2C puts claims directly in id_token — decode without re-fetching
          const payload = JSON.parse(
            Buffer.from(tokens.id_token!.split(".")[1], "base64url").toString()
          );
          return payload;
        },
      },
      profile(profile) {
        return {
          id:    profile.oid   ?? profile.sub,
          name:  profile.name  ?? profile.displayName ?? "",
          email: profile.email ?? profile.emails?.[0] ?? "",
        };
      },
    },
  ],

  pages: {
    signIn: "/login",
    error:  "/login",
  },

  callbacks: {
    async jwt({ token, user, account }) {
      // On first sign-in, look up the user's roles in SharePoint
      if (account && user) {
        token.b2cObjectId = user.id; // B2C object ID (oid claim)

        try {
          // Look up by email in the SharePoint Users list
          const client = getGraphClient();
          const res = await client
            .api(`/sites/${SITE_ID()}/lists/Users/items`)
            .query({
              $filter: `fields/emailLower eq '${user.email!.toLowerCase()}'`,
              $expand: "fields",
              $top: "1",
            })
            .get();

          const item = res.value?.[0];
          if (item) {
            const f = item.fields as Record<string, unknown>;
            let roles: UserRole[];
            try {
              roles = (JSON.parse(String(f.roles ?? "[]")) as string[]).map(normalizeRole);
            } catch {
              roles = [normalizeRole(f.primaryRole)];
            }

            token.spItemId   = String(item.id);
            token.role       = normalizeRole(f.primaryRole);
            token.roles      = roles;
            token.username   = String(f.username ?? "");
            token.companyId  = f.companyId  ? String(f.companyId)  : null;
            token.companyCode= f.companyCode? String(f.companyCode): null;
            token.companyName= f.companyName? String(f.companyName): null;
          } else {
            // User authenticated with B2C but has no record in SharePoint yet
            // Assign default role — admin can upgrade later
            token.role  = FALLBACK_ROLE;
            token.roles = [FALLBACK_ROLE];
          }
        } catch (err) {
          console.error("Failed to fetch user roles from SharePoint:", err);
          token.role  = FALLBACK_ROLE;
          token.roles = [FALLBACK_ROLE];
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id          = String(token.sub ?? "");
        session.user.username    = String(token.username ?? "");
        session.user.role        = normalizeRole(token.role);
        session.user.roles       = Array.isArray(token.roles)
          ? token.roles.map((r: unknown) => normalizeRole(r))
          : [normalizeRole(token.role)];
        session.user.companyId   = typeof token.companyId   === "string" ? token.companyId   : undefined;
        session.user.companyCode = typeof token.companyCode === "string" ? token.companyCode : undefined;
        session.user.companyName = typeof token.companyName === "string" ? token.companyName : undefined;
      }
      return session;
    },
  },
};
```

### Updated Login Page

Replace the username/password form with a single sign-in button:

**`app/login/login-form.tsx`** (simplified version):

```typescript
'use client';
import { signIn } from 'next-auth/react';

export default function LoginForm() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-muted)]">
        Sign in with your GCP Central account.
      </p>
      <button
        onClick={() => signIn('azure-ad-b2c', { callbackUrl: '/dashboard' })}
        className="btn btn--primary w-full"
      >
        Sign in with GCP Central
      </button>
    </div>
  );
}
```

> The B2C login page (hosted by Microsoft) handles all password entry, "Forgot password", and sign-up. You can brand it with your logo and colours in the B2C portal.

---

## 11. Code: Admin Creates User via Graph → B2C

When admin creates a new user in `/admin/roles`, the action now:
1. Creates the user in B2C via Microsoft Graph (identity)
2. Creates the user record in the SharePoint `Users` list (roles, company)
3. Sends the welcome email

**New `lib/b2c-admin-graph.ts`:**

```typescript
import "server-only";
import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from
  "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";

let _b2cClient: Client | null = null;

/** Graph client that targets the B2C tenant for user management */
export function getB2CAdminClient(): Client {
  if (_b2cClient) return _b2cClient;

  const credential = new ClientSecretCredential(
    process.env.B2C_ADMIN_TENANT_ID!,
    process.env.B2C_ADMIN_CLIENT_ID!,
    process.env.B2C_ADMIN_CLIENT_SECRET!
  );
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });
  _b2cClient = Client.initWithMiddleware({ authProvider });
  return _b2cClient;
}

/**
 * Create a user in the B2C tenant.
 * Returns the B2C object ID (oid).
 */
export async function createB2CUser(params: {
  displayName: string;
  email: string;
  temporaryPassword: string;
}): Promise<{ id: string }> {
  const client = getB2CAdminClient();

  const user = await client.api("/users").post({
    displayName: params.displayName,
    identities: [
      {
        signInType:        "emailAddress",
        issuer:            process.env.B2C_TENANT_DOMAIN!, // gcpcentral.onmicrosoft.com
        issuerAssignedId:  params.email,
      },
    ],
    passwordProfile: {
      password:                    params.temporaryPassword,
      forceChangePasswordNextSignIn: true,
    },
    passwordPolicies: "DisablePasswordExpiration",
    accountEnabled: true,
  });

  return { id: user.id };
}

/**
 * Delete a user from B2C by their object ID.
 */
export async function deleteB2CUser(objectId: string): Promise<void> {
  const client = getB2CAdminClient();
  await client.api(`/users/${objectId}`).delete();
}
```

**Updated `app/admin/roles/actions.ts` — `createUserWithRolesAction`:**

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { createB2CUser } from '@/lib/b2c-admin-graph';
import { createItem } from '@/lib/sharepoint/lists';
import { sendEmail } from '@/lib/email/graph-email';
import { getNewUserAccountEmailHtml, htmlToPlainText } from '@/lib/email/email-templates';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { USER_ROLE_LABELS, USER_ROLES, type UserRole } from '@/src/types/auth';

// ... (role helpers same as current) ...

export async function createUserWithRolesAction(formData: FormData) {
  const currentUser = await getCurrentUser();
  if (!currentUser?.roles.includes('admin')) throw new Error('Unauthorized');

  const name         = String(formData.get('name') ?? '').trim();
  const email        = String(formData.get('email') ?? '').trim();
  const username     = String(formData.get('username') ?? '').trim();
  const tempPassword = String(formData.get('password') ?? '');
  const companyId    = String(formData.get('companyId') ?? '').trim() || null;
  const primaryRole  = normalizeRole(String(formData.get('primaryRole') ?? ''));
  const selectedRoles = normalizeRoleSelection(formData.getAll('roles'));
  const roles = selectedRoles.length > 0 ? selectedRoles : [primaryRole];

  // 1. Create user in B2C (identity + password)
  const b2cUser = await createB2CUser({
    displayName: name,
    email,
    temporaryPassword: tempPassword,
  });

  // 2. Create user record in SharePoint Users list (roles + company)
  await createItem('Users', {
    name,
    email,
    emailLower:    email.toLowerCase(),
    username,
    usernameLower: username.toLowerCase(),
    b2cObjectId:   b2cUser.id,      // store B2C oid for lookup on login
    primaryRole,
    roles:         JSON.stringify(roles), // stored as JSON string
    companyId:     companyId ?? '',
    isActive:      true,
  });

  // 3. Send welcome email with login URL and temp password
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/login`;
  const roleLabels = roles.map(r => USER_ROLE_LABELS[r]);
  const html = getNewUserAccountEmailHtml(name, username, tempPassword, roleLabels, loginUrl);
  await sendEmail({ to: email, subject: 'Your GCP Central account', html, text: htmlToPlainText(html) });

  revalidatePath('/admin/roles');
  return { ok: true, message: 'User created in B2C and welcome email sent.' };
}
```

---

## 12. Code: Role Assignment After B2C Login

When a user logs in via B2C for the first time, their `email` claim from B2C is used to find their record in the SharePoint `Users` list and attach roles to the JWT. This is already handled by the `jwt` callback in section 10.

**Important:** The `Users` list record **must be created before the user's first login** (done by admin in section 11). If someone logs in via B2C without a `Users` list record, they get `requestor` role by default.

You can also allow self-registration by creating the SharePoint record in the `signIn` callback:

```typescript
// In authConfig callbacks:
async signIn({ user }) {
  // Check if user exists in SharePoint — if not, create with default role
  // This enables self-service sign-up via B2C
  return true; // or return false to block sign-in
},
```

---

## 13. How the Full Login Flow Works

```
Scenario: Requestor from an external company logs in for the first time

1. User visits https://gcpcentral.com/login
2. Clicks "Sign in with GCP Central"
3. Redirected to: https://gcpcentral.b2clogin.com/.../B2C_1_susi/oauth2/v2.0/authorize
   (Microsoft-hosted page with your branding)
4. User enters email + password (or "Forgot password" → B2C handles reset via email)
5. B2C validates credentials → issues id_token + code
6. Redirects to: https://gcpcentral.com/api/auth/callback/azure-ad-b2c?code=...
7. NextAuth exchanges code for tokens at B2C /token endpoint
8. NextAuth jwt() callback fires:
   a. Extracts email from id_token
   b. Calls SharePoint: GET /lists/Users/items?$filter=fields/emailLower eq 'user@company.com'
   c. Gets back: { primaryRole: 'requestor', roles: '["requestor"]', companyId: '...' }
   d. Puts role + companyId into JWT
9. Session cookie set — user is logged in
10. Redirected to /dashboard

From now on the app behaves exactly as before:
- hasRole(user, 'requestor') checks JWT roles array
- currentUser.companyId scopes data visibility
- /admin/roles page shows the user and allows role changes
```

---

## 14. User Migration from MongoDB/bcrypt

Existing users have bcrypt-hashed passwords in MongoDB. B2C cannot import hashed passwords. Options:

### Option A — Forced Reset (Simplest)

1. Create all users in B2C with a **random temporary password** and `forceChangePasswordNextSignIn: true`
2. Send each user an email with their temporary password
3. On first login, B2C forces them to set a new password
4. No existing passwords are transferred

**Script pattern:**

```typescript
for (const user of existingUsers) {
  const tempPassword = crypto.randomBytes(12).toString('base64').slice(0, 16) + 'A1!';
  await createB2CUser({ displayName: user.name, email: user.email, temporaryPassword: tempPassword });
  await sendWelcomeEmail(user.email, tempPassword);
}
```

### Option B — Just-In-Time Migration (Zero disruption)

Keep bcrypt passwords temporarily. On login:
1. User signs in via B2C with their existing password → fails (B2C doesn't have it)
2. Fall back to credentials check against MongoDB bcrypt hash
3. If credentials match: create B2C account with the same password silently
4. On subsequent logins: B2C works normally

This requires a custom ROPC (Resource Owner Password Credentials) step and is complex to implement. **Option A is strongly recommended.**

### Option C — Parallel Running Period

Run both auth methods simultaneously for 2–4 weeks:
- B2C for new users
- Credentials for old users who haven't migrated
- Show banner: "Migrate your login by [date]"

---

## 15. Two App Registrations You Will Have

After full setup you will have **3 total app registrations** across two tenants:

| # | App Name | Tenant | Used For | Auth Type |
|---|---|---|---|---|
| 1 | `GCP Central` (existing) | Org tenant (`d6d261ac`) | SharePoint data + email | Client Credentials (no user) |
| 2 | `GCP Central Web App` | B2C tenant | User login (sign-in/sign-up) | OIDC Authorization Code |
| 3 | `GCP Central User Admin` | B2C tenant | Admin creates users via API | Client Credentials (no user) |

---

## 16. Cost

| Service | Free Tier | Paid |
|---|---|---|
| Azure AD B2C | **50,000 MAU free** per month | $0.00016 per auth after 50K |
| MFA (optional add-on) | Not included | $0.03 per MFA event |
| Custom domains | Not included | Included in B2C |

For GCP Central with hundreds of internal users, **you will likely stay in the free tier**.

**Monthly Active User (MAU):** A user who performs at least one login in a calendar month counts as 1 MAU regardless of how many times they log in that month.

---

## 17. Summary Checklist

### Azure Portal (B2C)

- [ ] Create Azure AD B2C tenant at `gcpcentral.onmicrosoft.com`
- [ ] Register app `GCP Central Web App` in B2C tenant
- [ ] Add Redirect URIs for prod and `localhost`
- [ ] Enable ID tokens in Authentication settings
- [ ] Create SUSI user flow `B2C_1_susi`
- [ ] Create Password Reset user flow `B2C_1_password_reset`
- [ ] Test user flow with "Run user flow" button in portal
- [ ] Register app `GCP Central User Admin` in B2C tenant (for Graph user management)
- [ ] Add `User.ReadWrite.All` to the admin app → grant consent
- [ ] Get B2C Tenant ID (from B2C tenant Overview)

### Code

- [ ] Install `@microsoft/microsoft-graph-client`, `@azure/identity`
- [ ] Create `lib/b2c-admin-graph.ts` (B2C Graph client)
- [ ] Update `src/lib/auth/auth.config.ts` — replace Credentials with B2C OIDC
- [ ] Update `app/login/login-form.tsx` — replace form with Sign In button
- [ ] Update `app/admin/roles/actions.ts` — create user in B2C + SharePoint
- [ ] Remove `bcryptjs` after user migration is complete

### .env.local

- [ ] Add `B2C_TENANT_NAME`, `B2C_TENANT_DOMAIN`, `B2C_SUSI_POLICY`
- [ ] Add `B2C_CLIENT_ID`, `B2C_CLIENT_SECRET`
- [ ] Add `B2C_ADMIN_TENANT_ID`, `B2C_ADMIN_CLIENT_ID`, `B2C_ADMIN_CLIENT_SECRET`

### Migration

- [ ] Choose migration option (A = forced reset recommended)
- [ ] Run user migration script
- [ ] Send migration emails to all users
- [ ] Test login for at least one user from each role
- [ ] Remove MongoDB + bcrypt after confirmed working

---

*Last updated: May 2026*
*See also: `SHAREPOINT_MIGRATION_GUIDE.md`, `SHAREPOINT_AUTH_AND_SETUP.md`*
