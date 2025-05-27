import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';

export class SmartGentEnterpriseSearch implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SmartGent Enterprise Search',
		name: 'smartGentEnterpriseSearch',
		icon: 'file:smartgent.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] === "getChatbots" ? "Get Chatbots" : $parameter["operation"] + ": " + $parameter["query"]}}',
		description: 'Search enterprise data using SmartGent AI-powered search',
		defaults: {
			name: 'SmartGent Enterprise Search',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'smartGentApi',
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
						name: 'Get Chatbots',
						value: 'getChatbots',
						description: 'Retrieve list of available chatbots',
						action: 'Retrieve list of available chatbots',
					},
					{
						name: 'Search',
						value: 'search',
						description: 'Search using a selected chatbot',
						action: 'Search using a selected chatbot',
					},
				],
				default: 'getChatbots',
				required: true,
			},
			{
				displayName: 'Chatbot Name or ID',
				name: 'chatbotGuid',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getChatbots',
				},
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['search'],
					},
				},
				description: 'Select the chatbot to use for search. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Search Query',
				name: 'query',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'Enter your search query...',
				description: 'The search query to execute',
				displayOptions: {
					show: {
						operation: ['search'],
					},
				},
			},
			{
				displayName: 'Additional Options',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				options: [
					{
						displayName: 'Max Results',
						name: 'maxResults',
						type: 'number',
						default: 10,
						description: 'Maximum number of results to return',
					},
					{
						displayName: 'Include Pricing',
						name: 'includePricing',
						type: 'boolean',
						default: true,
						description: 'Whether to include pricing information in results',
					},
					{
						displayName: 'Search Filters',
						name: 'filters',
						type: 'fixedCollection',
						placeholder: 'Add Filter',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						options: [
							{
								name: 'filter',
								displayName: 'Filter',
								values: [
									{
										displayName: 'Field',
										name: 'field',
										type: 'string',
										default: '',
										description: 'Field to filter on',
									},
									{
										displayName: 'Value',
										name: 'value',
										type: 'string',
										default: '',
										description: 'Filter value',
									},
								],
							},
						],
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getChatbots(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const credentials = await this.getCredentials('smartGentApi');
					const options: IHttpRequestOptions = {
						method: 'GET',
						url: `${credentials.baseUrl}/api/v1/rag/enterprise/group/chatbot`,
						headers: {
							'smartgen-api-key': credentials.apiKey as string,
							'Accept': 'application/json',
						},
						json: true,
					};

					const response = await this.helpers.httpRequest(options);

					if (response.success && Array.isArray(response.result)) {
						return response.result.map((chatbot: any) => ({
							name: chatbot.name,
							value: chatbot.guid,
						}));
					}

					return [];
				} catch (error) {
					return [];
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;

				if (operation === 'getChatbots') {
					// Get list of chatbots
					const credentials = await this.getCredentials('smartGentApi');
					const options: IHttpRequestOptions = {
						method: 'GET',
						url: `${credentials.baseUrl}/api/v1/rag/enterprise/group/chatbot`,
						headers: {
							'smartgen-api-key': credentials.apiKey as string,
							'Accept': 'application/json',
						},
						json: true,
					};

					const response = await this.helpers.httpRequest(options);

					// Process the response
					const executionData: INodeExecutionData = {
						json: {
							operation: 'getChatbots',
							success: response.success || false,
							chatbots: response.result || [],
							chatbotCount: Array.isArray(response.result) ? response.result.length : 0,
							timestamp: new Date().toISOString(),
						},
						pairedItem: { item: i },
					};

					returnData.push(executionData);

				} else if (operation === 'search') {
					// Perform search with selected chatbot
					const chatbotGuid = this.getNodeParameter('chatbotGuid', i) as string;
					const query = this.getNodeParameter('query', i) as string;
					const additionalFields = this.getNodeParameter('additionalFields', i) as any;

					// Build form data
					const formData: { [key: string]: string } = {
						question: query,
						chatbot_guid: chatbotGuid,
					};

					// Add additional fields if provided
					if (additionalFields.maxResults) {
						formData.limit = additionalFields.maxResults.toString();
					}

					// Convert to URL-encoded string
					const formDataString = Object.keys(formData)
						.map(key => `${encodeURIComponent(key)}=${encodeURIComponent(formData[key])}`)
						.join('&');

					// Make the search API request
					const credentials = await this.getCredentials('smartGentApi');
					const options: IHttpRequestOptions = {
						method: 'POST',
						url: `${credentials.baseUrl}/api/v1/rag/enterprise/groupsearch`,
						headers: {
							'smartgen-api-key': credentials.apiKey as string,
							'Accept': 'application/json',
							'Content-Type': 'application/x-www-form-urlencoded',
						},
						body: formDataString,
						json: true,
					};

					const response = await this.helpers.httpRequest(options);

					// Process the response
					const executionData: INodeExecutionData = {
						json: {
							operation: 'search',
							chatbotGuid,
							query,
							results: response,
							timestamp: new Date().toISOString(),
							resultCount: Array.isArray(response.results) ? response.results.length : 0,
						},
						pairedItem: { item: i },
					};

					returnData.push(executionData);
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
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex: i,
						description: `Failed to execute SmartGent Enterprise Search: ${error.message}`,
					});
				}
			}
		}

		return [returnData];
	}
} 