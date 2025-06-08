import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import axios from 'axios';

export class SmartgentChat implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SmartGent Chat',
		name: 'smartgentChat',
		icon: 'file:smartgent.svg',
		group: ['ai'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["model"]}}',
		description: 'Interact with SmartGent chat completions API',
		defaults: {
			name: 'SmartGent Chat',
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
			{
				displayName: 'Enable Thinking',
				name: 'enableThinking',
				type: 'boolean',
				default: false,
				description: 'Whether to enable thinking mode with budget tokens',
				displayOptions: {
					show: {
						operation: ['chatCompletion'],
					},
				},
			},
			{
				displayName: 'Budget Tokens',
				name: 'budgetTokens',
				type: 'number',
				default: 0,
				description: 'The maximum number of tokens to use for thinking',
				displayOptions: {
					show: {
						operation: ['chatCompletion'],
						enableThinking: [true],
					},
				},
			},
			{
				displayName: 'Temperature',
				name: 'temperature',
				type: 'number',
				default: 0,
				typeOptions: {
					minValue: 0,
					maxValue: 2,
					numberStepSize: 0.1,
				},
				description: 'Controls randomness in the response. 0 = deterministic, 2 = very random.',
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
					
					const response = await axios.get(`${credentials.baseUrl}/v1/models`, {
						headers: {
							'Authorization': `Bearer ${credentials.apiKey}`,
							'Content-Type': 'application/json',
						},
					});

					const models = response.data.data || [];
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
					const enableThinking = this.getNodeParameter('enableThinking', i) as boolean;
					const temperature = this.getNodeParameter('temperature', i) as number;
					const credentials = await this.getCredentials('smartGentLiteLlmApi');

				// Format messages according to the chat completion API structure
				const messages: Array<{
					role: 'system' | 'user' | 'assistant';
					content: string | Array<{
						type: 'text' | 'image_url';
						text?: string;
						image_url?: { url: string };
					}>;
				}> = messagesInput.map((message) => {
					if (message.contentType === 'text') {
						return {
							role: message.role as 'system' | 'user' | 'assistant',
							content: message.text,
						};
					} else if (message.contentType === 'mixed') {
						return {
							role: message.role as 'system' | 'user' | 'assistant',
							content: [
								{
									type: 'text',
									text: message.promptText,
								},
								{
									type: 'image_url',
									image_url: {
										url: message.fileUrl,
									},
								},
							],
						};
					}
					return {
						role: message.role as 'system' | 'user' | 'assistant',
						content: message.text || '',
					};
				});

				const completionParams: any = {
					model,
					messages,
				};

				// Add temperature if set
				if (temperature !== undefined && temperature !== null) {
					completionParams.temperature = temperature;
				}

				// Add response_format if JSON object is selected
				if (responseFormat === 'json_object') {
					completionParams.response_format = { type: 'json_object' };
				}

				// Add thinking configuration if enabled
				if (enableThinking) {
					const budgetTokens = this.getNodeParameter('budgetTokens', i) as number;
					completionParams.thinking = {
						type: 'enabled',
						budget_tokens: budgetTokens,
					};
				}

				const response = await axios.post(`${credentials.baseUrl}/v1/chat/completions`, completionParams, {
					headers: {
						'Authorization': `Bearer ${credentials.apiKey}`,
						'Content-Type': 'application/json',
					},
				});

				returnData.push({
					json: response.data,
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