/**
 * discover-columns.mjs
 * Fetches and prints all column definitions for the "Companies List"
 * so we can find the correct internal field names.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Load .env.local
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

const TENANT_ID     = process.env.AZURE_TENANT_ID;
const CLIENT_ID     = process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const SITE_ID       = process.env.SHAREPOINT_SITE_ID;

async function getToken() {
  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials', client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET, scope: 'https://graph.microsoft.com/.default',
      }).toString(),
    }
  );
  return (await res.json()).access_token;
}

(async () => {
  const token = await getToken();

  // 1. List all lists on this site to confirm the list name
  console.log('=== ALL LISTS ON SITE ===');
  const listsRes = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists?$select=id,name,displayName`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
  );
  const listsData = await listsRes.json();
  for (const list of (listsData.value ?? [])) {
    console.log(`  name="${list.name}"  displayName="${list.displayName}"  id=${list.id}`);
  }

  // 2. Try common list name variants and get their columns
  const variants = ['Companies List', 'CompaniesList', 'Companies'];
  for (const listName of variants) {
    console.log(`\n=== COLUMNS for list: "${listName}" ===`);
    const colRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${encodeURIComponent(listName)}/columns`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
    );
    if (!colRes.ok) {
      console.log(`  → HTTP ${colRes.status} (list not found or no access)`);
      continue;
    }
    const colData = await colRes.json();
    for (const col of (colData.value ?? [])) {
      if (col.hidden) continue; // skip hidden system columns
      console.log(`  displayName="${col.displayName}"  name="${col.name}"  type=${col.columnGroup ?? col.type ?? '?'}`);
    }
  }
})();
