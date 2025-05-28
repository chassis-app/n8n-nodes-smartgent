import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SmartGentLiteLlmApi implements ICredentialType {
	name = 'smartGentLiteLlmApi';

	displayName = 'SmartGent LiteLLM API';

	documentationUrl = 'https://docs.smartgent.ai/api';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Your SmartGent LiteLLM API key (Bearer token)',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://litellm.smartgen.w3btest.com',
			required: true,
			description: 'The base URL for SmartGent LiteLLM API',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'Authorization': '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v1/models',
			method: 'GET',
		},
	};
} 