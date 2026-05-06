# SharePoint List Import — Instructions

Two CSV files are in this folder. Import **Companies first**, then **Users**.

---

## Step-by-step Import

1. Go to your SharePoint site:
   `https://yourtenant.sharepoint.com/sites/GCPCentral`

2. Click **+ New** → **List**

3. Choose **From CSV** (or "From Excel" if using the .xlsx option)

4. Upload the CSV file → SharePoint shows a column preview

5. **Set column types** before finishing (see tables below)

6. Click **Create**

---

## File 1: `companies_list.csv`

Name the list exactly: **`Companies`**

| Column Header | Set SharePoint Type To |
|---|---|
| `Title` | Single line of text |
| `companyCode` | Single line of text |
| `sector` | Single line of text |

> After import, go to **List settings → Indexed columns** and add an index on `companyCode`.

---

## File 2: `users_list.csv`

Name the list exactly: **`Users`**

| Column Header | Set SharePoint Type To | Notes |
|---|---|---|
| `Title` | Single line of text | Full display name |
| `email` | Single line of text | |
| `emailLower` | Single line of text | Lowercase — used for login lookup |
| `username` | Single line of text | |
| `usernameLower` | Single line of text | Lowercase — used for login lookup |
| `passwordHash` | Multiple lines of text | Plain text mode |
| `entraId` | Single line of text | Fill after Azure setup |
| `primaryRole` | Single line of text | Will convert to Choice column later |
| `roles` | Multiple lines of text | Stores JSON e.g. `["requestor"]` |
| `companyCode` | Single line of text | |
| `companyName` | Single line of text | |
| `isActive` | Yes/No | SharePoint may auto-detect from Yes/No values |

> After import, go to **List settings → Indexed columns** and add indexes on:
> - `emailLower`
> - `usernameLower`
> - `isActive`

---

## Filling in Real Data

Replace the sample rows with your actual users/companies.

**For Users:**
- `emailLower` must be the **exact lowercase copy** of `email`
- `usernameLower` must be the **exact lowercase copy** of `username`
- `passwordHash` — leave blank for now (users will sign in via Microsoft)
- `entraId` — leave blank until you create Azure AD accounts for each user
- `roles` must be valid JSON wrapped in double quotes:
  - Single role: `"[""requestor""]"`
  - Multiple roles: `"[""verifier"",""reviewer""]"`
- `isActive` — use `Yes` or `No`

**Valid `primaryRole` values:**
- `requestor`
- `verifier`
- `reviewer`
- `working_gcpc`
- `hoc`
- `endorser`
- `main_committee`
- `admin`

---

## After Import — Manual Column Tweaks

SharePoint CSV import creates all columns as "Single line of text" by default.
You may need to manually change:

| Column | Change To |
|---|---|
| `isActive` | Yes/No |
| `passwordHash` | Multiple lines of text |
| `roles` | Multiple lines of text |

To change column type: **List settings → click column name → change type**.
