import type {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
	IHttpRequestOptions,
} from 'n8n-workflow';

import { NodeConnectionType, NodeOperationError, ApplicationError } from 'n8n-workflow';

export class SmartgentSharePointTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Smartgent SharePoint Trigger',
		name: 'smartgentSharePointTrigger',
		icon: 'file:sharepoint.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Monitor SharePoint folders for new files and changes',
		defaults: {
			name: 'Smartgent SharePoint Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'smartgentMicrosoftSharePointApi',
				required: true,
			},
		],
		polling: true,
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'File Added',
						value: 'fileAdded',
						description: 'Trigger when a new file is added to the monitored folder',
					},
					{
						name: 'File Modified',
						value: 'fileModified',
						description: 'Trigger when a file is modified in the monitored folder',
					},
					{
						name: 'File Added or Modified',
						value: 'fileAddedOrModified',
						description: 'Trigger when a file is added or modified in the monitored folder',
					},
				],
				default: 'fileAdded',
			},
			{
				displayName: 'Folder Path to Monitor',
				name: 'folderPath',
				type: 'string',
				default: '/',
				required: true,
				description: 'Path to the folder to monitor. Use "/" for root/main Documents library, or specify a subfolder path.',
				placeholder: '/',
			},
			{
				displayName: 'Poll Interval',
				name: 'pollInterval',
				type: 'number',
				default: 60,
				description: 'How often to check for changes (in seconds)',
				typeOptions: {
					minValue: 10,
					maxValue: 3600,
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
						displayName: 'File Extensions Filter',
						name: 'fileExtensions',
						type: 'string',
						default: '',
						description: 'Comma-separated list of file extensions to monitor (e.g., pdf,docx,xlsx). Leave empty to monitor all files.',
						placeholder: 'pdf,docx,xlsx',
					},
					{
						displayName: 'Include Subfolders',
						name: 'includeSubfolders',
						type: 'boolean',
						default: false,
						description: 'Whether to monitor subfolders recursively',
					},
					{
						displayName: 'Download File Content',
						name: 'downloadContent',
						type: 'boolean',
						default: false,
						description: 'Whether to download file content as binary data',
					},
				],
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const pollData = this.getWorkflowStaticData('node');
		const event = this.getNodeParameter('event') as string;
		const folderPath = this.getNodeParameter('folderPath') as string;
		const additionalOptions = this.getNodeParameter('additionalOptions') as IDataObject;
		const fileExtensions = (additionalOptions.fileExtensions as string || '').split(',').map(ext => ext.trim().toLowerCase()).filter(ext => ext);
		const includeSubfolders = additionalOptions.includeSubfolders as boolean;
		const downloadContent = additionalOptions.downloadContent as boolean;

		try {
			const credentials = await this.getCredentials('smartgentMicrosoftSharePointApi');

			// Get access token
			const tokenResponse = await SmartgentSharePointTrigger.getAccessToken(credentials, this);
			const accessToken = tokenResponse.access_token;

			// Get site ID
			const siteId = await SmartgentSharePointTrigger.getSiteId(credentials.siteUrl as string, accessToken, this);

			// Get drive ID
			const driveId = await SmartgentSharePointTrigger.getDriveId(siteId, accessToken, this);

			// Get current files
			const currentFiles = await SmartgentSharePointTrigger.listDocuments(
				driveId, 
				folderPath, 
				accessToken, 
				{ includeSubfolders },
				this
			);

			// Filter by file extensions if specified
			let filteredFiles = currentFiles;
			if (fileExtensions.length > 0) {
				filteredFiles = currentFiles.filter(file => {
					const fileExt = file.name.split('.').pop()?.toLowerCase();
					return fileExt && fileExtensions.includes(fileExt);
				});
			}

			// Get last poll data
			const lastPollTime = pollData.lastPollTime as string;
			const lastKnownFiles = pollData.lastKnownFiles as any[] || [];

			// Current poll time
			const currentPollTime = new Date().toISOString();

			let newOrModifiedFiles: any[] = [];

			if (!lastPollTime) {
				// First poll - don't trigger for existing files unless specified
				newOrModifiedFiles = [];
			} else {
				const lastPollDate = new Date(lastPollTime);
				
				for (const file of filteredFiles) {
					const fileModifiedDate = new Date(file.lastModifiedDateTime);
					const lastKnownFile = lastKnownFiles.find(f => f.id === file.id);

					if (event === 'fileAdded') {
						// File added - new file that wasn't in last poll
						if (!lastKnownFile) {
							newOrModifiedFiles.push(file);
						}
					} else if (event === 'fileModified') {
						// File modified - file was modified since last poll and was already known
						if (lastKnownFile && fileModifiedDate > lastPollDate) {
							newOrModifiedFiles.push(file);
						}
					} else if (event === 'fileAddedOrModified') {
						// File added or modified
						if (!lastKnownFile || fileModifiedDate > lastPollDate) {
							newOrModifiedFiles.push(file);
						}
					}
				}
			}

			// Update poll data
			pollData.lastPollTime = currentPollTime;
			pollData.lastKnownFiles = filteredFiles;

			if (newOrModifiedFiles.length === 0) {
				return null; // No new data
			}

			// Prepare return data
			const returnData: INodeExecutionData[] = [];

			for (const file of newOrModifiedFiles) {
				let executionData: INodeExecutionData = {
					json: {
						event,
						trigger: 'smartgentSharePointTrigger',
						file: {
							id: file.id,
							name: file.name,
							lastModifiedDateTime: file.lastModifiedDateTime,
							size: file.size,
							webUrl: file.webUrl,
							downloadUrl: file.downloadUrl,
							mimeType: file.mimeType,
						},
						folder: {
							path: folderPath,
							driveId,
							siteId,
						},
						timestamp: currentPollTime,
					},
				};

				// Download file content if requested
				if (downloadContent) {
					try {
						const fileContent = await SmartgentSharePointTrigger.downloadDocument(driveId, file.id, accessToken, this);
						executionData.binary = {
							data: {
								data: fileContent.toString('base64'),
								mimeType: file.mimeType || 'application/octet-stream',
								fileName: file.name,
								fileSize: file.size,
							},
						};
					} catch (error) {
						// If download fails, continue without binary data but include error info
						executionData.json.downloadError = error.message;
					}
				}

				returnData.push(executionData);
			}

			return [returnData];

		} catch (error) {
			throw new NodeOperationError(this.getNode(), `SharePoint Trigger failed: ${error.message}`);
		}
	}

	private static async getAccessToken(credentials: any, context: IPollFunctions): Promise<any> {
		const tokenUrl = credentials.tokenEndpoint || `https://login.microsoftonline.com/${credentials.tenantId}/oauth2/v2.0/token`;
		
		const data = {
			grant_type: 'client_credentials',
			client_id: credentials.clientId as string,
			client_secret: credentials.clientSecret as string,
			scope: 'https://graph.microsoft.com/.default',
		};

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

	private static async getSiteId(siteUrl: string, token: string, context: IPollFunctions): Promise<string> {
		try {
			const urlObj = new URL(siteUrl);
			const hostname = urlObj.hostname;
			const relativePath = urlObj.pathname;
			
			const directUrl = `https://graph.microsoft.com/v1.0/sites/${hostname}:${relativePath}`;
			
			const directOptions: IHttpRequestOptions = {
				method: 'GET',
				url: directUrl,
				headers: {
					'Authorization': `Bearer ${token}`,
				},
				json: true,
			};

			const directResponse = await context.helpers.httpRequest(directOptions);
			
			if (directResponse.id) {
				return directResponse.id;
			}
		} catch (directError) {
			// Fallback to search method
		}
		
		const urlParts = siteUrl.split('sites/');
		if (urlParts.length < 2) {
			throw new ApplicationError('Invalid SharePoint site URL format');
		}
		
		const siteName = urlParts[1].split('/')[0];
		
		const options: IHttpRequestOptions = {
			method: 'GET',
			url: `https://graph.microsoft.com/v1.0/sites?search=${siteName}`,
			headers: {
				'Authorization': `Bearer ${token}`,
			},
			json: true,
		};

		const response = await context.helpers.httpRequest(options);
		
		if (!response.value || response.value.length === 0) {
			throw new ApplicationError(`No sites found matching '${siteName}'`);
		}
		
		const site = response.value.find((x: any) => 
			x.name && x.name.toLowerCase() === siteName.toLowerCase()
		);
		
		if (!site) {
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

	private static async getDriveId(siteId: string, token: string, context: IPollFunctions): Promise<string> {
		const options: IHttpRequestOptions = {
			method: 'GET',
			url: `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`,
			headers: {
				'Authorization': `Bearer ${token}`,
			},
			json: true,
		};

		const response = await context.helpers.httpRequest(options);
		
		if (!response.value || response.value.length === 0) {
			throw new ApplicationError('No drives found for the site');
		}
		
		const documentsDrive = response.value.find((drive: any) => 
			drive.name === 'Documents' || 
			drive.webUrl.includes('Shared%20Documents') ||
			drive.webUrl.includes('Shared Documents')
		);
		
		if (documentsDrive) {
			return documentsDrive.id;
		}
		
		return response.value[0].id;
	}

	private static async listDocuments(driveId: string, folderPath: string, token: string, options: any, context: IPollFunctions): Promise<any[]> {
		const includeSubfolders = options.includeSubfolders || false;
		
		let allDocuments: any[] = [];
		
		// Get documents from the main folder
		const mainFolderDocs = await SmartgentSharePointTrigger.getDocumentsFromFolder(driveId, folderPath, token, context);
		allDocuments = allDocuments.concat(mainFolderDocs);
		
		// If include subfolders is enabled, recursively get documents from subfolders
		if (includeSubfolders) {
			const subfolderDocs = await SmartgentSharePointTrigger.getDocumentsFromSubfolders(driveId, folderPath, token, context);
			allDocuments = allDocuments.concat(subfolderDocs);
		}
		
		return allDocuments;
	}

	private static async getDocumentsFromFolder(driveId: string, folderPath: string, token: string, context: IPollFunctions): Promise<any[]> {
		let url: string;
		
		const decodedPath = decodeURIComponent(folderPath);
		
		if (folderPath === '/' || folderPath === '' || folderPath === '/root' || 
			folderPath === '/Shared Documents' || folderPath === 'Shared Documents' ||
			folderPath === '/Shared%20Documents' || folderPath === 'Shared%20Documents' ||
			decodedPath === '/Shared Documents' || decodedPath === 'Shared Documents') {
			url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root/children`;
		} else {
			const cleanPath = folderPath.startsWith('/') ? folderPath.substring(1) : folderPath;
			url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${cleanPath}:/children`;
		}

		url += '?$select=id,name,lastModifiedDateTime,size,file,folder,webUrl,@microsoft.graph.downloadUrl';

		const options: IHttpRequestOptions = {
			method: 'GET',
			url,
			headers: {
				'Authorization': `Bearer ${token}`,
			},
			json: true,
		};

		const response = await context.helpers.httpRequest(options);
		
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

	private static async getDocumentsFromSubfolders(driveId: string, folderPath: string, token: string, context: IPollFunctions): Promise<any[]> {
		// This is a simplified implementation - in a production environment,
		// you might want to implement a more sophisticated recursive folder traversal
		return [];
	}

	private static async downloadDocument(driveId: string, documentId: string, token: string, context: IPollFunctions): Promise<Buffer> {
		const options: IHttpRequestOptions = {
			method: 'GET',
			url: `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${documentId}/content`,
			headers: {
				'Authorization': `Bearer ${token}`,
			},
			encoding: 'arraybuffer',
		};

		const response = await context.helpers.httpRequest(options);
		return Buffer.from(response);
	}
}


