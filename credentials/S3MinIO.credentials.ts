import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class S3MinIO implements ICredentialType {
	name = 's3MinIO';

	displayName = 'S3/MinIO';

	documentationUrl = 'https://docs.aws.amazon.com/s3/';

	properties: INodeProperties[] = [
		{
			displayName: 'Access Key ID',
			name: 'accessKeyId',
			type: 'string',
			default: '',
			required: true,
			description: 'The access key ID for your S3/MinIO account',
		},
		{
			displayName: 'Secret Access Key',
			name: 'secretAccessKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'The secret access key for your S3/MinIO account',
		},
		{
			displayName: 'Region',
			name: 'region',
			type: 'string',
			default: 'us-east-1',
			required: true,
			description: 'The region where your S3 bucket is located (for MinIO, use any valid region)',
		},
		{
			displayName: 'Endpoint URL',
			name: 'endpointUrl',
			type: 'string',
			default: '',
			placeholder: 'https://s3.amazonaws.com (leave empty for AWS S3)',
			description: 'Custom endpoint URL for MinIO or S3-compatible services. Leave empty for AWS S3.',
		},
		{
			displayName: 'Force Path Style',
			name: 'forcePathStyle',
			type: 'boolean',
			default: false,
			description: 'Whether to force path-style URLs (required for MinIO)',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.endpointUrl || "https://s3." + $credentials.region + ".amazonaws.com"}}',
			url: '/',
			method: 'GET',
			skipSslCertificateValidation: true,
			ignoreHttpStatusErrors: true,
		},
		rules: [
			{
				type: 'responseCode',
				properties: {
					value: 403,
					message: 'Endpoint is reachable. 403 Forbidden is expected without authentication. Credentials will be validated when the node is used.',
				},
			},
		],
	};
} 