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
				description: 'Path to the folder to monitor. Use "/" for root Documents library, or specify a subfolder path like "MyFolder" or "ParentFolder/ChildFolder". Paths are relative to the Documents library root.',
				placeholder: 'MyFolder/SubFolder',
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

		// Check if this is a test execution (when user clicks "Fetch Test Event")
		const isTestMode = this.getMode() === 'manual';

		try {
			const credentials = await this.getCredentials('smartgentMicrosoftSharePointApi');
			console.log(`SharePoint Trigger: Starting ${isTestMode ? 'TEST' : 'POLL'} for folder path: "${folderPath}"`);

			// Get access token
			const tokenResponse = await SmartgentSharePointTrigger.getAccessToken(credentials, this);
			const accessToken = tokenResponse.access_token;
			console.log('SharePoint Trigger: Successfully obtained access token');

			// Get site ID
			const siteId = await SmartgentSharePointTrigger.getSiteId(credentials.siteUrl as string, accessToken, this);
			console.log(`SharePoint Trigger: Site ID: ${siteId}`);

			// Get drive ID
			const driveId = await SmartgentSharePointTrigger.getDriveId(siteId, accessToken, this);
			console.log(`SharePoint Trigger: Drive ID: ${driveId}`);

			// Get current files
			console.log(`SharePoint Trigger: Listing documents for path: "${folderPath}", includeSubfolders: ${includeSubfolders}`);
			const currentFiles = await SmartgentSharePointTrigger.listDocuments(
				driveId, 
				folderPath, 
				accessToken, 
				{ includeSubfolders },
				this
			);
			console.log(`SharePoint Trigger: Found ${currentFiles.length} total files`);
			console.log('SharePoint Trigger: Files found:', currentFiles.map(f => ({ name: f.name, id: f.id })));

			// Filter by file extensions if specified
			let filteredFiles = currentFiles;
			if (fileExtensions.length > 0) {
				console.log(`SharePoint Trigger: Filtering by extensions: ${fileExtensions.join(', ')}`);
				filteredFiles = currentFiles.filter(file => {
					const fileExt = file.name.split('.').pop()?.toLowerCase();
					return fileExt && fileExtensions.includes(fileExt);
				});
				console.log(`SharePoint Trigger: After extension filtering: ${filteredFiles.length} files`);
			}

			// Get last poll data
			const lastPollTime = pollData.lastPollTime as string;
			const lastKnownFiles = pollData.lastKnownFiles as any[] || [];

			// Current poll time
			const currentPollTime = new Date().toISOString();

			let newOrModifiedFiles: any[] = [];

			if (isTestMode) {
				// In test mode, return some files for demonstration purposes
				console.log('SharePoint Trigger: Running in test mode - will return existing files for demo');
				if (filteredFiles.length > 0) {
					// Return a random selection of files to make testing more realistic
					const maxFiles = Math.min(3, filteredFiles.length);
					const shuffled = [...filteredFiles].sort(() => 0.5 - Math.random());
					newOrModifiedFiles = shuffled.slice(0, maxFiles);
					console.log(`SharePoint Trigger: Test mode - returning ${newOrModifiedFiles.length} random files for testing`);
					console.log('SharePoint Trigger: NOTE - These are existing files shown for testing. In normal mode, only NEW/MODIFIED files would trigger.');
				} else {
					console.log('SharePoint Trigger: Test mode - no files found in folder');
				}
			} else if (!lastPollTime) {
				// First poll - don't trigger for existing files unless specified
				console.log('SharePoint Trigger: First poll - not triggering for existing files');
				newOrModifiedFiles = [];
			} else {
				const lastPollDate = new Date(lastPollTime);
				console.log(`SharePoint Trigger: Checking for changes since ${lastPollTime}`);
				
				for (const file of filteredFiles) {
					const fileModifiedDate = new Date(file.lastModifiedDateTime);
					const lastKnownFile = lastKnownFiles.find(f => f.id === file.id);

					if (event === 'fileAdded') {
						// File added - new file that wasn't in last poll
						if (!lastKnownFile) {
							newOrModifiedFiles.push(file);
							console.log(`SharePoint Trigger: New file detected: ${file.name}`);
						}
					} else if (event === 'fileModified') {
						// File modified - file was modified since last poll and was already known
						if (lastKnownFile && fileModifiedDate > lastPollDate) {
							newOrModifiedFiles.push(file);
							console.log(`SharePoint Trigger: Modified file detected: ${file.name}`);
						}
					} else if (event === 'fileAddedOrModified') {
						// File added or modified
						if (!lastKnownFile || fileModifiedDate > lastPollDate) {
							newOrModifiedFiles.push(file);
							console.log(`SharePoint Trigger: New or modified file detected: ${file.name}`);
						}
					}
				}
			}

			// Update poll data (but not in test mode)
			if (!isTestMode) {
				pollData.lastPollTime = currentPollTime;
				pollData.lastKnownFiles = filteredFiles;
			}

			console.log(`SharePoint Trigger: Found ${newOrModifiedFiles.length} new/modified files to trigger on`);
			
			if (newOrModifiedFiles.length === 0) {
				if (isTestMode) {
					console.log('SharePoint Trigger: Test mode - no files found in folder, providing helpful message');
					// In test mode, provide a helpful message when no files are found
					return [[{
						json: {
							event: 'test',
							trigger: 'smartgentSharePointTrigger',
							testMode: true,
							testNote: 'This is a TEST execution. No files were found in the specified folder.',
							message: `TEST MODE: No files found in folder path: "${folderPath}". Please check: 1) The folder path is correct, 2) There are files in the folder, 3) Your credentials have access to the folder.`,
							folderPath,
							totalFilesFound: filteredFiles.length,
							debug: {
								originalFilesFound: currentFiles.length,
								afterExtensionFilter: filteredFiles.length,
								fileExtensionsFilter: fileExtensions.length > 0 ? fileExtensions : 'none'
							},
							timestamp: new Date().toISOString(),
							nextSteps: [
								'1. Verify the folder path exists in SharePoint',
								'2. Check if there are actually files in that folder',
								'3. Ensure your app registration has proper permissions',
								'4. Try using "/" to test the root folder first'
							]
						}
					}]];
				} else {
					console.log('SharePoint Trigger: No new/modified files found, returning null (no trigger)');
					return null; // No new data
				}
			}

			// Prepare return data
			const returnData: INodeExecutionData[] = [];

			for (const file of newOrModifiedFiles) {
				let executionData: INodeExecutionData = {
					json: {
						event: isTestMode ? 'test' : event,
						trigger: 'smartgentSharePointTrigger',
						...(isTestMode && { 
							testMode: true,
							testNote: 'This is a TEST execution showing existing files. In normal operation, only NEW or MODIFIED files will trigger this workflow.',
							testExecutionTime: currentPollTime
						}),
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
		
		// Decode URL-encoded path and normalize
		const decodedPath = decodeURIComponent(folderPath).trim();
		console.log(`SharePoint Trigger: getDocumentsFromFolder - Original path: "${folderPath}", Decoded: "${decodedPath}"`);
		
		// Check if this is the root folder
		if (this.isRootPath(decodedPath)) {
			url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root/children`;
			console.log('SharePoint Trigger: Using root path URL');
		} else {
			// Clean and validate the path
			const cleanPath = this.cleanFolderPath(decodedPath);
			console.log(`SharePoint Trigger: Cleaned path: "${cleanPath}"`);
			
			if (!cleanPath) {
				throw new ApplicationError(`Invalid folder path: ${folderPath}`);
			}
			
			// Use the clean path to construct the URL
			url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${cleanPath}:/children`;
			console.log('SharePoint Trigger: Using subfolder path URL');
		}

		url += '?$select=id,name,lastModifiedDateTime,size,file,folder,webUrl,@microsoft.graph.downloadUrl';
		console.log(`SharePoint Trigger: Final API URL: ${url}`);

		const options: IHttpRequestOptions = {
			method: 'GET',
			url,
			headers: {
				'Authorization': `Bearer ${token}`,
			},
			json: true,
		};

		try {
			const response = await context.helpers.httpRequest(options);
			console.log(`SharePoint Trigger: API Response status: ${response ? 'Success' : 'No response'}`);
			
			// Ensure response has the expected structure
			if (!response || !response.value || !Array.isArray(response.value)) {
				console.log('SharePoint Trigger: Invalid response structure:', response);
				throw new ApplicationError(`Invalid response from SharePoint API for path: ${folderPath}`);
			}
			
			console.log(`SharePoint Trigger: Response contains ${response.value.length} items`);
			
			// Log all items for debugging
			response.value.forEach((item: any, index: number) => {
				console.log(`SharePoint Trigger: Item ${index}: ${item.name} (${item.file ? 'file' : 'folder'})`);
			});
			
			// Filter only files (not folders)
			const documents = response.value.filter((item: any) => item.file !== undefined);
			console.log(`SharePoint Trigger: Filtered to ${documents.length} files`);
			
			return documents.map((doc: any) => ({
				id: doc.id,
				name: doc.name,
				lastModifiedDateTime: doc.lastModifiedDateTime,
				size: doc.size,
				webUrl: doc.webUrl,
				downloadUrl: doc['@microsoft.graph.downloadUrl'],
				mimeType: doc.file?.mimeType,
			}));
		} catch (error: any) {
			// Provide more specific error information
			if (error.response?.status === 404) {
				throw new ApplicationError(`Folder not found: ${folderPath}. Please verify the path exists in SharePoint.`);
			} else if (error.response?.status === 403) {
				throw new ApplicationError(`Access denied to folder: ${folderPath}. Please check your permissions.`);
			} else if (error.response?.status === 401) {
				throw new ApplicationError(`Authentication failed. Please check your SharePoint credentials.`);
			}
			throw new ApplicationError(`Failed to access folder ${folderPath}: ${error.message}`);
		}
	}

	private static async getDocumentsFromSubfolders(driveId: string, folderPath: string, token: string, context: IPollFunctions): Promise<any[]> {
		try {
			const allFiles: any[] = [];
			const folders = await this.getFoldersFromPath(driveId, folderPath, token, context);
			
			for (const folder of folders) {
				// Get files from this subfolder
				const folderFiles = await this.getDocumentsFromFolder(driveId, folder.path, token, context);
				allFiles.push(...folderFiles);
				
				// Recursively get files from nested subfolders
				const nestedFiles = await this.getDocumentsFromSubfolders(driveId, folder.path, token, context);
				allFiles.push(...nestedFiles);
			}
			
			return allFiles;
		} catch (error) {
			// Don't fail the entire operation if subfolder traversal fails
			console.warn(`Failed to get documents from subfolders of ${folderPath}:`, error);
			return [];
		}
	}

	/**
	 * Check if the given path represents the root folder
	 */
	private static isRootPath(path: string): boolean {
		const normalizedPath = path.toLowerCase().trim();
		return (
			normalizedPath === '/' ||
			normalizedPath === '' ||
			normalizedPath === '/root' ||
			normalizedPath === '/shared documents' ||
			normalizedPath === 'shared documents' ||
			normalizedPath === '/shared%20documents' ||
			normalizedPath === 'shared%20documents'
		);
	}

	/**
	 * Clean and validate a folder path
	 */
	private static cleanFolderPath(path: string): string {
		if (!path || path.trim() === '') {
			return '';
		}

		// Remove leading and trailing slashes/whitespace
		let cleanPath = path.trim();
		
		// Remove leading slash if present
		if (cleanPath.startsWith('/')) {
			cleanPath = cleanPath.substring(1);
		}
		
		// Remove trailing slash if present
		if (cleanPath.endsWith('/')) {
			cleanPath = cleanPath.substring(0, cleanPath.length - 1);
		}
		
		// Validate that the path doesn't contain invalid characters
		const invalidChars = /[<>:"|?*]/;
		if (invalidChars.test(cleanPath)) {
			throw new ApplicationError(`Invalid characters in folder path: ${path}`);
		}
		
		return cleanPath;
	}

	/**
	 * Get folders from a specific path for recursive traversal
	 */
	private static async getFoldersFromPath(driveId: string, folderPath: string, token: string, context: IPollFunctions): Promise<Array<{name: string, path: string}>> {
		let url: string;
		
		const decodedPath = decodeURIComponent(folderPath).trim();
		
		if (this.isRootPath(decodedPath)) {
			url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root/children`;
		} else {
			const cleanPath = this.cleanFolderPath(decodedPath);
			if (!cleanPath) {
				return [];
			}
			url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${cleanPath}:/children`;
		}

		url += '?$select=id,name,folder&$filter=folder ne null';

		const options: IHttpRequestOptions = {
			method: 'GET',
			url,
			headers: {
				'Authorization': `Bearer ${token}`,
			},
			json: true,
		};

		try {
			const response = await context.helpers.httpRequest(options);
			
			if (!response || !response.value || !Array.isArray(response.value)) {
				return [];
			}
			
			return response.value
				.filter((item: any) => item.folder !== undefined)
				.map((folder: any) => ({
					name: folder.name,
					path: this.isRootPath(decodedPath) ? folder.name : `${this.cleanFolderPath(decodedPath)}/${folder.name}`
				}));
		} catch (error) {
			console.warn(`Failed to get folders from path ${folderPath}:`, error);
			return [];
		}
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


