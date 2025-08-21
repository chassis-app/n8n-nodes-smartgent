/**
 * Example: How to migrate from JavaScript utilities to TypeScript utilities
 * 
 * BEFORE (using JavaScript files):
 * const { getGraphAccessToken } = require('../../getGraphAccessToken.js');
 * const { getsiteid, getdriveid, getallfileByFolderId } = require('../../sharepoint.js');
 * 
 * AFTER (using TypeScript utilities):
 */

import { 
	getGraphAccessToken, 
	getGraphAccessTokenFromEnv 
} from './graphAuth';

import { 
	getSiteId, 
	getDriveId, 
	getAllFilesByFolderId,
	moveFile,
	tagFile,
	uploadResult 
} from './sharepoint';

import type { 
	SharePointFile, 
	SharePointFileWithDownload,
	MoveFileRequest 
} from './types';

/**
 * Example function showing how to use the new utilities in a node
 */
export async function exampleNodeExecution(siteUrl: string, folderId: string) {
	try {
		// 1. Get access token (two ways)
		
		// Method 1: Using environment variables
		const token = await getGraphAccessTokenFromEnv();
		
		// Method 2: Using custom credentials (from n8n credentials)
		// const token = await getGraphAccessToken({
		//   tokenEndpoint: credentials.tokenEndpoint,
		//   clientId: credentials.clientId,
		//   clientSecret: credentials.clientSecret
		// });

		// 2. Get SharePoint site and drive information
		const siteId = await getSiteId(siteUrl, token);
		const driveId = await getDriveId(siteUrl, token, siteId);

		// 3. Get all files from a folder
		const files: SharePointFileWithDownload[] = await getAllFilesByFolderId(
			folderId, 
			driveId, 
			token
		);

		// 4. Process files (example: move files or add tags)
		for (const file of files) {
			// Example: Move file to another folder
			const moveRequest: MoveFileRequest = {
				driveId,
				fileId: file.mic_id,
				destinationFolderId: 'target-folder-id',
				token
			};
			
			// await moveFile(moveRequest);

			// Example: Tag file with metadata
			const tags = JSON.stringify({
				tag: {
					department: 'IT',
					have_sensitivity_information: false
				}
			});
			
			// await tagFile(file.mic_id, siteId, 'list-id', token, tags);
		}

		// 5. Upload results back to SharePoint
		const results = files.map(file => ({
			name: file.name,
			id: file.mic_id,
			lastModified: file.last_update,
			downloadUrl: file.downloadlink
		}));

		await uploadResult(results, siteUrl, token);

		return {
			success: true,
			filesProcessed: files.length,
			files: files
		};

	} catch (error) {
		throw new Error(`SharePoint operation failed: ${error}`);
	}
}

/**
 * Example of how to use in an n8n node execute function
 */
/*
export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		try {
			const siteUrl = this.getNodeParameter('siteUrl', i) as string;
			const folderId = this.getNodeParameter('folderId', i) as string;

			const result = await exampleNodeExecution(siteUrl, folderId);

			returnData.push({
				json: result,
				pairedItem: { item: i },
			});

		} catch (error) {
			if (this.continueOnFail()) {
				returnData.push({
					json: { error: error.message },
					pairedItem: { item: i },
				});
				continue;
			}
			throw error;
		}
	}

	return [returnData];
}
*/
