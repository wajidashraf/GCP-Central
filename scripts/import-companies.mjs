/**
 * import-companies.mjs
 *
 * Bulk-imports all records from prisma/company-records.json into the
 * SharePoint "Companies List" via Microsoft Graph API.
 *
 * Usage:
 *   node scripts/import-companies.mjs
 *
 * Requires these env vars (reads from .env.local automatically):
 *   AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, SHAREPOINT_SITE_ID
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// ── 1. Load .env.local manually (no dotenv dependency needed) ────────────────
const envPath = resolve(root, '.env.local');
const envLines = readFileSync(envPath, 'utf-8').split(/\r?\n/);
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim();
  if (!process.env[key]) process.env[key] = val;
}

// ── 2. Read company records ───────────────────────────────────────────────────
const companiesPath = resolve(root, 'prisma', 'company-records.json');
const companies = JSON.parse(readFileSync(companiesPath, 'utf-8'));
console.log(`📋 Found ${companies.length} companies to import.\n`);

// ── 3. Validate required env vars ─────────────────────────────────────────────
const TENANT_ID     = process.env.AZURE_TENANT_ID;
const CLIENT_ID     = process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const SITE_ID       = process.env.SHAREPOINT_SITE_ID;

if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Missing Azure credentials in .env.local');
  process.exit(1);
}
if (!SITE_ID || SITE_ID === 'replace-with-site-guid') {
  console.error('❌ SHAREPOINT_SITE_ID is not set in .env.local');
  process.exit(1);
}

// ── 4. Get an access token via client-credentials flow ────────────────────────
async function getAccessToken() {
  const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope:         'https://graph.microsoft.com/.default',
  });

  const res = await fetch(tokenUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token request failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.access_token;
}

// ── 5. Check existing items in the list (avoid duplicates by companyCode) ─────
async function getExistingCodes(token) {
  const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/Companies List/items?$expand=fields&$select=id,fields&$top=999`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 404) {
      console.warn('⚠️  "Companies List" not found — will attempt to create items anyway.');
      return new Set();
    }
    throw new Error(`Failed to fetch existing items: ${res.status} ${err}`);
  }

  const data = await res.json();
  const codes = new Set();
  for (const item of (data.value ?? [])) {
    // Internal name for "companyCode" column is "field_1"
    const code = item.fields?.field_1;
    if (code) codes.add(code);
  }
  console.log(`🔍 Existing company codes in SharePoint: ${codes.size > 0 ? [...codes].join(', ') : '(none)'}\n`);
  return codes;
}

// ── 6. Create a single list item ───────────────────────────────────────────────
async function createItem(token, company) {
  // SharePoint "Companies List" — discovered internal column names:
  //   Title   → companyName  (display name = "Title",       internal = "Title")
  //   field_1 → companyCode  (display name = "companyCode", internal = "field_1")
  //   field_2 → sector       (display name = "sector",      internal = "field_2")
  const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/Companies List/items`;

  const res = await fetch(url, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        Title:   company.companyName,
        field_1: company.companyCode,
        field_2: company.sector,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create "${company.companyName}": ${res.status} ${err}`);
  }

  return res.json();
}

// ── 7. Main ───────────────────────────────────────────────────────────────────
(async () => {
  try {
    console.log('🔐 Acquiring access token…');
    const token = await getAccessToken();
    console.log('✅ Token acquired.\n');

    const existingCodes = await getExistingCodes(token);

    let created  = 0;
    let skipped  = 0;
    let failed   = 0;

    for (const company of companies) {
      if (existingCodes.has(company.companyCode)) {
        console.log(`⏭️  Skipping  "${company.companyName}" (${company.companyCode}) — already exists`);
        skipped++;
        continue;
      }

      try {
        await createItem(token, company);
        console.log(`✅ Created   "${company.companyName}" (${company.companyCode}) [${company.sector}]`);
        created++;
      } catch (err) {
        console.error(`❌ FAILED    "${company.companyName}": ${err.message}`);
        failed++;
      }

      // Small delay to avoid throttling
      await new Promise(r => setTimeout(r, 150));
    }

    console.log('\n────────────────────────────────────────');
    console.log(`📊 Summary: ${created} created, ${skipped} skipped, ${failed} failed`);
    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('\n❌ Fatal error:', err.message);
    process.exit(1);
  }
})();
