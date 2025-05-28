# SmartGent MinIO Node

## Overview

The SmartGent MinIO node provides comprehensive file storage capabilities for both AWS S3 and MinIO-compatible services. It combines file upload and presigned URL generation in a single, efficient operation.

## Features

- 🚀 **Upload Files** - Upload binary or text files to S3/MinIO buckets
- 🔗 **Generate Presigned URLs** - Create time-limited access URLs for files
- ⚡ **Combined Operation** - Upload and get presigned URL in one step
- 🔧 **Flexible Configuration** - Support for AWS S3 and MinIO endpoints
- 📁 **Binary & Text Support** - Handle both binary files and text content
- 🏷️ **Metadata Support** - Add custom metadata to uploaded files
- ⏰ **Configurable Expiration** - Set custom expiration times for presigned URLs

## Configuration

### Credentials
The node requires S3/MinIO credentials:
- **Access Key ID**: Your S3/MinIO access key
- **Secret Access Key**: Your S3/MinIO secret key
- **Region**: AWS region or any valid region for MinIO
- **Endpoint URL**: Custom endpoint for MinIO (leave empty for AWS S3)
- **Force Path Style**: Enable for MinIO compatibility

### Operations

#### Upload File
- Upload a file to the specified bucket
- Returns upload confirmation and file URL

#### Generate Presigned URL
- Generate a time-limited URL for an existing file
- Configurable expiration time

#### Upload and Get Presigned URL (Recommended)
- Combines upload and presigned URL generation
- Most efficient for workflows that need both operations
- Perfect for file sharing scenarios

## Usage Examples

### Basic File Upload with Presigned URL
1. Add the SmartGent MinIO node to your workflow
2. Configure your S3/MinIO credentials
3. Select "Upload and Get Presigned URL" operation
4. Set bucket name (e.g., "n8n")
5. Set file name from previous node data
6. Configure expiration time (default: 1 hour)
7. Execute the workflow

### Binary File Upload
```javascript
// Input from previous node
{
  "data": "<binary file data>",
  "fileName": "document.pdf"
}

// Node configuration
{
  "operation": "uploadAndPresign",
  "bucketName": "my-bucket",
  "fileName": "{{ $json.fileName }}",
  "binaryFile": true,
  "binaryPropertyName": "data",
  "expirationTime": 3600
}

// Output
{
  "operation": "uploadAndPresign",
  "bucketName": "my-bucket",
  "fileName": "document.pdf",
  "fileSize": 1024000,
  "contentType": "application/pdf",
  "uploadedAt": "2025-01-27T08:15:30Z",
  "url": "https://s3.amazonaws.com/my-bucket/document.pdf",
  "presignedUrl": "https://s3.amazonaws.com/my-bucket/document.pdf?X-Amz-Algorithm=...",
  "expiresAt": "2025-01-27T09:15:30Z"
}
```

### Text Content Upload
```javascript
// Node configuration
{
  "operation": "uploadAndPresign",
  "bucketName": "my-bucket",
  "fileName": "data.json",
  "binaryFile": false,
  "fileContent": "{{ JSON.stringify($json) }}",
  "contentType": "application/json",
  "expirationTime": 7200
}
```

### MinIO Configuration
For MinIO servers, configure credentials as follows:
- **Endpoint URL**: `https://your-minio-server:9000`
- **Force Path Style**: `true`
- **Region**: Any valid region (e.g., `us-east-1`)

## Advanced Features

### Custom Metadata
Add custom metadata to uploaded files:
```javascript
{
  "additionalFields": {
    "metadata": {
      "metadataFields": [
        {"key": "author", "value": "John Doe"},
        {"key": "department", "value": "Marketing"}
      ]
    }
  }
}
```

### Content Headers
Configure content-specific headers:
- **Cache Control**: Set caching behavior
- **Content Disposition**: Control download behavior
- **Content Encoding**: Specify encoding (gzip, etc.)
- **Content Language**: Set content language

## Error Handling

The node includes comprehensive error handling:
- Invalid credentials
- Network connectivity issues
- Bucket access permissions
- File size limitations
- Invalid file formats

## Security Considerations

- Use IAM roles with minimal required permissions
- Set appropriate expiration times for presigned URLs
- Consider bucket policies for additional security
- Use HTTPS endpoints for secure data transfer

## Compatibility

- ✅ AWS S3
- ✅ MinIO
- ✅ DigitalOcean Spaces
- ✅ Wasabi
- ✅ Any S3-compatible storage service 