# SmartGent Utilities

This directory contains TypeScript utility functions for the SmartGent n8n nodes.

## Modules

### `graphAuth.ts`
Microsoft Graph API authentication utilities.

#### Functions
- `getGraphAccessToken(options)` - Get access token with custom options
- `getGraphAccessTokenFromEnv()` - Get access token from environment variables

#### Usage
```typescript
import { getGraphAccessToken, getGraphAccessTokenFromEnv } from '../utils/graphAuth';

// Using custom options
const token = await getGraphAccessToken({
  tokenEndpoint: 'https://login.microsoftonline.com/tenant-id/oauth2/v2.0/token',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret'
});

// Using environment variables (SC_TOKEN_ENDPOINT, SC_CLIENT_ID, SC_CLIENT_SECRET)
const token = await getGraphAccessTokenFromEnv();
```

### `sharepoint.ts`
SharePoint API utilities for managing sites, files, and content.

#### Key Functions
- `getSiteId(siteUrl, token)` - Get SharePoint site ID
- `getDriveId(siteUrl, token, siteId)` - Get drive ID
- `getAllFilesByFolderId(folderId, driveId, token)` - Get all files in a folder
- `moveFile(request)` - Move files between folders
- `tagFile(fileId, siteId, listId, token, tags)` - Add metadata tags to files
- `uploadResult(results, folderUrl, token)` - Upload CSV results to SharePoint

#### Usage
```typescript
import { getSiteId, getDriveId, getAllFilesByFolderId } from '../utils/sharepoint';

const siteUrl = 'https://yourtenant.sharepoint.com/sites/yoursite';
const token = 'your-access-token';

// Get site information
const siteId = await getSiteId(siteUrl, token);
const driveId = await getDriveId(siteUrl, token, siteId);

// Get files from a folder
const files = await getAllFilesByFolderId('folder-id', driveId, token);
```

### `types.ts`
TypeScript type definitions for all utility functions.

## Installation

After adding these utilities, install the required dependencies:

```bash
npm install json-2-csv qs
npm install --save-dev @types/qs
```

## Migration from JavaScript

The original `getGraphAccessToken.js` and `sharepoint.js` files have been converted to TypeScript with:

1. **Type Safety** - All functions now have proper TypeScript types
2. **Better Error Handling** - Improved error messages and handling
3. **Documentation** - JSDoc comments for all functions
4. **Modular Exports** - Functions can be imported individually
5. **Environment Variable Support** - Both custom options and env var methods

## Legacy Support

The original JavaScript files are still available if needed, but it's recommended to migrate to the TypeScript utilities for better type safety and development experience.
