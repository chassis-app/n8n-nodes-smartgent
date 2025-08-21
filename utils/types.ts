// Type definitions for SharePoint utility functions

export interface SharePointFile {
	id: string;
	name: string;
}

export interface SharePointFileWithDownload {
	mic_id: string;
	name: string;
	downloadlink: string;
	last_update: string;
}

export interface GraphAccessTokenOptions {
	tokenEndpoint: string;
	clientId: string;
	clientSecret: string;
	scope?: string;
	grantType?: string;
}

export interface TagMetadata {
	tag: {
		department: string;
		have_sensitivity_information: boolean;
	};
}

export interface SharePointFileMetadata {
	mic_id: string;
	name: string;
	downloadlink: string;
	last_update: string;
}

export interface MoveFileRequest {
	driveId: string;
	fileId: string;
	destinationFolderId: string;
	token: string;
}

export interface UploadSessionResponse {
	uploadUrl: string;
}

export interface SharePointResponse<T = any> {
	value: T[];
	'@odata.nextLink'?: string;
}

export interface SharePointSite {
	id: string;
	name: string;
	webUrl: string;
}

export interface SharePointList {
	id: string;
	name: string;
	webUrl: string;
}

export interface SharePointDrive {
	id: string;
	name: string;
	webUrl: string;
}

export interface SharePointItem {
	id: string;
	name: string;
	webUrl: string;
	lastModifiedDateTime: string;
	file?: any;
	driveItem?: {
		id: string;
	};
	'@microsoft.graph.downloadUrl'?: string;
}
