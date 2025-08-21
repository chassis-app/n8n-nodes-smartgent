import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestOptions,
} from 'n8n-workflow';

import { NodeConnectionType, NodeOperationError, ApplicationError } from 'n8n-workflow';

export class SmartgentSharePoint implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Smartgent SharePoint',
		name: 'smartgentSharePoint',
		icon: 'file:sharepoint.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Get documents from SharePoint document libraries using Microsoft Graph API',
		defaults: {
			name: 'Smartgent SharePoint',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'smartgentMicrosoftSharePointApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'List Documents',
						value: 'listDocuments',
						description: 'Get all documents from a document library',
						action: 'List all documents in a library',
					},
					{
						name: 'Get Document Details',
						value: 'getDocument',
						description: 'Get details of a specific document',
						action: 'Get document details',
					},
					{
						name: 'Download Document',
						value: 'downloadDocument',
						description: 'Download a document content',
						action: 'Download document content',
					},
				],
				default: 'listDocuments',
			},
			{
				displayName: 'Document Library Path',
				name: 'libraryPath',
				type: 'string',
				default: '/',
				required: true,
				description: 'Path to the document library. Use "/" for root/main Documents library, or specify a subfolder path',
				placeholder: '/',
				displayOptions: {
					show: {
						operation: ['listDocuments'],
					},
				},
			},
			{
				displayName: 'Document ID',
				name: 'documentId',
				type: 'string',
				default: '',
				required: true,
				description: 'The ID of the document to retrieve',
				displayOptions: {
					show: {
						operation: ['getDocument', 'downloadDocument'],
					},
				},
			},
			{
				displayName: 'Additional Options',
				name: 'additionalOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Filter',
						name: 'filter',
						type: 'string',
						default: '',
						description: 'OData filter expression to filter documents',
						placeholder: "name eq 'document.pdf'",
					},
					{
						displayName: 'Select Fields',
						name: 'select',
						type: 'string',
						default: '',
						description: 'Comma-separated list of fields to include in response',
						placeholder: 'id,name,lastModifiedDateTime,size',
					},
					{
						displayName: 'Top',
						name: 'top',
						type: 'number',
						default: 100,
						description: 'Maximum number of items to return',
						typeOptions: {
							minValue: 1,
							maxValue: 1000,
						},
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const credentials = await this.getCredentials('smartgentMicrosoftSharePointApi');

				// Get access token using client credentials flow
				const tokenResponse = await SmartgentSharePoint.getAccessToken(credentials, this);
				const accessToken = tokenResponse.access_token;

				// Get site ID from the site URL
				const siteId = await SmartgentSharePoint.getSiteId(credentials.siteUrl as string, accessToken, this);

				let executionData: INodeExecutionData;

				switch (operation) {
					case 'listDocuments':
						const libraryPath = this.getNodeParameter('libraryPath', i) as string;
						const additionalOptions = this.getNodeParameter('additionalOptions', i) as any;
						
						// Get drive ID
						const driveId = await SmartgentSharePoint.getDriveId(siteId, accessToken, this);
						
						// List documents
						const documents = await SmartgentSharePoint.listDocuments(driveId, libraryPath, accessToken, additionalOptions, this);
						
						executionData = {
							json: {
								operation: 'listDocuments',
								siteId,
								driveId,
								libraryPath,
								documents,
								totalCount: documents.length,
								timestamp: new Date().toISOString(),
							},
							pairedItem: { item: i },
						};
						break;

					case 'getDocument':
						const documentId = this.getNodeParameter('documentId', i) as string;
						const driveIdForGet = await SmartgentSharePoint.getDriveId(siteId, accessToken, this);
						
						const documentDetails = await SmartgentSharePoint.getDocument(driveIdForGet, documentId, accessToken, this);
						
						executionData = {
							json: {
								operation: 'getDocument',
								siteId,
								driveId: driveIdForGet,
								documentId,
								document: documentDetails,
								timestamp: new Date().toISOString(),
							},
							pairedItem: { item: i },
						};
						break;

					case 'downloadDocument':
						const downloadDocumentId = this.getNodeParameter('documentId', i) as string;
						const driveIdForDownload = await SmartgentSharePoint.getDriveId(siteId, accessToken, this);
						
						const downloadContent = await SmartgentSharePoint.downloadDocument(driveIdForDownload, downloadDocumentId, accessToken, this);
						const downloadDocumentDetails = await SmartgentSharePoint.getDocument(driveIdForDownload, downloadDocumentId, accessToken, this);
						
						executionData = {
							json: {
								operation: 'downloadDocument',
								siteId,
								driveId: driveIdForDownload,
								documentId: downloadDocumentId,
								fileName: downloadDocumentDetails.name,
								timestamp: new Date().toISOString(),
							},
							binary: {
								data: {
									data: downloadContent.toString('base64'),
									mimeType: downloadDocumentDetails.mimeType || 'application/octet-stream',
									fileName: downloadDocumentDetails.name,
								},
							},
							pairedItem: { item: i },
						};
						break;

					default:
						throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
				}

				returnData.push(executionData);

			} catch (error) {
				if (this.continueOnFail()) {
					const executionData: INodeExecutionData = {
						json: {
							error: error.message,
							operation: this.getNodeParameter('operation', i) as string,
							timestamp: new Date().toISOString(),
						},
						pairedItem: { item: i },
					};
					returnData.push(executionData);
				} else {
					throw new NodeOperationError(this.getNode(), `SharePoint operation failed: ${error.message}`, { itemIndex: i });
				}
			}
		}

		return [returnData];
	}

	private static async getAccessToken(credentials: any, context: IExecuteFunctions): Promise<any> {
		// Use custom token endpoint if provided, otherwise use default Microsoft endpoint
		const tokenUrl = credentials.tokenEndpoint || `https://login.microsoftonline.com/${credentials.tenantId}/oauth2/v2.0/token`;
		
		// Create form data exactly like getGraphAccessToken.js
		const data = {
			grant_type: 'client_credentials',
			client_id: credentials.clientId as string,
			client_secret: credentials.clientSecret as string,
			scope: 'https://graph.microsoft.com/.default',
		};

		// Use the same pattern as getGraphAccessToken.js
		// Convert to URL-encoded string using the same approach
		const formDataString = Object.keys(data)
			.map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key as keyof typeof data])}`)
			.join('&');

		const options: IHttpRequestOptions = {
			method: 'POST',
			url: tokenUrl,
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
			},
			body: formDataString,
			json: true,
		};

		try {
			const response = await context.helpers.httpRequest(options);
            //console.log("token generated",response);
			if (!response.access_token) {
				throw new ApplicationError('Failed to obtain access token from Microsoft. Check your tenant ID, client ID, and client secret.');
			}
			return response;
		} catch (error: any) {
			if (error.response?.status === 400) {
				throw new ApplicationError(`Authentication failed: ${error.response?.data?.error_description || 'Invalid client credentials or tenant ID'}`);
			} else if (error.response?.status === 401) {
				throw new ApplicationError('Authentication failed: Invalid client credentials. Please check your Client ID and Client Secret.');
			}
			throw new ApplicationError(`Authentication error: ${error.message}`);
		}
	}

	private static async getSiteId(siteUrl: string, token: string, context: IExecuteFunctions): Promise<string> {
		console.log("Parsing site URL:", siteUrl);
		
		// Try direct site access first using hostname and relative path
		try {
			// Extract hostname and relative path from the site URL
			const urlObj = new URL(siteUrl);
			const hostname = urlObj.hostname;
			const relativePath = urlObj.pathname;
			
			console.log("Hostname:", hostname, "Relative path:", relativePath);
			
			// Try direct site access using hostname and relative path
			const directUrl = `https://graph.microsoft.com/v1.0/sites/${hostname}:${relativePath}`;
			console.log("Trying direct site URL:", directUrl);
			
			const directOptions: IHttpRequestOptions = {
				method: 'GET',
				url: directUrl,
				headers: {
					'Authorization': `Bearer ${token}`,
				},
				json: true,
			};

			const directResponse = await context.helpers.httpRequest(directOptions);
			console.log("Direct site response:", directResponse);
			
			if (directResponse.id) {
				return directResponse.id;
			}
		} catch (directError) {
			console.log("Direct site access failed, trying search method:", directError.message);
		}
		
		// Fallback to search method
		const urlParts = siteUrl.split('sites/');
		if (urlParts.length < 2) {
			throw new ApplicationError('Invalid SharePoint site URL format');
		}
		
		const siteName = urlParts[1].split('/')[0];
		console.log("Extracted site name:", siteName);
		
		const options: IHttpRequestOptions = {
			method: 'GET',
			url: `https://graph.microsoft.com/v1.0/sites?search=${siteName}`,
			headers: {
				'Authorization': `Bearer ${token}`,
			},
			json: true,
		};

		const response = await context.helpers.httpRequest(options);
		console.log("Site search response:", response);
		
		if (!response.value || response.value.length === 0) {
			throw new ApplicationError(`No sites found matching '${siteName}'`);
		}
		
		// Find site by name (case-insensitive)
		const site = response.value.find((x: any) => 
			x.name && x.name.toLowerCase() === siteName.toLowerCase()
		);
		
		if (!site) {
			// If exact name match fails, try to find the first site that contains the name
			const partialMatch = response.value.find((x: any) => 
				x.name && x.name.toLowerCase().includes(siteName.toLowerCase())
			);
			
			if (!partialMatch) {
				throw new ApplicationError(`Site '${siteName}' not found. Available sites: ${response.value.map((x: any) => x.name).join(', ')}`);
			}
			
			return partialMatch.id;
		}
		
		return site.id;
	}

	private static async getDriveId(siteId: string, token: string, context: IExecuteFunctions): Promise<string> {
		const options: IHttpRequestOptions = {
			method: 'GET',
			url: `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`,
			headers: {
				'Authorization': `Bearer ${token}`,
			},
			json: true,
		};

		const response = await context.helpers.httpRequest(options);
		console.log("Drives response:", response);
		
		if (!response.value || response.value.length === 0) {
			throw new ApplicationError('No drives found for the site');
		}
		
		// Find the main "Documents" drive (typically named "Documents" and points to "Shared Documents")
		const documentsDrive = response.value.find((drive: any) => 
			drive.name === 'Documents' || 
			drive.webUrl.includes('Shared%20Documents') ||
			drive.webUrl.includes('Shared Documents')
		);
		
		if (documentsDrive) {
			console.log("Found Documents drive:", documentsDrive);
			return documentsDrive.id;
		}
		
		// Fallback to first drive if no Documents drive found
		console.log("No Documents drive found, using first drive:", response.value[0]);
		return response.value[0].id;
	}

	private static async listDocuments(driveId: string, libraryPath: string, token: string, additionalOptions: any, context: IExecuteFunctions): Promise<any[]> {
		console.log("Listing documents for drive:", driveId, "path:", libraryPath);
		let url: string;
		
		// Construct the URL based on library path
		// Decode URL-encoded path for comparison
		const decodedPath = decodeURIComponent(libraryPath);
		
		if (libraryPath === '/' || libraryPath === '' || libraryPath === '/root' || 
			libraryPath === '/Shared Documents' || libraryPath === 'Shared Documents' ||
			libraryPath === '/Shared%20Documents' || libraryPath === 'Shared%20Documents' ||
			decodedPath === '/Shared Documents' || decodedPath === 'Shared Documents') {
			// For root or Shared Documents, just list the root of the drive
			url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root/children`;
			console.log("Using root children URL");
		} else {
			// Remove leading slash if present
			const cleanPath = libraryPath.startsWith('/') ? libraryPath.substring(1) : libraryPath;
			url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${cleanPath}:/children`;
			console.log("Using path-specific URL with clean path:", cleanPath);
		}

		// Add query parameters
		const queryParams = new URLSearchParams();
		
		if (additionalOptions.filter) {
			queryParams.append('$filter', additionalOptions.filter);
		}
		
		if (additionalOptions.select) {
			queryParams.append('$select', additionalOptions.select);
		} else {
			queryParams.append('$select', 'id,name,lastModifiedDateTime,size,file,folder,webUrl,@microsoft.graph.downloadUrl');
		}
		
		if (additionalOptions.top) {
			queryParams.append('$top', additionalOptions.top.toString());
		}

		if (queryParams.toString()) {
			url += `?${queryParams.toString()}`;
		}

		console.log("Documents list URL:", url);

		const options: IHttpRequestOptions = {
			method: 'GET',
			url,
			headers: {
				'Authorization': `Bearer ${token}`,
			},
			json: true,
		};

		const response = await context.helpers.httpRequest(options);
		console.log("Documents list response:", response);
		
		// Filter only files (not folders)
		const documents = response.value.filter((item: any) => item.file !== undefined);
		
		return documents.map((doc: any) => ({
			id: doc.id,
			name: doc.name,
			lastModifiedDateTime: doc.lastModifiedDateTime,
			size: doc.size,
			webUrl: doc.webUrl,
			downloadUrl: doc['@microsoft.graph.downloadUrl'],
			mimeType: doc.file?.mimeType,
		}));
	}

	private static async getDocument(driveId: string, documentId: string, token: string, context: IExecuteFunctions): Promise<any> {
		const options: IHttpRequestOptions = {
			method: 'GET',
			url: `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${documentId}`,
			headers: {
				'Authorization': `Bearer ${token}`,
			},
			json: true,
		};

		const response = await context.helpers.httpRequest(options);
		
		return {
			id: response.id,
			name: response.name,
			lastModifiedDateTime: response.lastModifiedDateTime,
			size: response.size,
			webUrl: response.webUrl,
			downloadUrl: response['@microsoft.graph.downloadUrl'],
			mimeType: response.file?.mimeType,
			createdDateTime: response.createdDateTime,
			lastModifiedBy: response.lastModifiedBy,
			createdBy: response.createdBy,
		};
	}

	private static async downloadDocument(driveId: string, documentId: string, token: string, context: IExecuteFunctions): Promise<Buffer> {
		const options: IHttpRequestOptions = {
			method: 'GET',
			url: `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${documentId}/content`,
			headers: {
				'Authorization': `Bearer ${token}`,
			},
			encoding: 'arraybuffer', // This ensures we get binary data
		};

		const response = await context.helpers.httpRequest(options);
		return Buffer.from(response);
	}
}
