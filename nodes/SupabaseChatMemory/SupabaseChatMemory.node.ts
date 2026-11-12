import {
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
	type INodeProperties,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';
import { WindowedChatMemory, supplyMemory } from '@n8n/ai-node-sdk';
import type { ISupabasePostgresCredentials } from './types.js';
import { getOrCreatePool, ensureTableExists } from './db.js';
import { SupabaseChatHistory } from './SupabaseChatHistory.js';

export class SupabaseChatMemory implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Supabase Chat Memory',
		name: 'supabaseChatMemory',
		icon: {
			light: 'file:supabase.svg',
			dark: 'file:supabase.dark.svg',
		},
		group: ['transform'],
		version: 1,
		description: 'Stores chat history in Supabase PostgreSQL partitioned by session ID',
		defaults: {
			name: 'Supabase Chat Memory',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Memory'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://supabase.com/docs',
					},
				],
			},
		},
		inputs: [],
		outputs: [NodeConnectionTypes.AiMemory],
		outputNames: ['Memory'],
		credentials: [
			{
				name: 'supabasePostgresConnection',
				required: true,
			},
		],
		properties: [
			{
				displayName:
					'Connect this node to the <b>Memory</b> input of an <b>AI Agent</b> node to persist conversation history in Supabase PostgreSQL.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Session ID',
				name: 'sessionIdType',
				type: 'options',
				options: [
					{
						name: 'From Input (Default)',
						value: 'fromInput',
						description: 'Automatically retrieves session ID from input (e.g. Chat Trigger)',
					},
					{
						name: 'Define Below',
						value: 'customKey',
						description: 'Specify a custom session key or expression',
					},
				],
				default: 'fromInput',
				description: 'How to determine the chat session ID for partitioning history',
			},
			{
				displayName: 'Session Key',
				name: 'sessionKey',
				type: 'string',
				default: '',
				placeholder: 'e.g. {{ $json.sessionId }} or user-1234',
				displayOptions: {
					show: {
						sessionIdType: ['customKey'],
					},
				},
				description: 'The session key used to identify and isolate conversations in Supabase',
			},
			{
				displayName: 'Table Name',
				name: 'tableName',
				type: 'string',
				default: 'n8n_chat_histories',
				description: 'Name of the PostgreSQL table to store chat history',
			},
			{
				displayName: 'Schema',
				name: 'schema',
				type: 'string',
				default: 'public',
				description: 'PostgreSQL schema where the chat history table resides',
			},
			{
				displayName: 'Context Window Length',
				name: 'contextWindowLength',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 5,
				description:
					'Number of previous interaction turns (messages) to provide to the AI Agent',
			},
			{
				displayName: 'Auto-Create Table',
				name: 'autoCreateTable',
				type: 'boolean',
				default: true,
				description:
					'Whether to automatically create the chat memory table and index if they do not exist',
			},
		] as INodeProperties[],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const credentials =
			await this.getCredentials<ISupabasePostgresCredentials>('supabasePostgresConnection');

		const sessionIdType = this.getNodeParameter(
			'sessionIdType',
			itemIndex,
			'fromInput',
		) as string;

		let sessionId = '';
		if (sessionIdType === 'fromInput') {
			const bodyData = (this as any).getBodyData?.() ?? {};
			sessionId =
				bodyData.sessionId ||
				(this.evaluateExpression('{{ $json.sessionId }}', itemIndex) as string);
			if (!sessionId) {
				throw new NodeOperationError(
					this.getNode(),
					'No session ID found in input. Connect a Chat Trigger node or choose "Define below" to set a custom key.',
					{ itemIndex },
				);
			}
		} else {
			sessionId = this.getNodeParameter('sessionKey', itemIndex, '') as string;
			if (!sessionId || !sessionId.trim()) {
				throw new NodeOperationError(
					this.getNode(),
					'Session Key cannot be empty when "Define below" is selected.',
					{ itemIndex },
				);
			}
		}

		const schema = this.getNodeParameter('schema', itemIndex, 'public') as string;
		const tableName = this.getNodeParameter(
			'tableName',
			itemIndex,
			'n8n_chat_histories',
		) as string;
		const contextWindowLength = this.getNodeParameter(
			'contextWindowLength',
			itemIndex,
			5,
		) as number;
		const autoCreateTable = this.getNodeParameter(
			'autoCreateTable',
			itemIndex,
			true,
		) as boolean;

		const pool = getOrCreatePool(credentials);
		const { fullTableName } = await ensureTableExists(
			pool,
			schema,
			tableName,
			autoCreateTable,
		);

		const chatHistory = new SupabaseChatHistory({
			pool,
			fullTableName,
			sessionId,
		});

		const memory = new WindowedChatMemory(chatHistory, {
			windowSize: contextWindowLength,
		});

		return supplyMemory(this as unknown as Parameters<typeof supplyMemory>[0], memory);
	}
}
