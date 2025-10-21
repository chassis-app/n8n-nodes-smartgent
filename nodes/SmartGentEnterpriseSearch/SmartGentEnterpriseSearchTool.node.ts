import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	IHttpRequestOptions,
	NodeConnectionType,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export class SmartGentEnterpriseSearchTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SmartGent Enterprise Search Tool',
		name: 'smartGentEnterpriseSearchTool',
		icon: 'file:smartgent.svg',
		group: ['transform'],
		version: 1,
		description: 'SmartGent Enterprise Search tool for AI Agent nodes',
		defaults: {
			name: 'SmartGent Enterprise Search Tool',
		},
		inputs: ['main' as NodeConnectionType],
		outputs: ['main' as NodeConnectionType],
		usableAsTool: true,
		credentials: [
			{
				name: 'smartGentApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Chatbot Name or ID',
				name: 'chatbotGuid',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getChatbots',
				},
				default: '',
				required: true,
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

				// Process the response for tool usage
				let formattedResponse = '';
				if (response.success && response.docs && Array.isArray(response.docs)) {
					// Format the results for the AI agent
					const results = response.docs.map((doc: any, index: number) => {
						return `Result ${index + 1}:\n${doc.content}\nSource: ${doc.org_filename || 'Unknown'} (Page ${doc.page_number || 'Unknown'})`;
					}).join('\n\n---\n\n');

					formattedResponse = `Found ${response.docs.length} results for "${query}":\n\n${results}`;
				} else {
					formattedResponse = `No results found for "${query}".`;
				}

				// Return the response in n8n format
				const executionData: INodeExecutionData = {
					json: {
						query,
						chatbotGuid,
						response: formattedResponse,
						rawResults: response,
						timestamp: new Date().toISOString(),
						resultCount: Array.isArray(response.docs) ? response.docs.length : 0,
					},
					pairedItem: { item: i },
				};

				returnData.push(executionData);

			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
							query: this.getNodeParameter('query', i),
							timestamp: new Date().toISOString(),
						},
						pairedItem: { item: i },
					});
				} else {
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex: i,
						description: `Failed to execute SmartGent Enterprise Search Tool: ${error.message}`,
					});
				}
			}
		}

		return [returnData];
	}
} 