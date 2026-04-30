# GCP Central — Request Detail Page: App Flow

This document describes all business logic and workflow steps implemented on the **Request Detail page** (`app/requests/[id]/page.tsx`). It is intended as a reference for new developers joining the project.

---

## Page Overview

**Route:** `/requests/[id]`
**File:** `app/requests/[id]/page.tsx`

The page is a **server component** that:
1. Fetches the request record from the database (including related `rtp`, `pbl`, `jvp`, `verifierComment`, `reviewerSuggestions`, `signatures`).
2. Determines the current user's roles.
3. Renders the request data sections.
4. Passes data to `RequestActionsSection` (client component) which controls which action buttons are visible.

---

## Role Definitions

| Role | Description |
|---|---|
| `verifier` | Can verify data for New requests |
| `reviewer` | Reviews requests, adds decision codes, changes to Pending Review |
| `working_gcpc` | Can submit suggestions on Draft Review requests |
| `requestor` | Can book engagements |
| `admin` | Can perform any action |
| `hoc` | Can move to Pending Acceptance, open Endorsement / Acknowledgement |

---

## Request Status Lifecycle

```
New
 │
 ▼ (Verifier verifies → selects new status)
FR / RS / Ready for Engagement / W / Pending Ack
 │
 ▼ (Requestor / Admin books engagement)
Ready for Engagement
 │
 ▼ (System / Admin)
R  (In Review)
 │
 ▼ (Reviewer adds decision code)
Draft Review
 │
 ▼ (Working GCPC submits suggestions; Reviewer reviews)
Pending Review
 │
 ▼ (Signatory group signs)
Complete Review
 │
 ▼ (HoC / Admin)
Pending Acceptance → Complete Acceptance
Pending Ack → ACK
Pending Endorse → E
```

---

## Step-by-Step Workflow

---

### Step 1 — Verifier: Verify Data

**File:** `src/components/sections/request-actions-section.tsx`
**API:** `POST /api/requests/[id]/verifier-comment`
**Modal:** `src/components/modals/verify-modal.tsx`

**Condition for button visibility:**
- User has role `verifier` (or `admin`)
- Request status is `New`
- For RTP requests: status can be `New` or `RS`

**Button:** "Verify Data"

**User flow:**
1. Verifier clicks "Verify Data".
2. Modal opens with:
   - **Dropdown**: select the new request status (options depend on `requestType` and `isSpecialProject`).
   - **Textarea**: enter a verification comment.
3. On submit, `POST /api/requests/[id]/verifier-comment` is called with `{ comment, requestStatus }`.
4. API saves the comment to the `verifierComment` table (`verifierCommentText` field) and updates the request `status` to the selected value.

**Note:** Only `Requestor` and `Admin` roles can book an engagement. The Verifier's job ends after verification.

---

### Step 2 — Reviewer: Add Decision Code (Initial Review)

**File:** `src/components/sections/request-actions-section.tsx`
**API:** `POST /api/requests/[id]/draft-review`
**Modal:** `src/components/modals/add-decision-modal.tsx`

**Condition for button visibility:**
- User has role `reviewer` (or `admin`)
- Request status is `R`

**Button:** "Add Decision Code"

**User flow:**
1. Reviewer clicks "Add Decision Code".
2. Modal opens with:
   - **Rich-text editor**: enter the review comment (supports lists, tables, images).
   - **Radio buttons**: select a decision code (1–5, options vary by `requestType`).
3. On submit, `POST /api/requests/[id]/draft-review` is called with `{ comment, decisionCode }`.
4. API (`app/api/requests/[id]/draft-review/route.ts`):
   - Validates user is a reviewer or admin.
   - Validates decision code is valid for the request type.
   - Parses the HTML comment to extract:
     - `reviewerCommentList` — bullet list items
     - `reviewerCommentTable` — table key-value pairs
     - `reviewerCommentUrls` — image URLs
   - Sets `reviewConclusionCode1a/1b/2/3/4` flags based on the decision code:
     - Code `1` → `reviewConclusionCode1a = true`
     - Code `2` → `reviewConclusionCode2 = true`
     - Code `3` → `reviewConclusionCode3 = true`
     - Code `4` → `reviewConclusionCode4 = true`
     - Code `5` → `reviewConclusionCode1b = true`
   - Updates `request.status` → `Draft Review`.
   - Saves `reviewerCommentText`, `reviewerDecisionCode`, `reviewedBy`, `reviewedAt`.
5. **Email notification**: An automated email is sent to all active `working_gcpc` users notifying them to log in and review the request.

---

### Step 3 — Working GCPC: Submit Suggestion

**File:** `src/components/sections/request-actions-section.tsx`
**API:** `POST /api/requests/[id]/reviewer-suggestion` with `{ suggestion, sourceRole: 'working_gcpc' }`
**Modal:** `src/components/modals/review-modal.tsx`

**Condition for button visibility:**
- User has role `working_gcpc` (or `admin`)
- Request status is `Draft Review`

**Button:** "Add Suggestion"

**User flow:**
1. Working GCPC user clicks "Add Suggestion".
2. Modal opens with a text area to enter their suggestion.
3. On submit, `POST /api/requests/[id]/reviewer-suggestion` is called with `{ suggestion, sourceRole: 'working_gcpc' }`.
4. API (`app/api/requests/[id]/reviewer-suggestion/route.ts`):
   - Validates user is `working_gcpc` or `admin`.
   - Validates request is in `Draft Review` status (working GCPC suggestions are only allowed in this state).
   - Creates a `ReviewerSuggestion` record with `sourceRole = 'working_gcpc'`.
5. **Email notification**: An automated email is sent to **all active `reviewer` users** containing:
   - Prompt: "A Working GCPC user has added a suggestion regarding the request data. Please review."
   - Request details (No, Title, Type, Company).
   - The full suggestion text.
   - The name of the user who submitted it.

**Visibility of suggestions on the page:**
- `reviewer`, `verifier`, `admin` → can see reviewer-sourced suggestions.
- `working_gcpc`, `verifier` → can see Working GCPC suggestions.

---

### Step 4 — Reviewer: Change to Pending Review

**File:** `src/components/sections/request-actions-section.tsx`
**API:** `POST /api/requests/[id]/pending-review`

**Condition for button visibility:**
- User has role `reviewer` (or `admin`)
- Request status is `Draft Review`
- At least **1 Working GCPC suggestion** exists on the request

**Button:** "Change to Pending Review"

**User flow:**
1. Reviewer clicks "Change to Pending Review".
2. `POST /api/requests/[id]/pending-review` is called (no body needed).
3. API (`app/api/requests/[id]/pending-review/route.ts`):
   - Validates user is `reviewer` or `admin`.
   - Confirms request status is `Draft Review`.
   - Confirms there is at least 1 suggestion with `sourceRole = 'working_gcpc'`.
   - Updates `request.status` → `Pending Review`.
4. **Email notification**: An automated email is sent to **all members of the Signatory Group** (all records in the `SignatoryMember` table) notifying them to log in and sign.

---

### Step 5 — Signatory Group: Digital Signatures

**File:** `src/components/sections/request-signature-section.tsx`
**API:** `POST /api/requests/[id]/signatures`
**Modal:** `src/components/modals/sign-signature-modal.tsx`

**Condition for section visibility:**
- Request type is NOT RTP
- Request status is **not** one of:
  - `FR`
  - `New`
  - `Ready for Engagement`
  - `R`
  - `Draft Review`
  - `RS`

**User flow:**
1. Signature section becomes visible on the request detail page.
2. Signatory members (from `SignatoryMember` table, split into `prepared` and `confirmed` groups) can sign within their respective sections.
3. Each member clicks the sign button, uploads/draws their signature.
4. `POST /api/requests/[id]/signatures` is called with the signature image URL.
5. Once all required signatures are collected, the request status automatically transitions to `Complete Review` (handled by `src/lib/requests/ensure-complete-review-from-signatures.ts`).

**Access:** Up to and including this step, anyone with general access can view the Request Detail page.

---

### Step 6 — HoC / Admin: Accept Review

**File:** `src/components/sections/request-actions-section.tsx`
**Route:** `/requests/[id]/review-acceptance`

**Condition for button visibility:**
- User has role `admin` or `hoc`
- Request status is `Complete Review`

**Button:** "Accept Review"

Navigates to the review acceptance page.

---

### Step 7 — HoC / Admin: Endorsement

**Condition for button visibility:**
- User has role `admin` or `hoc`
- Request status is `Pending Endorse`

**Button:** "ENDORSEMENT"

Navigates to `/requests/[id]/endorsement`.

---

### Step 8 — HoC / Admin: Acknowledgement

**Condition for button visibility:**
- User has role `admin` or `hoc`
- Request status is `Pending Ack`

**Button:** "Acknowledgement"

Navigates to `/requests/[id]/acknowledgement`.

---

### Step 9 — Requestor / Admin: Book Engagement

**Condition for button visibility:**
- User has role `requestor` (or `admin`)
- Request status is `Ready for Engagement`

**Button:** "Book Engagement"

Navigates to `/requests/[id]/book-engagement`.

---

## Action Button Summary

| Button | Shown When | Who Can See |
|---|---|---|
| Verify Data | Status = `New` (or `RS` for RTP) | Verifier, Admin |
| Add Decision Code | Status = `R` | Reviewer, Admin |
| Add Suggestion | Status = `Draft Review` | Working GCPC, Admin |
| Change to Pending Review | Status = `Draft Review` AND ≥1 Working GCPC suggestion | Reviewer, Admin |
| Book Engagement | Status = `Ready for Engagement` | Requestor, Admin |
| Accept Review | Status = `Complete Review` | HoC, Admin |
| ENDORSEMENT | Status = `Pending Endorse` | HoC, Admin |
| Acknowledgement | Status = `Pending Ack` | HoC, Admin |

---

## Email Notification Summary

| Trigger | Recipients | Content |
|---|---|---|
| Reviewer submits decision (Draft Review) | All active `working_gcpc` users | Request details + reviewer name |
| Working GCPC submits suggestion | All active `reviewer` users | Request details + suggestion text + submitter name |
| Reviewer changes to Pending Review | All `SignatoryMember` records | Request details + call to sign |
| Request submitted | Requestor | Submission confirmation |

---

## Key Files Reference

| File | Purpose |
|---|---|
| `app/requests/[id]/page.tsx` | Main server component; fetches data, determines roles, renders page |
| `src/components/sections/request-actions-section.tsx` | Client component; controls action button visibility and handles submissions |
| `src/components/modals/verify-modal.tsx` | Verifier modal (status dropdown + comment) |
| `src/components/modals/add-decision-modal.tsx` | Reviewer decision modal (rich-text + decision code radio) |
| `src/components/modals/review-modal.tsx` | Generic suggestion modal (used for Working GCPC and Reviewer suggestions) |
| `src/components/sections/general-review-section.tsx` | Displays verifier comment, reviewer comment, and suggestion lists |
| `src/components/sections/request-signature-section.tsx` | Displays signature section for Signatory Group |
| `src/components/modals/sign-signature-modal.tsx` | Signature upload modal |
| `app/api/requests/[id]/verifier-comment/route.ts` | Saves verifier comment and updates status |
| `app/api/requests/[id]/draft-review/route.ts` | Saves reviewer decision, updates status to Draft Review, emails Working GCPC |
| `app/api/requests/[id]/reviewer-suggestion/route.ts` | Creates suggestion; emails reviewers when Working GCPC submits |
| `app/api/requests/[id]/pending-review/route.ts` | Moves request to Pending Review; emails Signatory Group |
| `app/api/requests/[id]/signatures/route.ts` | Saves digital signature records |
| `app/api/requests/[id]/review-acceptance/route.ts` | Moves request to Pending Acceptance |
| `app/api/requests/[id]/endorsement/route.ts` | Handles endorsement flow |
| `app/api/requests/[id]/acknowledgement/route.ts` | Handles acknowledgement flow |
| `app/api/requests/[id]/book-engagement/route.ts` | Books engagement for a request |
| `src/constants/enums/requestStatus.ts` | All status labels and their numeric values |
| `src/constants/reviewerDecisionCodes.ts` | Valid decision codes per request type |
| `lib/email/email-service.ts` | Core email sending via Nodemailer |
| `lib/email/email-templates.ts` | HTML email template builders |
| `lib/email/request-notifications.ts` | Request submission notification helper |
| `src/lib/requests/ensure-complete-review-from-signatures.ts` | Auto-promotes to Complete Review when all signatures are collected |
| `prisma/schema.prisma` | Database schema (Request, ReviewerSuggestion, VerifierComment, SignatoryMember, RequestSignature) |
