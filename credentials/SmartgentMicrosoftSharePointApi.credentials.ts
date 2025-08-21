import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SmartgentMicrosoftSharePointApi implements ICredentialType {
	name = 'smartgentMicrosoftSharePointApi';

	displayName = 'Smartgent SharePoint API';

	documentationUrl = 'https://docs.microsoft.com/en-us/graph/api/resources/sharepoint';

	properties: INodeProperties[] = [
		{
			displayName: 'Tenant ID',
			name: 'tenantId',
			type: 'string',
			default: '',
			required: true,
			description: 'Your Azure AD tenant ID (directory ID)',
			placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
		},
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			default: '',
			required: true,
			description: 'The Application (client) ID from your app registration',
			placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
		},
		{
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'The client secret value from your app registration',
		},
		{
			displayName: 'Site URL',
			name: 'siteUrl',
			type: 'string',
			default: '',
			required: true,
			description: 'The SharePoint site URL (e.g., https://contoso.sharepoint.com/sites/sitename)',
			placeholder: 'https://contoso.sharepoint.com/sites/sitename',
		},
		{
			displayName: 'Token Endpoint (Optional)',
			name: 'tokenEndpoint',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: false,
			description: 'Custom token endpoint URL. Leave empty to use default Microsoft endpoint.',
			placeholder: 'https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://login.microsoftonline.com',
			url: '={{$credentials.tenantId}}/v2.0/.well-known/openid-configuration',
			method: 'GET',
		},
		rules: [
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'authorization_endpoint',
					value: '',
					message: 'Connection successful! Tenant ID is valid and accessible.',
				},
			},
		],
	};
}
