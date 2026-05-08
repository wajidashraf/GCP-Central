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
| `lib/sharepoint/lists.ts` | Generic Graph CRUD helpers (`listItems`, `getItem`, `createItem`, `updateItem`, `deleteItem`) + typed helpers for `Users` and `Companies` lists. | ✅ Done |
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
| Verifier comment | `app/api/requests/[id]/verifier-comment/route.ts` | Updates SharePoint via `listItems` + `updateItem`. |
| Draft Review (decision code) | `app/api/requests/[id]/draft-review/route.ts` | SharePoint only. |
| Pending Review | `app/api/requests/[id]/pending-review/route.ts` | SharePoint only. |
| Complete Review | `app/api/requests/[id]/complete-review/route.ts` | SharePoint only. |
| Working GCPC | `app/api/requests/[id]/working-gcpc/route.ts` | SharePoint only. |
| Cloudinary upload route | `app/api/uploads/cloudinary/route.ts` | Routes to SharePoint Drive for migrated request types. |
| Companies API | `app/api/company/route.ts` | Fully on SharePoint (`createCompany`, `findCompanyByCode`, `listCompanies`). Also seeds `Companies` list from `prisma/company-records.json` on first GET. |

---

## 5. APIs Still on MongoDB (need migration)

These route handlers still import `@/lib/prisma`:

- `app/api/requests/[id]/book-engagement/route.ts`
- `app/api/requests/[id]/review-acceptance/route.ts`
- `app/api/requests/[id]/acknowledgement/route.ts`
- `app/api/requests/[id]/endorsement/route.ts`
- `app/api/requests/[id]/signatures/route.ts`
- `app/api/requests/[id]/reviewer-suggestion/route.ts`
- `app/api/admin/reviewers/route.ts`
- `app/api/admin/signatory-members/route.ts`
- `app/api/admin/signatory-members/[id]/route.ts`
- `app/api/admin/engagement-management/route.ts`
- `app/api/admin/engagement-management/[engagementId]/route.ts`
- `app/api/admin/engagement-slots/route.ts`

These are mostly **post-submission lifecycle** endpoints (engagement booking, signatures, endorsement, acknowledgement) and **admin-side** endpoints (reviewers, signatories, engagement slots). They need their own SharePoint lists before they can be migrated.

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
```

Not yet defined / planned:

```
SIGNATORY_MEMBERS_LIST_ID, REVIEWER_SUGGESTIONS_LIST_ID
VERIFIER_COMMENTS_LIST_ID, REQUEST_SIGNATURES_LIST_ID
ENGAGEMENT_SLOTS_LIST_ID, ENGAGEMENTS_LIST_ID
```

---

## 7. What's Remaining

### Forms

- ✅ All 13 submit forms are now migrated to SharePoint lists + SharePoint document library.

### Post-Submit & Admin APIs

- 🔴 Migrate signatures, reviewer suggestions, book engagement, review acceptance, endorsement, acknowledgement endpoints to SharePoint lists.
- 🔴 Migrate admin endpoints (reviewers, signatory members, engagement management, engagement slots) to SharePoint lists.

### Cleanup (after all forms are migrated)

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
| Post-submit lifecycle APIs (signatures, engagement, endorsement, ack) | — | 🔴 All |
| Admin APIs (reviewers, signatories, engagement) | — | 🔴 All |
