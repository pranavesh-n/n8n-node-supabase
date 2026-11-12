import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { SupabaseChatMemory } from '../dist/nodes/SupabaseChatMemory/SupabaseChatMemory.node.js';

const require = createRequire(import.meta.url);
const { NodeConnectionTypes, NodeOperationError } = require('n8n-workflow');
const db = require('../dist/nodes/SupabaseChatMemory/db.js');

describe('SupabaseChatMemory Node Definition', () => {
	const node = new SupabaseChatMemory();

	it('should define correct metadata and identifiers', () => {
		assert.equal(node.description.name, 'supabaseChatMemory');
		assert.equal(node.description.displayName, 'Supabase Chat Memory');
		assert.equal(node.description.version, 1);
		assert.ok(node.description.group.includes('transform'));
		assert.equal(
			node.description.description,
			'Stores chat history in Supabase PostgreSQL partitioned by session ID',
		);
		assert.deepEqual(node.description.icon, {
			light: 'file:supabase-chat-memory.svg',
			dark: 'file:supabase-chat-memory.dark.svg',
		});
	});

	it('should define correct input and output connections for n8n AI Agent', () => {
		assert.deepEqual(node.description.inputs, []);
		assert.deepEqual(node.description.outputs, [NodeConnectionTypes.AiMemory]);
		assert.deepEqual(node.description.outputNames, ['Memory']);
	});

	it('should declare required credentials for Supabase PostgreSQL', () => {
		assert.deepEqual(node.description.credentials, [
			{
				name: 'supabasePostgresConnection',
				required: true,
			},
		]);
	});

	it('should configure codex categories and primary documentation', () => {
		const codex = node.description.codex;
		assert.ok(codex);
		assert.ok(codex.categories.includes('AI'));
		assert.deepEqual(codex.subcategories, { AI: ['Memory'] });
		assert.deepEqual(codex.resources, {
			primaryDocumentation: [{ url: 'https://supabase.com/docs' }],
		});
	});

	describe('Node Properties and Defaults', () => {
		const properties = node.description.properties;

		it('should include notice hint for connecting to AI Agent', () => {
			const noticeProp = properties.find((p) => p.name === 'notice');
			assert.ok(noticeProp);
			assert.equal(noticeProp.type, 'notice');
		});

		it('should configure sessionIdType options property defaulting to fromInput', () => {
			const prop = properties.find((p) => p.name === 'sessionIdType');
			assert.ok(prop);
			assert.equal(prop.type, 'options');
			assert.equal(prop.default, 'fromInput');

			const optionValues = prop.options.map((o) => o.value);
			assert.ok(optionValues.includes('fromInput'));
			assert.ok(optionValues.includes('customKey'));
		});

		it('should configure sessionKey string property displayed only for customKey', () => {
			const prop = properties.find((p) => p.name === 'sessionKey');
			assert.ok(prop);
			assert.equal(prop.type, 'string');
			assert.equal(prop.default, '');
			assert.deepEqual(prop.displayOptions, {
				show: {
					sessionIdType: ['customKey'],
				},
			});
		});

		it('should configure tableName with default "n8n_chat_histories"', () => {
			const prop = properties.find((p) => p.name === 'tableName');
			assert.ok(prop);
			assert.equal(prop.type, 'string');
			assert.equal(prop.default, 'n8n_chat_histories');
		});

		it('should configure schema with default "public"', () => {
			const prop = properties.find((p) => p.name === 'schema');
			assert.ok(prop);
			assert.equal(prop.type, 'string');
			assert.equal(prop.default, 'public');
		});

		it('should configure contextWindowLength with default 5 and minimum 1', () => {
			const prop = properties.find((p) => p.name === 'contextWindowLength');
			assert.ok(prop);
			assert.equal(prop.type, 'number');
			assert.equal(prop.default, 5);
			assert.deepEqual(prop.typeOptions, { minValue: 1 });
		});

		it('should configure autoCreateTable boolean with default true', () => {
			const prop = properties.find((p) => p.name === 'autoCreateTable');
			assert.ok(prop);
			assert.equal(prop.type, 'boolean');
			assert.equal(prop.default, true);
		});
	});

	describe('supplyData Session ID Resolution & Execution', () => {
		function createMockExecutionContext(options = {}) {
			const params = {
				sessionIdType: options.sessionIdType ?? 'fromInput',
				sessionKey: options.sessionKey ?? '',
				schema: options.schema ?? 'public',
				tableName: options.tableName ?? 'n8n_chat_histories',
				contextWindowLength: options.contextWindowLength ?? 5,
				autoCreateTable: options.autoCreateTable ?? true,
			};

			return {
				getNode() {
					return { name: 'SupabaseChatMemory' };
				},
				async getCredentials() {
					return {
						configurationType: 'parameters',
						host: 'db.supabase.co',
						database: 'postgres',
						user: 'postgres',
						password: 'pwd',
						port: 5432,
						ssl: 'require',
					};
				},
				getNodeParameter(name, itemIndex, defaultValue) {
					return params[name] !== undefined ? params[name] : defaultValue;
				},
				getBodyData() {
					return options.bodyData ?? {};
				},
				evaluateExpression(expr) {
					if (expr === '{{ $json.sessionId }}') {
						return options.expressionSessionId;
					}
					return undefined;
				},
			};
		}

		it('should throw NodeOperationError when sessionIdType is fromInput and no session ID is found', async () => {
			const context = createMockExecutionContext({
				sessionIdType: 'fromInput',
				bodyData: {},
				expressionSessionId: undefined,
			});

			await assert.rejects(
				async () => {
					await node.supplyData.call(context, 0);
				},
				(err) => {
					assert.ok(err instanceof NodeOperationError);
					assert.ok(
						err.message.includes(
							'No session ID found in input. Connect a Chat Trigger node or choose "Define below" to set a custom key.',
						),
					);
					return true;
				},
			);
		});

		it('should throw NodeOperationError when sessionIdType is customKey and sessionKey is empty', async () => {
			const context = createMockExecutionContext({
				sessionIdType: 'customKey',
				sessionKey: '   ',
			});

			await assert.rejects(
				async () => {
					await node.supplyData.call(context, 0);
				},
				(err) => {
					assert.ok(err instanceof NodeOperationError);
					assert.ok(
						err.message.includes(
							'Session Key cannot be empty when "Define below" is selected.',
						),
					);
					return true;
				},
			);
		});

		it('should resolve session ID from bodyData in fromInput mode and supply memory', async () => {
			const origGetPool = db.getOrCreatePool;
			const origEnsureTable = db.ensureTableExists;

			let capturedSessionId = null;
			const mockPool = { query: async () => ({ rows: [] }) };

			try {
				db.getOrCreatePool = () => mockPool;
				db.ensureTableExists = async (_pool, schema, table) => ({
					fullTableName: `"${schema}"."${table}"`,
				});

				const context = createMockExecutionContext({
					sessionIdType: 'fromInput',
					bodyData: { sessionId: 'body-session-123' },
				});

				const result = await node.supplyData.call(context, 0);
				assert.ok(result);
				assert.ok(result.response, 'supplyData should return a response object');
			} finally {
				db.getOrCreatePool = origGetPool;
				db.ensureTableExists = origEnsureTable;
			}
		});

		it('should resolve session ID from expression in fromInput mode when bodyData is empty', async () => {
			const origGetPool = db.getOrCreatePool;
			const origEnsureTable = db.ensureTableExists;

			const mockPool = { query: async () => ({ rows: [] }) };

			try {
				db.getOrCreatePool = () => mockPool;
				db.ensureTableExists = async (_pool, schema, table) => ({
					fullTableName: `"${schema}"."${table}"`,
				});

				const context = createMockExecutionContext({
					sessionIdType: 'fromInput',
					bodyData: {},
					expressionSessionId: 'expr-session-789',
				});

				const result = await node.supplyData.call(context, 0);
				assert.ok(result);
				assert.ok(result.response);
			} finally {
				db.getOrCreatePool = origGetPool;
				db.ensureTableExists = origEnsureTable;
			}
		});

		it('should resolve session ID in customKey mode and supply memory', async () => {
			const origGetPool = db.getOrCreatePool;
			const origEnsureTable = db.ensureTableExists;

			const mockPool = { query: async () => ({ rows: [] }) };

			try {
				db.getOrCreatePool = () => mockPool;
				db.ensureTableExists = async (_pool, schema, table) => ({
					fullTableName: `"${schema}"."${table}"`,
				});

				const context = createMockExecutionContext({
					sessionIdType: 'customKey',
					sessionKey: 'user-conversation-key-abc',
					schema: 'public',
					tableName: 'n8n_chat_histories',
					contextWindowLength: 10,
					autoCreateTable: true,
				});

				const result = await node.supplyData.call(context, 0);
				assert.ok(result);
				assert.ok(result.response);
			} finally {
				db.getOrCreatePool = origGetPool;
				db.ensureTableExists = origEnsureTable;
			}
		});
	});
});
