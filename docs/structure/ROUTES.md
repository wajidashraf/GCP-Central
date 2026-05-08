# Route Map

Quick map of major pages and APIs.

## Pages

- `/` -> `app/page.tsx`
- `/login` -> `app/login/page.tsx`
- `/dashboard` -> `app/dashboard/page.tsx`
- `/submit` -> `app/submit/page.tsx`
- `/submit/[channel]/[code]` -> `app/submit/[channel]/[code]/page.tsx`
- `/requests` -> `app/requests/page.tsx`
- `/requests/[id]` -> `app/requests/[id]/page.tsx`
- `/requests/[id]/acknowledgement` -> `app/requests/[id]/acknowledgement/page.tsx`
- `/requests/[id]/review` -> `app/requests/[id]/review/page.tsx`
- `/requests/[id]/verify` -> `app/requests/[id]/verify/page.tsx`
- `/requests/[id]/endorsement` -> `app/requests/[id]/endorsement/page.tsx`
- `/requests/[id]/review-acceptance` -> `app/requests/[id]/review-acceptance/page.tsx`
- `/requests/[id]/book-engagement` -> `app/requests/[id]/book-engagement/page.tsx`
- `/admin` -> `app/admin/page.tsx`
- `/admin/roles` -> `app/admin/roles/page.tsx`
- `/admin/signatories` -> `app/admin/signatories/page.tsx`
- `/admin/engagement-slots` -> `app/admin/engagement-slots/page.tsx`
- `/admin/engagement-management` -> `app/admin/engagement-management/page.tsx`

## Key APIs

- `/api/auth/[...nextauth]` -> NextAuth handlers
- `/api/company` -> company create/list + seed-on-empty behavior
- `/api/requests/[id]/acknowledgement`
- `/api/requests/[id]/pending-review`
- `/api/requests/[id]/draft-review`
- `/api/requests/[id]/review-acceptance`
- `/api/requests/[id]/working-gcpc`
- `/api/requests/[id]/endorsement`
- `/api/requests/[id]/signatures`
- `/api/requests/[id]/verifier-comment`
- `/api/requests/[id]/reviewer-suggestion`
- `/api/requests/[id]/book-engagement`
- `/api/requests/[id]/complete-review`
- `/api/admin/signatory-members`
- `/api/admin/reviewers`
- `/api/admin/engagement-slots`
- `/api/admin/engagement-management`
- `/api/uploads/cloudinary`
- `/api/uploads/cloudinary-signature`
