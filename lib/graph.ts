import 'server-only';
import { ClientSecretCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js';

let _client: Client | null = null;

export function getGraphClient(): Client {
  if (_client) return _client;

  const tenantId     = process.env.AZURE_TENANT_ID;
  const clientId     = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      'Missing Azure credentials. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET in .env.local'
    );
  }

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default'],
  });

  _client = Client.initWithMiddleware({ authProvider });
  return _client;
}

export function getSiteId(): string {
  const siteId = process.env.SHAREPOINT_SITE_ID;
  if (!siteId || siteId === 'replace-with-site-guid') {
    throw new Error(
      'SHAREPOINT_SITE_ID is not set. Get it from Graph Explorer: GET /v1.0/sites/{tenant}.sharepoint.com:/sites/GCPCentral'
    );
  }
  return siteId;
}

export function getDriveId(): string {
  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  if (!driveId || driveId === 'replace-with-drive-guid') {
    throw new Error(
      'SHAREPOINT_DRIVE_ID is not set. Get it from Graph Explorer: GET /v1.0/sites/{siteId}/drives'
    );
  }
  return driveId;
}
