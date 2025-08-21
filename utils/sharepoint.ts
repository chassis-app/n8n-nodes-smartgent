import axios, { AxiosResponse } from 'axios';
import * as fs from 'fs';
import converter from 'json-2-csv';
import {
	SharePointFile,
	SharePointFileWithDownload,
	SharePointFileMetadata,
	TagMetadata,
	MoveFileRequest,
	SharePointResponse,
	SharePointSite,
	SharePointList,
	SharePointDrive,
	SharePointItem
} from './types';

/**
 * Get SharePoint site ID from site URL
 * @param siteUrl - SharePoint site URL
 * @param token - Access token
 * @returns Promise resolving to site ID
 */
export const getSiteId = async (siteUrl: string, token: string): Promise<string> => {
	try {
		const paths = siteUrl.split('sites/');
		const siteName = paths[1].split('/')[0];

		const options = {
			method: 'GET' as const,
			headers: { 'Authorization': 'Bearer ' + token },
			url: `https://graph.microsoft.com/v1.0/sites?search=${siteName}`
		};

		const response = await axios(options);
		const res: SharePointResponse<SharePointSite> = response.data;
		const siteIndex = res.value.findIndex((x) => x.name === siteName);

		if (siteIndex === -1) {
			throw new Error(`Site '${siteName}' not found`);
		}

		return res.value[siteIndex].id;
	} catch (error) {
		console.error('Error getting site ID:', error);
		console.error('Site URL:', siteUrl);
		throw error;
	}
};

/**
 * Get SharePoint list ID from site URL
 * @param siteUrl - SharePoint site URL
 * @param token - Access token
 * @param siteId - Site ID
 * @returns Promise resolving to list ID
 */
export const getListId = async (siteUrl: string, token: string, siteId: string): Promise<string> => {
	const pattern = /sites\/[^\/]+\/([^\/]+)/;
	const match = siteUrl.match(pattern);
	let basicDriveName = '';
	if (match && match[1]) {
		basicDriveName = match[1];
	}
	const webUrl = siteUrl.split(basicDriveName)[0] + basicDriveName;

	const options = {
		method: 'GET' as const,
		headers: { 'Authorization': 'Bearer ' + token },
		url: `https://graph.microsoft.com/v1.0/sites/${siteId}/lists`
	};

	const response = await axios(options);
	const res: SharePointResponse<SharePointList> = response.data;
	const listIndex = res.value.findIndex((x) => x.webUrl === webUrl);

	if (listIndex === -1) {
		throw new Error(`List not found for URL: ${webUrl}`);
	}

	return res.value[listIndex].id;
};

/**
 * Get SharePoint drive ID from site URL
 * @param siteUrl - SharePoint site URL
 * @param token - Access token
 * @param siteId - Site ID
 * @returns Promise resolving to drive ID
 */
export const getDriveId = async (siteUrl: string, token: string, siteId: string): Promise<string> => {
	const options = {
		method: 'GET' as const,
		headers: { 'Authorization': 'Bearer ' + token },
		url: `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`
	};

	const response = await axios(options);
	const res: SharePointResponse<SharePointDrive> = response.data;
	const driveIndex = res.value.findIndex((x) => 
		siteUrl.toLowerCase().startsWith(x.webUrl.toLowerCase())
	);

	if (driveIndex === -1) {
		throw new Error(`Drive not found for site URL: ${siteUrl}`);
	}

	return res.value[driveIndex].id;
};

/**
 * Get folder ID from site URL
 * @param siteUrl - SharePoint site URL
 * @param token - Access token
 * @param driveId - Drive ID
 * @returns Promise resolving to folder ID
 */
export const getFolderId = async (siteUrl: string, token: string, driveId: string): Promise<string> => {
	const pattern = /sites\/[^\/]+\/([^\/]+)/;
	const match = siteUrl.match(pattern);
	let basicDriveName = '';
	if (match && match[1]) {
		basicDriveName = match[1];
	}
	const path = siteUrl.split(basicDriveName)[1];

	let url: string;
	if (path.length === 0) {
		url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root`;
	} else {
		url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${path}`;
	}

	const options = {
		method: 'GET' as const,
		headers: { 'Authorization': 'Bearer ' + token },
		url
	};

	const response = await axios(options);
	return response.data.id;
};

/**
 * Get all files from a SharePoint folder
 * @param siteUrl - SharePoint site URL
 * @param token - Access token
 * @param driveId - Drive ID
 * @returns Promise resolving to array of files
 */
export const getAllFiles = async (siteUrl: string, token: string, driveId: string): Promise<SharePointFile[]> => {
	const pattern = /sites\/[^\/]+\/([^\/]+)/;
	const match = siteUrl.match(pattern);
	let basicDriveName = '';
	if (match && match[1]) {
		basicDriveName = match[1];
	}
	const path = siteUrl.split(basicDriveName)[1];

	const options = {
		method: 'GET' as const,
		headers: { 'Authorization': 'Bearer ' + token },
		url: `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${path}:/children`
	};

	const response = await axios(options);
	const res: SharePointResponse<SharePointItem> = response.data;
	const result: SharePointFile[] = [];

	for (const item of res.value) {
		if (item.file !== undefined) {
			result.push({
				id: item.id,
				name: item.name
			});
		}
	}

	return result;
};

/**
 * Get all files from a SharePoint folder by folder ID
 * @param folderId - Folder ID
 * @param driveId - Drive ID
 * @param token - Access token
 * @returns Promise resolving to array of files with download information
 */
export const getAllFilesByFolderId = async (folderId: string, driveId: string, token: string): Promise<SharePointFileWithDownload[]> => {
	let filesData: SharePointFileWithDownload[] = [];
	let url: string | undefined = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}/children`;

	do {
		const options = {
			method: 'GET' as const,
			headers: { 'Authorization': 'Bearer ' + token },
			url
		};

		const response = await axios(options);
		const res: SharePointResponse<SharePointItem> = response.data;

		const pageFiles = res.value
			.filter(item => item.file !== undefined)
			.map(item => ({
				mic_id: item.id,
				name: item.name,
				downloadlink: item['@microsoft.graph.downloadUrl'] || '',
				last_update: item.lastModifiedDateTime
			}));

		filesData = filesData.concat(pageFiles);
		url = res['@odata.nextLink'];
	} while (url !== undefined);

	return filesData;
};

/**
 * Get all files from a SharePoint list
 * @param siteId - Site ID
 * @param listId - List ID
 * @param folderPath - Folder path
 * @param token - Access token
 * @returns Promise resolving to array of files
 */
export const getAllFilesByListId = async (siteId: string, listId: string, folderPath: string, token: string): Promise<SharePointFileWithDownload[]> => {
	let filesData: SharePointFileWithDownload[] = [];
	let url: string | undefined = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items`;

	do {
		const options = {
			method: 'GET' as const,
			headers: { 'Authorization': 'Bearer ' + token },
			url
		};

		const response = await axios(options);
		const res: SharePointResponse<SharePointItem> = response.data;

		const pageFiles = res.value
			.filter(item => item.webUrl === folderPath)
			.map(item => ({
				mic_id: item.id,
				name: item.name,
				downloadlink: item['@microsoft.graph.downloadUrl'] || '',
				last_update: item.lastModifiedDateTime
			}));

		filesData = filesData.concat(pageFiles);
		url = res['@odata.nextLink'];
	} while (url !== undefined);

	return filesData;
};

/**
 * Get file by list ID and file ID
 * @param siteId - Site ID
 * @param listId - List ID
 * @param fileId - File ID
 * @param token - Access token
 * @returns Promise resolving to file metadata
 */
export const getFileByListId = async (siteId: string, listId: string, fileId: string, token: string): Promise<SharePointFileMetadata> => {
	const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${fileId}`;
	const options = {
		method: 'GET' as const,
		headers: { 'Authorization': 'Bearer ' + token },
		url
	};

	const response = await axios(options);
	const res = response.data;

	return {
		mic_id: res.value.id,
		name: res.value.name,
		downloadlink: res.value['@microsoft.graph.downloadUrl'] || '',
		last_update: res.value.lastModifiedDateTime
	};
};

/**
 * Move a file to a different folder
 * @param request - Move file request parameters
 * @returns Promise resolving to response
 */
export const moveFile = async (request: MoveFileRequest): Promise<AxiosResponse> => {
	const { driveId, fileId, destinationFolderId, token } = request;
	const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}?@microsoft.graph.conflictBehavior=rename`;
	
	const body = {
		parentReference: {
			id: destinationFolderId
		},
		'@microsoft.graph.conflictBehavior': 'rename'
	};

	const options = {
		method: 'PATCH' as const,
		headers: { 
			'Authorization': 'Bearer ' + token, 
			'Content-Type': 'application/json' 
		},
		data: JSON.stringify(body),
		url
	};

	return await axios(options);
};

/**
 * Tag a file with metadata
 * @param fileId - File ID
 * @param siteId - Site ID
 * @param listId - List ID
 * @param token - Access token
 * @param tags - Tags JSON string
 * @returns Promise resolving to response
 */
export const tagFile = async (fileId: string, siteId: string, listId: string, token: string, tags: string): Promise<AxiosResponse> => {
	try {
		// Get the list item ID for the file
		const url_getId = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?$select=driveItem&$expand=driveItem`;
		
		const options1 = {
			method: 'GET' as const,
			headers: { 
				'Authorization': 'Bearer ' + token, 
				'Content-Type': 'application/json' 
			},
			url: url_getId
		};

		const res1 = await axios(options1);
		const items = res1.data.value.filter((item: SharePointItem) => 
			item.driveItem?.id === fileId
		);

		if (items.length === 0) {
			throw new Error(`File with ID ${fileId} not found in list`);
		}

		const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${items[0].id}`;
		
		// Parse tags
		const cleanedTags = tags.replace(/'/g, '"');
		const tagData: TagMetadata = JSON.parse(cleanedTags);

		const tagMetadata = {
			fields: {
				Tag: tagData.tag.department,
				JSON: cleanedTags,
				Department: tagData.tag.department,
				Sensitivity_info: tagData.tag.have_sensitivity_information,
			}
		};

		const options = {
			method: 'PATCH' as const,
			headers: { 
				'Authorization': 'Bearer ' + token, 
				'Content-Type': 'application/json' 
			},
			data: JSON.stringify(tagMetadata),
			url
		};

		return await axios(options);
	} catch (error) {
		console.error('Error tagging file:', error);
		throw error;
	}
};

/**
 * Get file content by file ID
 * @param siteId - Site ID
 * @param driveId - Drive ID
 * @param fileId - File ID
 * @param token - Access token
 * @returns Promise resolving to file stream
 */
export const getFileContentByFileId = async (siteId: string, driveId: string, fileId: string, token: string): Promise<any> => {
	const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${fileId}/content`;
	const options = {
		method: 'GET' as const,
		headers: { 
			'Authorization': 'Bearer ' + token, 
			'Content-Type': 'application/octet-stream' 
		},
		responseType: 'stream' as const,
		url
	};

	const response = await axios(options);
	return response.data;
};

/**
 * Download a file to local storage
 * @param siteId - Site ID
 * @param driveId - Drive ID
 * @param fileId - File ID
 * @param filename - Target filename
 * @param token - Access token
 * @returns Promise resolving to file path
 */
export const downloadFile = async (siteId: string, driveId: string, fileId: string, filename: string, token: string): Promise<string> => {
	const folderPath = `/fileStore/app/${driveId.replace('!', '')}`;
	const path = `${folderPath}/${filename}`;

	const resData = await getFileContentByFileId(siteId, driveId, fileId, token);

	try {
		try { 
			fs.rmSync(`.${path}`); 
		} catch { 
			// File doesn't exist, ignore error
		}
		resData.pipe(fs.createWriteStream(`.${path}`));
	} catch (error) {
		console.error('File system error:', error);
		await fs.promises.writeFile(`.${path}`, resData);
	}

	return path;
};

/**
 * Get file content by download URL
 * @param url - Download URL
 * @param token - Access token (optional for direct download URLs)
 * @returns Promise resolving to file stream
 */
export const getFileContentByUrl = async (url: string, token?: string): Promise<any> => {
	const options: any = {
		method: 'GET',
		responseType: 'stream',
		url
	};

	if (token) {
		options.headers = { 'Authorization': 'Bearer ' + token };
	}

	const response = await axios(options);
	return response.data;
};

/**
 * Get site relative path from SharePoint URL
 * @param siteUrl - SharePoint site URL
 * @returns Site relative path
 */
export const getSiteRelativePathByUrl = (siteUrl: string): string => {
	let match = siteUrl.match(/^https:\/\/[^.]+.sharepoint.com\/(sites|teams)\/([^\/]+)/);
	if (match && match[2]) {
		return `/${match[1]}/${match[2]}`;
	}
	
	match = siteUrl.match(/^https:\/\/[^.]+.sharepoint.com\/([^\/]+)/);
	if (match && match[1]) {
		return `/${match[1]}`;
	}
	
	throw new Error('Incorrect SharePoint site format');
};

/**
 * Upload CSV results to SharePoint
 * @param results - Data to convert to CSV and upload
 * @param folderUrl - Target folder URL
 * @param token - Access token
 * @returns Promise resolving to upload response
 */
export const uploadResult = async (results: any[], folderUrl: string, token: string): Promise<AxiosResponse> => {
	const csv = converter.json2csv(results);
	const csvBuffer = Buffer.from(csv);
	
	const siteId = await getSiteId(folderUrl, token);
	const driveId = await getDriveId(folderUrl, token, siteId);
	const folderId = await getFolderId(folderUrl, token, driveId);
	
	const filename = `${new Date().toISOString().replace(/(-|T|:|\.|Z)/g, '')}_results.csv`;

	if (csvBuffer.length < 250 * 1024 * 1024) {
		// Small file upload
		const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}:/${filename}:/content`;
		const options = {
			method: 'PUT' as const,
			headers: {
				'Authorization': 'Bearer ' + token,
				'Content-Type': 'text/plain'
			},
			data: csvBuffer,
			url
		};
		
		return await axios(options);
	} else {
		// Large file upload with upload session
		const sessionUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}:/${filename}:/createUploadSession`;
		const sessionOptions = {
			method: 'POST' as const,
			headers: {
				'Authorization': 'Bearer ' + token,
				'Content-Type': 'application/json'
			},
			data: JSON.stringify({
				'@microsoft.graph.conflictBehavior': 'replace'
			}),
			url: sessionUrl
		};

		const sessionResponse = await axios(sessionOptions);
		const uploadUrl = sessionResponse.data.uploadUrl;
		const segSize = 327680;

		let finalResponse: AxiosResponse = sessionResponse;
		
		for (let i = 0; i < csvBuffer.length; i += segSize) {
			const options = {
				method: 'PUT' as const,
				headers: {
					'Content-Type': 'text/plain',
					'Content-Range': `bytes ${i}-${Math.min(i + segSize - 1, csvBuffer.length - 1)}/${csvBuffer.length}`
				},
				data: csvBuffer.subarray(i, Math.min(i + segSize, csvBuffer.length)),
				url: uploadUrl
			};
			
			finalResponse = await axios(options);
		}
		
		return finalResponse;
	}
};
