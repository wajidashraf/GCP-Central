# Migration Progress — MongoDB → SharePoint Lists & Cloudinary → SharePoint Document Library

> Tracks how far the GCP Central app has moved from **MongoDB (via Prisma)** to **SharePoint Lists**, and from **Cloudinary** to **SharePoint Document Libraries**.
>
> Source of truth for status is in code:
>
> - Server actions: `app/submit/[channel]/[code]/_actions/*.ts`
> - SharePoint data layer: `lib/sharepoint/*.ts`
> - File upload handler: `app/api/uploads/cloudinary/route.ts`

---

## Legend

| Status | Meaning |
|---|---|
| ✅ Done | Action no longer touches Prisma; all reads/writes go to SharePoint Lists. Documents are uploaded to the SharePoint Document Library. |
| 🟡 Hybrid | Action still calls `prisma.*` (parent `Request` row + child table), and only **mirrors** the parent record to SharePoint at submit time via `syncRequestParentToSharePoint`. Documents still go to Cloudinary. |
| 🔴 Pending | No SharePoint integration yet. |

---

## 1. Forms — Submit Flow Migration Status

There are **13 form types** wired through `app/submit/[channel]/[code]/`. Each form has a server action file in `_actions/` and a child table that holds form-specific fields.

| # | Form Code | Action File | Child SharePoint List | Cloudinary → SharePoint Drive | Status |
|---|---|---|---|---|---|
| 1 | **PBL** | `_actions/pbl.ts` | `PBL_REQUESTS_LIST_ID` + `PBL_BIDDERS_LIST_ID` | ✅ uploads to `/PBL/pbl_{requestId}/` | ✅ Done |
| 2 | **PP** | `_actions/pp.ts` | `PP_REQUESTS_LIST_ID` | ✅ uploads to `/PP/pp_{requestId}/` | ✅ Done |
| 3 | **RPP** | `_actions/rpp.ts` | `RPP_REQUESTS_LIST_ID` | ✅ uploads to `/RPP/rpp_{requestId}/` | ✅ Done |
| 4 | **RTP** | `_actions/rtp.ts` | `RTP_REQUESTS_LIST_ID` | ✅ uploads to `/RTP/rtp_{requestId}/` | ✅ Done |
| 5 | **VAP** | `_actions/vap.ts` | `VAP_REQUESTS_LIST_ID` | ✅ uploads to `/VAP/vap_{requestId}/` | ✅ Done |
| 6 | **PCCA** | `_actions/pcca.ts` | `PCCA_REQUESTS_LIST_ID` | ✅ uploads to `/PCCA/pcca_{requestId}/` | ✅ Done |
| 7 | **R-PCCA** (Revised PCCA) | reuses `_actions/pcca.ts` | `RPCCA_REQUESTS_LIST_ID` (separate from PCCA) | ✅ uploads to `/R-PCCA/r-pcca_{requestId}/` | ✅ Done |
| 8 | **OTHERS** | `_actions/others.ts` | `OTHERS_REQUESTS_LIST_ID` | ✅ uploads to `/OTHERS/others_{requestId}/` | ✅ Done |
| 9 | **CAA** | `_actions/caa.ts` | `CAA_REQUESTS_LIST_ID` | ✅ uploads to `/CAA/caa_{requestId}/` (final document **and** Project Organisation & Manpower Chart image) | ✅ Done |
| 10 | **CI** | `_actions/ci.ts` | `CI_REQUESTS_LIST_ID` | ✅ uploads to `/CI/ci_{requestId}/` | ✅ Done |
| 11 | **CPR** | `_actions/cpr.ts` | `CPR_REQUESTS_LIST_ID` | ✅ uploads to `/CPR/cpr_{requestId}/` | ✅ Done |
| 12 | **JVP** | `_actions/jvp.ts` | `JVP_REQUESTS_LIST_ID` | ✅ uploads to `/JVP/jvp_{requestId}/` | ✅ Done |
| 13 | **STSP** | `_actions/stsp.ts` | `STSP_REQUESTS_LIST_ID` | ✅ uploads to `/STSP/stsp_{requestId}/` | ✅ Done |

### CI and CPR now completed

CI and CPR are now fully SharePoint-native:

1. Base request creation writes directly to the SharePoint `Requests` list.
2. Child form details write to dedicated child lists (`CI_REQUESTS_LIST_ID`, `CPR_REQUESTS_LIST_ID`).
3. Final submission updates child file metadata columns and parent request status/acknowledgement in SharePoint.
4. Uploads are routed to SharePoint Drive folders (`/CI/ci_{requestId}/`, `/CPR/cpr_{requestId}/`) via `app/api/uploads/cloudinary/route.ts`.

No Mongo mirror/sync step is required for CI/CPR anymore.

### Note on CAA — first form with multiple file fields

CAA is the first migrated form that owns **two separate uploaded assets** on the same record:

1. **Project Organisation & Manpower Chart** (image) — uploaded at Step 4, persisted in the `organisationAndManpowerChart{Url,PublicId,FileName,MimeType,SizeBytes}` columns.
2. **Final Document** — uploaded at Step 9, persisted in the `document{Url,PublicId,FileName,MimeType,SizeBytes}` columns.

Both files are uploaded into the same SharePoint Drive folder (`/CAA/caa_{requestUuid}/`) and tracked separately by their Drive item IDs (`documentPublicId`). The DELETE handler in `app/api/uploads/cloudinary/route.ts` resolves which set of CAA columns to clear by matching the incoming `publicId` against both columns via `resolveCaaUploadedFieldByPublicId`.

> Two follow-ups remaining for CAA:
>
> - The SharePoint `CAA_Requests` list does not yet contain `loaDate`, `contractCommencementDate`, or `contractCompletionDate` columns. These three values are accepted by the form/validator but currently dropped on write (the SharePoint helper does not persist them). Add the columns to the list when ready.
> - `notifyRequestSubmissionByEmail` reads from MongoDB and is therefore not called from the new SharePoint-based CAA submit action (matching the other migrated forms). Email notifications for SharePoint-only forms should be migrated as a separate follow-up.

---

## 2. SharePoint Data Layer (`lib/sharepoint/`)

| File | Purpose | State |
|---|---|---|
| `lib/sharepoint/lists.ts` | Generic Graph CRUD helpers (`listItems`, `getItem`, `createItem`, `updateItem`, `deleteItem`) + typed helpers for `Users`, `Companies`, and `Roles` lists (`updateUser`, `findCompanyById`, `listRoles`, etc.). | ✅ Done |
| `lib/sharepoint/constants.ts` | List/file/field name constants. | ✅ Done |
| `lib/sharepoint/requests.ts` | `syncRequestParentToSharePoint(requestId)` — mirrors legacy Mongo parent `Request` into SharePoint when needed. | ✅ Done |
| `lib/sharepoint/pbl.ts` | Full PBL CRUD on SharePoint (base request, project details, bidders, submission, document clearing). | ✅ Done |
| `lib/sharepoint/pp.ts` | Full PP CRUD on SharePoint. | ✅ Done |
| `lib/sharepoint/rpp.ts` | Full RPP CRUD on SharePoint. | ✅ Done |
| `lib/sharepoint/rtp.ts` | Full RTP CRUD on SharePoint. | ✅ Done |
| `lib/sharepoint/vap.ts` | Full VAP CRUD on SharePoint. | ✅ Done |
| `lib/sharepoint/pcca.ts` | Full PCCA / R-PCCA CRUD on SharePoint (routes to separate child lists by request type: `PCCA_REQUESTS_LIST_ID` vs `RPCCA_REQUESTS_LIST_ID`). | ✅ Done |
| `lib/sharepoint/others.ts` | Full OTHERS CRUD on SharePoint. | ✅ Done |
| `lib/sharepoint/caa.ts` | Full CAA CRUD on SharePoint, including JSON-encoded table data, the Project Organisation & Manpower Chart asset, and the final document. Also exports `clearCaaDocumentByRequestUuid`, `clearCaaOrganisationChartByRequestUuid`, and `resolveCaaUploadedFieldByPublicId` for the upload route. | ✅ Done |
| `lib/sharepoint/ci.ts` | Full CI CRUD on SharePoint, including JSON-encoded composite details and document clear helper (`clearCiDocumentByRequestUuid`). | ✅ Done |
| `lib/sharepoint/cpr.ts` | Full CPR CRUD on SharePoint, including JSON-encoded composite details and document clear helper (`clearCprDocumentByRequestUuid`). | ✅ Done |
| `lib/sharepoint/jvp.ts` | Full JVP CRUD on SharePoint, including JSON-encoded dynamic/table fields and per-file metadata slots (`document`, `cashflowForecast`, `costStructure`) with targeted clear helpers for upload DELETE resolution. | ✅ Done |
| `lib/sharepoint/stsp.ts` | Full STSP CRUD on SharePoint, including JSON-encoded dynamic/table fields and per-file metadata slots (`document`, `contractStructure`, `revenueVsCost`, `cashflow`) with targeted clear helpers for upload DELETE resolution. | ✅ Done |
| `lib/sharepoint/engagements.ts` | Engagement slots lock/release, request lookup by `uuid`, engagements CRUD, booking payload mapping for `/book-engagement` + admin engagement APIs. | ✅ Done |
| `lib/sharepoint/request-resolve.ts` | Resolve `Requests` rows by route param (`id` / `uuid` / `requestNo`), company access helpers. | ✅ Done |
| `lib/sharepoint/request-bundle.ts` | Loads parent request + RTP/PBL/JVP/projects/bidders joins for endorsement & acknowledgement loaders. | ✅ Done |
| `lib/sharepoint/working-gcp-suggestions.ts` | Reviewer + Working GCPC suggestions (`WORKING_GCP_SUGGESTIONS_LIST_ID`). | ✅ Done |
| `lib/sharepoint/signatories.ts` | Signatory members + request signatures (`SIGNATORY_MEMBERS_LIST_ID`, `REQUEST_SIGNATURES_LIST_ID`). | ✅ Done |

`lib/graph.ts` provides the Graph client + `getSiteId()` / `getDriveId()` helpers using `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` and `SHAREPOINT_SITE_ID` / `SHAREPOINT_DRIVE_ID`.

---

## 3. Cloudinary → SharePoint Document Library Migration

The unified upload handler is `app/api/uploads/cloudinary/route.ts`.

### POST (upload)

Routed to **SharePoint Drive** via `getDriveId()` for these `requestType`s:

```
RTP, PBL, JVP, STSP, PP, PCCA, R-PCCA, VAP, RPP, OTHERS, CAA, CPR, CI
```

For everything else (unknown/unmigrated `requestType`), the file is uploaded to **Cloudinary** through `uploadToCloudinary` from `lib/cloudinary.ts`.

### DELETE (clear uploaded file)

| Request Type | Where the document lives | Clear handler |
|---|---|---|
| RTP | SharePoint Drive | `clearRtpDocumentByRequestUuid` |
| PBL | SharePoint Drive | `clearPblDocumentByRequestUuid` |
| PP | SharePoint Drive | `clearPpDocumentByRequestUuid` |
| RPP | SharePoint Drive | `clearRppDocumentByRequestUuid` |
| VAP | SharePoint Drive | `clearVapDocumentByRequestUuid` |
| PCCA / R-PCCA | SharePoint Drive | `clearPccaDocumentByRequestUuid` |
| OTHERS | SharePoint Drive | `clearOthersDocumentByRequestUuid` |
| CAA | SharePoint Drive | Resolves which CAA column owns the deleted Drive item via `resolveCaaUploadedFieldByPublicId`, then calls **either** `clearCaaDocumentByRequestUuid` (final document) **or** `clearCaaOrganisationChartByRequestUuid` (Org & Manpower Chart). |
| JVP | SharePoint Drive | Resolves JVP file slot by Drive item ID via `resolveJvpUploadedFieldByPublicId`, then clears **document**, **cashflowForecast**, or **costStructure** metadata columns. |
| STSP | SharePoint Drive | Resolves STSP file slot by Drive item ID via `resolveStspUploadedFieldByPublicId`, then clears **document**, **contractStructure**, **revenueVsCost**, or **cashflow** metadata columns. |
| CPR | SharePoint Drive | `clearCprDocumentByRequestUuid` |
| CI | SharePoint Drive | `clearCiDocumentByRequestUuid` |

---

## 4. Pages & APIs Already on SharePoint

| Area | File | Notes |
|---|---|---|
| Requests list page | `app/requests/page.tsx` | Reads from SharePoint `Requests` list via `listItems`. |
| Request detail page | `app/requests/[id]/page.tsx` | Reads parent + per-form child lists via `listItems`. |
| Verifier comment | `app/api/requests/[id]/verifier-comment/route.ts` | Updates SharePoint `Requests`: `verificationComment`, request `status`, `verifiedOn` (ISO timestamp), and `verifiedByLookupId` (lookup to **Users** item id). |
| Draft Review (decision code) | `app/api/requests/[id]/draft-review/route.ts` | SharePoint only. |
| Pending Review | `app/api/requests/[id]/pending-review/route.ts` | SharePoint only. |
| Complete Review | `app/api/requests/[id]/complete-review/route.ts` | SharePoint only. |
| Working GCPC | `app/api/requests/[id]/working-gcpc/route.ts` | SharePoint only. |
| Book engagement | `app/api/requests/[id]/book-engagement/route.ts` | SharePoint `Requests`, `EngagementSlots`, `Engagements` lists via `lib/sharepoint/engagements.ts`. |
| Admin engagement management | `app/api/admin/engagement-management/route.ts`, `app/api/admin/engagement-management/[engagementId]/route.ts` | SharePoint only. |
| Cloudinary upload route | `app/api/uploads/cloudinary/route.ts` | Routes to SharePoint Drive for migrated request types. |
| Companies API | `app/api/company/route.ts` | Fully on SharePoint (`createCompany`, `findCompanyByCode`, `listCompanies`). Also seeds `Companies` list from `prisma/company-records.json` on first GET. |
| Reviewer / Working GCPC suggestions | `app/api/requests/[id]/reviewer-suggestion/route.ts` | SharePoint list `WORKING_GCP_SUGGESTIONS_LIST_ID` via `lib/sharepoint/working-gcp-suggestions.ts`. |
| Review acceptance | `app/api/requests/[id]/review-acceptance/route.ts` | SharePoint `Requests` + loaders in `src/lib/requests/review-acceptance-load.ts`. |
| Endorsement | `app/api/requests/[id]/endorsement/route.ts` | SharePoint `Requests`; data from `src/lib/requests/endorsement-load.ts`. |
| Acknowledgement | `app/api/requests/[id]/acknowledgement/route.ts` | SharePoint `Requests`; data from `src/lib/requests/acknowledgement-load.ts`. |
| Request signatures | `app/api/requests/[id]/signatures/route.ts` | SharePoint `REQUEST_SIGNATURES_LIST_ID` + `Requests` status updates. |
| Admin signatories | `app/api/admin/signatory-members/route.ts`, `[id]/route.ts` | SharePoint `SIGNATORY_MEMBERS_LIST_ID` + signature counts on `REQUEST_SIGNATURES_LIST_ID`. |

---

## 5. Remaining Prisma usage (outside `app/api/` routes)

All **`app/api/**` route handlers** have been migrated off `@/lib/prisma`. Prisma still appears in legacy helpers and sync paths, for example:

- `lib/sharepoint/requests.ts` — `syncRequestParentToSharePoint` (Mongo mirror for unmigrated flows).
- `lib/request-no.ts`, `lib/project-code.ts`, `lib/email/request-notifications.ts`.
- `src/lib/requests/ensure-complete-review-from-signatures.ts`.
- Some pages under `app/requests/[id]/` (e.g. `review/page.tsx`, `verify/page.tsx`) still query Prisma directly.

Remove Prisma once those call sites are migrated or retired (see §7 Cleanup).

### Admin pages on SharePoint

- `app/admin/signatories/page.tsx` uses `/api/admin/signatory-members` (SharePoint-backed).
- `app/admin/engagement-slots/page.tsx`, `app/admin/engagement-management/page.tsx` — SharePoint-backed APIs.

`/admin/roles`:

- `app/admin/roles/page.tsx` reads `Users`, `Companies`, and `Roles` from SharePoint via `lib/sharepoint/lists.ts`.
- `app/admin/roles/actions.ts` updates user roles/active status and creates new users directly in SharePoint `Users` list.

---

## 6. SharePoint Lists Configured (`.env.local`)

Already provisioned and in use:

```
SHAREPOINT_SITE_ID, SHAREPOINT_DRIVE_ID
COMPANIES_LIST_ID, USERS_LIST_ID, REQUESTS_LIST_ID, PROJECTS_LIST_ID
RTP_REQUESTS_LIST_ID
PBL_REQUESTS_LIST_ID, PBL_BIDDERS_LIST_ID
PP_REQUESTS_LIST_ID, RPP_REQUESTS_LIST_ID
PCCA_REQUESTS_LIST_ID
RPCCA_REQUESTS_LIST_ID
VAP_REQUESTS_LIST_ID
OTHERS_REQUESTS_LIST_ID
CAA_REQUESTS_LIST_ID
JVP_REQUESTS_LIST_ID
STSP_REQUESTS_LIST_ID
CI_REQUESTS_LIST_ID
CPR_REQUESTS_LIST_ID
ROLES_LIST_ID
ENGAGEMENT_SLOTS_LIST_ID
ENGAGEMENTS_LIST_ID
WORKING_GCP_SUGGESTIONS_LIST_ID
SIGNATORY_MEMBERS_LIST_ID
REQUEST_SIGNATURES_LIST_ID
```

Optional / not required by current API code:

```
VERIFIER_COMMENTS_LIST_ID
```

### Engagements list — lookup columns and `notes` (booking)

Booking and admin flows use `lib/sharepoint/engagements.ts`. **Create/update** writes these Microsoft Graph field names (they map to your SharePoint lookup columns):

| Purpose | Graph write field | Resolves to |
|---|---|---|
| Link to request row | `requestIdLookupId` | **Requests** list item id |
| Link to booked slot | `slotIdLookupId` | **EngagementSlots** list item id |
| Link to booker | `requestorIdLookupId` | **Users** list item id |

Other engagement fields used include `Title`, `uuid`, `engagementNumber`, `name`, `type`, `location`, `status`, and **`notes`**.

**`notes` must contain only user-entered text** from the booking UI. The app does **not** embed JSON or internal metadata in `notes`.

When reading list items, Graph may expose lookup ids as `requestIdLookupId`, `slotIdLookupId`, `requestorIdLookupId`. Legacy plain-text columns on older rows (if any) are still tolerated when resolving engagements by request.

**EngagementSlots** should include a `status` column (`available` / `booked`) used when locking slots during booking and reschedule.

> `SHAREPOINT_ENGAGEMENT_FIELDS` in `lib/sharepoint/constants.ts` may still list legacy single-line names (`requestUuid`, `slotItemId`, `requestorUserId`); **writes** for new bookings use the `…LookupId` fields above. Align constants with SharePoint when convenient.

### Working GCP suggestions list (`WORKING_GCP_SUGGESTIONS_LIST_ID`)

Stores **both** reviewer suggestions and Working GCPC suggestions (`sourceRole`: `reviewer` | `working_gcpc`). Code expects these columns (Graph / internal names — align with your list):

| Field | Purpose |
|---|---|
| `Title` | Short title (first line of suggestion). |
| `suggestionText` | Full suggestion body (multiline). |
| `reviewerName` | Display name of submitter. |
| `sourceRole` | `reviewer` or `working_gcpc`. |
| `reviewStatus` | `pending` or `reviewed`. |
| `reviewAction` | `accepted`, `no_need`, or `pending` (verifier/admin PATCH). |
| `requestIdLookupId` | Lookup to **Requests** item id. |
| `submitterLookupId` | Lookup to **Users** item id (submitter). |

### Signatory members (`SIGNATORY_MEMBERS_LIST_ID`)

| Field | Purpose |
|---|---|
| `Title` | Member display name. |
| `signatoryGroup` | `prepared` or `confirmed` (legacy Mongo field was `group`). |
| `email`, `emailLower` | Contact email. |
| `sortOrder` | Ordering within the group. |

### Request signatures (`REQUEST_SIGNATURES_LIST_ID`)

| Field | Purpose |
|---|---|
| `Title` | Optional label. |
| `requestIdLookupId` | **Requests** item id. |
| `signatoryMemberLookupId` | **Signatory members** item id. |
| `signatoryName`, `signatoryEmail`, `signatoryEmailLower` | Snapshot at signing time. |
| `signatureGroup` | `prepared` or `confirmed`. |
| `signUrl`, `signPublicId` | Signature image references. |
| `signedAt` | ISO timestamp. |
| `signerUserLookupId` | **Users** item id of signer. |

---

## 7. What's Remaining

### Forms

- ✅ All 13 submit forms are now migrated to SharePoint lists + SharePoint document library.

### Post-Submit & Admin APIs (`app/api/`)

- ✅ Signatures, reviewer / Working GCPC suggestions, review acceptance, endorsement, acknowledgement — SharePoint (see §4).
- ✅ Admin signatory members CRUD — SharePoint.
- ✅ Verifier comment, book engagement, admin engagement APIs — SharePoint (unchanged).

### Non-API code still using Prisma

- 🔴 Pages and libs listed in §5 (`ensure-complete-review-from-signatures`, some `app/requests/[id]/*` pages, `syncRequestParentToSharePoint`, etc.).

### Cleanup (after Prisma fully retired)

- 🔴 Remove the legacy Cloudinary DELETE branches in `app/api/uploads/cloudinary/route.ts`.
- 🔴 Remove `lib/cloudinary.ts` usage and the Cloudinary env vars (`CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`).
- 🔴 Remove Prisma client and `prisma/schema.prisma` once nothing imports `@/lib/prisma`.
- 🔴 Drop the `MONGODB_URI` env var.
- 🔴 Rename the upload route from `app/api/uploads/cloudinary/route.ts` to something like `app/api/uploads/document/route.ts` once Cloudinary is gone.

---

## 8. Summary Snapshot

| Layer | Done | Remaining |
|---|---|---|
| Submit forms | 13 / 13 | 0 / 13 |
| File storage per form | 13 / 13 on SharePoint Drive | 0 / 13 on Cloudinary |
| Request listing & detail pages | ✅ | — |
| Verifier / Reviewer / Working GCPC review APIs | ✅ | — |
| Companies & Users data | ✅ | — |
| Post-submit lifecycle APIs (`app/api/` — signatures, endorsement, ack, suggestions, review acceptance) | ✅ | — |
| Admin APIs | ✅ (reviewers, engagement, signatories, roles) | — |
| Admin pages (roles, signatories, engagement slots/management) | ✅ | — |
| Remove Prisma globally | — | 🔴 libs + select pages (§5) |
