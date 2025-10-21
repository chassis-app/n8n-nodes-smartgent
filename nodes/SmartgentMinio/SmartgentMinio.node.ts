import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

export class SmartgentMinio implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SmartGent MinIO',
		name: 'smartgentMinio',
		icon: 'file:s3.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Upload files and generate presigned URLs for S3/MinIO',
		defaults: {
			name: 'SmartGent MinIO',
		},
		inputs: ['main' as NodeConnectionType],
		outputs: ['main' as NodeConnectionType],
		credentials: [
			{
				name: 's3MinIO',
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
						name: 'Upload File',
						value: 'upload',
						description: 'Upload a file to S3/MinIO',
						action: 'Upload a file',
					},
					{
						name: 'Generate Presigned URL',
						value: 'presignedUrl',
						description: 'Generate a presigned URL for a file',
						action: 'Generate presigned URL',
					},
					{
						name: 'Upload and Get Presigned URL',
						value: 'uploadAndPresign',
						description: 'Upload a file and immediately generate a presigned URL',
						action: 'Upload file and get presigned URL',
					},
				],
				default: 'uploadAndPresign',
			},
			{
				displayName: 'Bucket Name',
				name: 'bucketName',
				type: 'string',
				default: '',
				required: true,
				description: 'Name of the S3/MinIO bucket',
			},
			{
				displayName: 'File Name',
				name: 'fileName',
				type: 'string',
				default: '',
				required: true,
				description: 'Name of the file in the bucket',
				displayOptions: {
					show: {
						operation: ['upload', 'uploadAndPresign'],
					},
				},
			},
			{
				displayName: 'Object Key',
				name: 'objectKey',
				type: 'string',
				default: '',
				required: true,
				description: 'Key (path) of the object in the bucket',
				displayOptions: {
					show: {
						operation: ['presignedUrl'],
					},
				},
			},
			{
				displayName: 'Binary File',
				name: 'binaryFile',
				type: 'boolean',
				default: true,
				description: 'Whether the file is binary data',
				displayOptions: {
					show: {
						operation: ['upload', 'uploadAndPresign'],
					},
				},
			},
			{
				displayName: 'Input Binary Field',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				description: 'Name of the input binary field containing the file to be uploaded',
				displayOptions: {
					show: {
						operation: ['upload', 'uploadAndPresign'],
						binaryFile: [true],
					},
				},
			},
			{
				displayName: 'File Content',
				name: 'fileContent',
				type: 'string',
				default: '',
				description: 'Content of the file as text',
				displayOptions: {
					show: {
						operation: ['upload', 'uploadAndPresign'],
						binaryFile: [false],
					},
				},
			},
			{
				displayName: 'Content Type',
				name: 'contentType',
				type: 'string',
				default: 'application/octet-stream',
				description: 'MIME type of the file',
				displayOptions: {
					show: {
						operation: ['upload', 'uploadAndPresign'],
					},
				},
			},
			{
				displayName: 'Expiration Time (Seconds)',
				name: 'expirationTime',
				type: 'number',
				default: 3600,
				description: 'Time in seconds until the presigned URL expires',
				displayOptions: {
					show: {
						operation: ['presignedUrl', 'uploadAndPresign'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const bucketName = this.getNodeParameter('bucketName', i) as string;
				const credentials = await this.getCredentials('s3MinIO');

				// Create S3 client
				const s3Config: any = {
					region: credentials.region as string,
					credentials: {
						accessKeyId: credentials.accessKeyId as string,
						secretAccessKey: credentials.secretAccessKey as string,
					},
				};

				// Add endpoint for MinIO
				if (credentials.endpointUrl) {
					s3Config.endpoint = credentials.endpointUrl as string;
					s3Config.forcePathStyle = credentials.forcePathStyle as boolean;
				}

				const s3Client = new S3Client(s3Config);

				if (operation === 'upload' || operation === 'uploadAndPresign') {
					// Upload file
					const fileName = this.getNodeParameter('fileName', i) as string;
					const binaryFile = this.getNodeParameter('binaryFile', i) as boolean;
					const contentType = this.getNodeParameter('contentType', i) as string;

					let fileContent: Buffer;
					let fileSize: number;

					if (binaryFile) {
						const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
						fileContent = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
						fileSize = fileContent.length;
					} else {
						const textContent = this.getNodeParameter('fileContent', i) as string;
						fileContent = Buffer.from(textContent, 'utf8');
						fileSize = fileContent.length;
					}

					// Create upload command
					const uploadCommand = new PutObjectCommand({
						Bucket: bucketName,
						Key: fileName,
						Body: fileContent,
						ContentType: contentType,
						ContentLength: fileSize,
					});

					// Upload the file
					await s3Client.send(uploadCommand);

					// Create the object URL
					const objectUrl = credentials.endpointUrl 
						? `${credentials.endpointUrl}/${bucketName}/${fileName}`
						: `https://${bucketName}.s3.${credentials.region}.amazonaws.com/${fileName}`;

					let result: any = {
						operation: 'upload',
						bucketName,
						fileName,
						fileSize,
						contentType,
						uploadedAt: new Date().toISOString(),
						url: objectUrl,
					};

					// Generate presigned URL if requested
					if (operation === 'uploadAndPresign') {
						const expirationTime = this.getNodeParameter('expirationTime', i) as number;
						
						const getObjectCommand = new GetObjectCommand({
							Bucket: bucketName,
							Key: fileName,
						});

						const presignedUrl = await getSignedUrl(s3Client, getObjectCommand, {
							expiresIn: expirationTime,
						});

						result.presignedUrl = presignedUrl;
						result.expiresAt = new Date(Date.now() + expirationTime * 1000).toISOString();
						result.operation = 'uploadAndPresign';
					}

					returnData.push({
						json: result,
						pairedItem: { item: i },
					});

				} else if (operation === 'presignedUrl') {
					// Generate presigned URL only
					const objectKey = this.getNodeParameter('objectKey', i) as string;
					const expirationTime = this.getNodeParameter('expirationTime', i) as number;

					const getObjectCommand = new GetObjectCommand({
						Bucket: bucketName,
						Key: objectKey,
					});

					const presignedUrl = await getSignedUrl(s3Client, getObjectCommand, {
						expiresIn: expirationTime,
					});

					returnData.push({
						json: {
							operation: 'presignedUrl',
							bucketName,
							objectKey,
							presignedUrl,
							expiresAt: new Date(Date.now() + expirationTime * 1000).toISOString(),
							generatedAt: new Date().toISOString(),
						},
						pairedItem: { item: i },
					});
				}

			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
							operation: this.getNodeParameter('operation', i),
							timestamp: new Date().toISOString(),
						},
						pairedItem: { item: i },
					});
				} else {
					throw new NodeOperationError(this.getNode(), error as Error, {
						itemIndex: i,
					});
				}
			}
		}

		return [returnData];
	}
} 