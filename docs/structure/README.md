# Codebase Structure Guide

This guide helps you quickly find where code lives and what each area is for.

## Top-Level Folders

- `app/` - Next.js App Router pages and API routes.
- `src/components/` - Reusable UI/components used by pages.
- `src/lib/` - App-facing helpers (auth/session/request loaders).
- `lib/` - Server utilities (SharePoint, Graph, Prisma, validation, email).
- `prisma/` - Seed/source JSON files and Prisma schema.
- `public/` - Static assets.
- `docs/` - Internal docs and integration notes.
- `scripts/` - Utility scripts.

## App Router (`app/`)

- `app/page.tsx` - Home page.
- `app/login/` - Login UI.
- `app/dashboard/` - Dashboard page.
- `app/requests/` - Request listing and request detail flow.
- `app/submit/` - Request submission flow.
- `app/admin/` - Admin pages (roles, signatories, engagement management).
- `app/api/` - Server endpoints (auth, request actions, admin actions, company).

See `docs/structure/ROUTES.md` for a route-by-route map.

## API Organization (`app/api/`)

- `app/api/auth/` - NextAuth route handlers.
- `app/api/company/route.ts` - Company CRUD + one-time company seed-on-empty logic.
- `app/api/requests/[id]/...` - Request lifecycle APIs (review, verify, endorse, signatures).
- `app/api/admin/...` - Admin operations (slots, signatories, engagement management).
- `app/api/uploads/...` - Upload/signature upload related endpoints.

## SharePoint + Data Access

- `lib/sharepoint/lists.ts` - Reusable SharePoint list CRUD/query helpers.
- `lib/sharepoint/constants.ts` - SharePoint field/file constants.
- `lib/graph.ts` - Microsoft Graph client bootstrap.
- `src/lib/auth/auth.config.ts` - Credentials auth using SharePoint users list.

## Validation + Domain Rules

- `lib/validations/*.ts` - Zod schemas for each request type and company.
- `src/constants/enums/` - Enum/config option sources used in forms.

## UI Components

- `src/components/forms/` - Form renderer, field components, upload previews.
- `src/components/sections/` - Request detail/section-level UI.
- `src/components/modals/` - Review/verify/signing dialogs.
- `src/components/layout/` - App shell/header/footer.
- `src/components/ui/` - Core design-system style components (`button`, icons, helpers).

## How to Find Code Fast

1. **Page behavior issue** -> start in `app/<route>/page.tsx`.
2. **Submit/requests business logic** -> check `app/api/requests/...` and `src/lib/requests/...`.
3. **Auth/user access issue** -> `src/lib/auth/` + `lib/sharepoint/lists.ts`.
4. **Field validation issue** -> `lib/validations/`.
5. **Dropdown/enum option issue** -> `src/constants/enums/`.

