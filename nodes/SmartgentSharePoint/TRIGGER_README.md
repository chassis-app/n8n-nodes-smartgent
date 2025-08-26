# SmartGent SharePoint Trigger

The SmartGent SharePoint Trigger node monitors SharePoint folders for file changes and triggers workflows when new files are added or existing files are modified.

## Features

- **Real-time monitoring**: Poll SharePoint folders at configurable intervals
- **Multiple trigger events**: File added, file modified, or both
- **File filtering**: Monitor specific file extensions only
- **Subfolder support**: Optionally include subfolders in monitoring
- **File content download**: Automatically download file content as binary data
- **Comprehensive metadata**: Access to file details, URLs, and modification times

## Configuration

### Authentication
Uses the same SharePoint API credentials as the regular SharePoint node:
- **Tenant ID**: Your Azure AD tenant ID
- **Client ID**: Application (client) ID from your app registration
- **Client Secret**: Client secret from your app registration
- **Site URL**: SharePoint site URL to monitor

### Trigger Settings

#### Event Type
- **File Added**: Triggers only when new files are added to the folder
- **File Modified**: Triggers only when existing files are modified
- **File Added or Modified**: Triggers for both new and modified files

#### Folder Path
The path to monitor in the SharePoint site:
- Use `/` for the root Documents library
- Use folder paths like `/MyFolder/Subfolder` for specific folders
- Supports both encoded and decoded paths

#### Poll Interval
How often to check for changes (10-3600 seconds, default: 60 seconds)

### Additional Options

#### File Extensions Filter
Comma-separated list of file extensions to monitor:
```
pdf,docx,xlsx,pptx
```
Leave empty to monitor all file types.

#### Include Subfolders
Enable to recursively monitor subfolders (currently limited implementation).

#### Download File Content
Enable to automatically download file content and include it as binary data in the trigger output.

## Output Data

Each triggered execution provides:

### JSON Data
```json
{
  "event": "fileAdded",
  "trigger": "smartgentSharePointTrigger",
  "file": {
    "id": "01234567-89AB-CDEF-0123-456789ABCDEF",
    "name": "document.pdf",
    "lastModifiedDateTime": "2023-08-26T10:30:00Z",
    "size": 1024576,
    "webUrl": "https://contoso.sharepoint.com/sites/mysite/Shared%20Documents/document.pdf",
    "downloadUrl": "https://contoso-my.sharepoint.com/personal/...",
    "mimeType": "application/pdf"
  },
  "folder": {
    "path": "/",
    "driveId": "b!abc123...",
    "siteId": "contoso.sharepoint.com,abc123..."
  },
  "timestamp": "2023-08-26T10:31:00Z"
}
```

### Binary Data (if enabled)
When "Download File Content" is enabled, the file content is included as binary data:
```json
{
  "binary": {
    "data": {
      "data": "base64-encoded-file-content",
      "mimeType": "application/pdf",
      "fileName": "document.pdf",
      "fileSize": 1024576
    }
  }
}
```

## Use Cases

### Document Processing Workflow
1. **Trigger**: New PDF files added to `/Invoices` folder
2. **Action**: Extract text using OCR
3. **Action**: Process invoice data
4. **Action**: Update accounting system

### File Backup System
1. **Trigger**: Any file added or modified in monitored folder
2. **Action**: Download file content
3. **Action**: Upload to backup storage (S3, Google Drive, etc.)
4. **Action**: Send notification

### Content Approval Workflow
1. **Trigger**: New documents in `/Draft` folder
2. **Action**: Send approval email to manager
3. **Action**: Move approved files to `/Published` folder

## Best Practices

### Performance
- Use appropriate poll intervals (avoid too frequent polling)
- Filter by file extensions when possible
- Only download content when necessary

### Reliability
- Test with small folders first
- Monitor n8n logs for authentication issues
- Consider SharePoint API rate limits

### Security
- Use dedicated service accounts with minimal permissions
- Regularly rotate client secrets
- Monitor access logs

## Troubleshooting

### Common Issues

#### Authentication Failures
- Verify tenant ID, client ID, and client secret
- Ensure the application has proper SharePoint permissions
- Check that the site URL is correct and accessible

#### No Triggers Firing
- Verify the folder path exists in SharePoint
- Check if files are actually being added/modified in the monitored timeframe
- Review the poll interval setting

#### Missing Files
- Check file extension filters
- Verify subfolder inclusion settings
- Ensure files aren't being moved/deleted quickly

### Required SharePoint Permissions
Your Azure AD application needs these Microsoft Graph permissions:
- `Sites.Read.All` or `Sites.ReadWrite.All`
- `Files.Read.All` or `Files.ReadWrite.All`

## Limitations

- Polling-based (not real-time push notifications)
- Subfolder monitoring has limited implementation
- Subject to SharePoint API rate limits
- Requires proper Azure AD application setup

## Migration from Webhooks

If migrating from SharePoint webhooks:
1. Update trigger configuration to polling mode
2. Adjust poll intervals based on your requirements
3. Test thoroughly with your existing workflows
4. Monitor performance and adjust as needed
