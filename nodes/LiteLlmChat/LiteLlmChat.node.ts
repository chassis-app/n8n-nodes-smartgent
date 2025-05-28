import type {
	IExecuteFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import { NodeConnectionType } from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';

export class LiteLlmChat implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'LiteLLM Chat',
		name: 'liteLlmChat',
		icon: 'file:smartgent.svg',
		group: ['ai'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["model"]}}',
		description: 'Interact with LiteLLM chat completions API',
		defaults: {
			name: 'LiteLLM Chat',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'smartGentLiteLlmApi',
				required: true,
			},
		],
		requestDefaults: {
			ignoreHttpStatusErrors: true,
		},
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Chat Completion',
						value: 'chatCompletion',
						description: 'Generate a chat completion',
						action: 'Generate a chat completion',
					},
				],
				default: 'chatCompletion',
			},
			{
				displayName: 'Model Name or ID',
				name: 'model',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getModels',
				},
				default: '',
				required: true,
				description: 'The model to use for the completion. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				displayOptions: {
					show: {
						operation: ['chatCompletion'],
					},
				},
			},
			{
				displayName: 'Messages',
				name: 'messages',
				placeholder: 'Add message',
				type: 'fixedCollection',
				default: {},
				typeOptions: {
					multipleValues: true,
				},
				description: 'The messages to generate chat completions for',
				options: [
					{
						name: 'values',
						displayName: 'Message',
						// eslint-disable-next-line n8n-nodes-base/node-param-fixed-collection-type-unsorted-items
						values: [
							{
								displayName: 'Role',
								name: 'role',
								type: 'options',
								options: [
									{
										name: 'System',
										value: 'system',
									},
									{
										name: 'User',
										value: 'user',
									},
									{
										name: 'Assistant',
										value: 'assistant',
									},
								],
								default: 'user',
								description: 'The role of the author of this message',
							},
							{
								displayName: 'Content Type',
								name: 'contentType',
								type: 'options',
								options: [
									{
										name: 'Text Only',
										value: 'text',
									},
								],
								default: 'text',
								description: 'The type of content in this message',
								displayOptions: {
									show: {
										role: ['system'],
									},
								},
							},
							{
								displayName: 'Content Type',
								name: 'contentType',
								type: 'options',
								options: [
									{
										name: 'Text Only',
										value: 'text',
									},
									{
										name: 'Text + File',
										value: 'mixed',
									},
								],
								default: 'text',
								description: 'The type of content in this message',
								displayOptions: {
									show: {
										role: ['user', 'assistant'],
									},
								},
							},
							{
								displayName: 'Text',
								name: 'text',
								type: 'string',
								default: '',
								description: 'The text content of the message',
								displayOptions: {
									show: {
										contentType: ['text'],
									},
								},
							},
							{
								displayName: 'Prompt Text',
								name: 'promptText',
								type: 'string',
								default: '',
								description: 'The text content of the message',
								displayOptions: {
									show: {
										contentType: ['mixed'],
									},
								},
							},
							{
								displayName: 'File URL',
								name: 'fileUrl',
								type: 'string',
								default: '',
								description: 'URL to the file to include in the message',
								displayOptions: {
									show: {
										contentType: ['mixed'],
									},
								},
							},
						],
					},
				],
				displayOptions: {
					show: {
						operation: ['chatCompletion'],
					},
				},
			},
			{
				displayName: 'Response Format',
				name: 'responseFormat',
				type: 'options',
				options: [
					{
						name: 'Default',
						value: 'default',
						description: 'Default response format',
					},
					{
						name: 'JSON Object',
						value: 'json_object',
						description: 'Force the response to be a valid JSON object',
					},
				],
				default: 'default',
				description: 'The format of the response',
				displayOptions: {
					show: {
						operation: ['chatCompletion'],
					},
				},
			},
		],
	};

	methods = {
		loadOptions: {
			async getModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const credentials = await this.getCredentials('smartGentLiteLlmApi');
					const options: IHttpRequestOptions = {
						method: 'GET',
						url: `${credentials.baseUrl}/v1/models`,
						headers: {
							'Authorization': `Bearer ${credentials.apiKey}`,
							'Accept': 'application/json',
						},
						json: true,
					};

					const response = await this.helpers.httpRequest(options);

					const models = response.data || [];
					return models.map((model: any) => ({
						name: model.id,
						value: model.id,
						description: `${model.object}`,
					}));
				} catch (error) {
					// Fallback to default models if API call fails
					return [];
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const operation = this.getNodeParameter('operation', 0);

		for (let i = 0; i < items.length; i++) {
			try {
				if (operation === 'chatCompletion') {
					const model = this.getNodeParameter('model', i) as string;
					const messagesInput = this.getNodeParameter('messages.values', i, []) as any[];
					const responseFormat = this.getNodeParameter('responseFormat', i) as string;

					// Format messages according to the API structure
					const messages = messagesInput.map((message) => {
						if (message.contentType === 'text') {
							return {
								role: message.role,
								content: message.text,
							};
						} else if (message.contentType === 'mixed') {
							return {
								role: message.role,
								content: [
									{
										type: 'text',
										text: message.promptText,
									},
									{
										type: 'file',
										file: {
											file_id: message.fileUrl,
										},
									},
								],
							};
						}
						return message;
					});

					const body: any = {
						model,
						messages,
					};

					// Add response_format if JSON object is selected
					if (responseFormat === 'json_object') {
						body.response_format = { type: 'json_object' };
					}

					const credentials = await this.getCredentials('smartGentLiteLlmApi');
					const options: IHttpRequestOptions = {
						method: 'POST',
						url: `${credentials.baseUrl}/v1/chat/completions`,
						headers: {
							'Authorization': `Bearer ${credentials.apiKey}`,
							'Content-Type': 'application/json',
							'Accept': 'application/json',
						},
						body,
						json: true,
					};

					const response = await this.helpers.httpRequest(options);

					returnData.push({
						json: response,
						pairedItem: {
							item: i,
						},
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
						},
						pairedItem: {
							item: i,
						},
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, {
					itemIndex: i,
				});
			}
		}

		return this.prepareOutputData(returnData);
	}
} 