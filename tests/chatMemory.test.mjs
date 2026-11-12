import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { SupabaseChatHistory } from '../dist/nodes/SupabaseChatMemory/SupabaseChatHistory.js';

const require = createRequire(import.meta.url);
const { WindowedChatMemory } = require('@n8n/ai-node-sdk');

describe('SupabaseChatHistory and WindowedChatMemory', () => {
	function createMockPool(initialRows = []) {
		const executedQueries = [];
		let rows = [...initialRows];

		const pool = {
			executedQueries,
			setRows(newRows) {
				rows = [...newRows];
			},
			async query(sql, params = []) {
				executedQueries.push({ sql: sql.trim(), params });
				const cleanSql = sql.toLowerCase().trim();

				if (cleanSql.startsWith('select')) {
					return { rows };
				}

				if (cleanSql.startsWith('insert')) {
					return { rowCount: params.length - 1 };
				}

				if (cleanSql.startsWith('delete')) {
					const deletedCount = rows.length;
					rows = [];
					return { rowCount: deletedCount };
				}

				return { rows: [] };
			},
		};

		return pool;
	}

	const fullTableName = '"public"."n8n_chat_histories"';
	const sessionId = 'test-session-456';

	describe('getMessages', () => {
		it('should query messages for the given session ID ordered by id ASC', async () => {
			const mockPool = createMockPool([
				{
					message: {
						role: 'user',
						content: [{ type: 'text', text: 'Hello' }],
					},
				},
				{
					message: {
						role: 'assistant',
						content: [{ type: 'text', text: 'Hi, how can I help?' }],
					},
				},
			]);

			const history = new SupabaseChatHistory({
				pool: mockPool,
				fullTableName,
				sessionId,
			});

			const messages = await history.getMessages();
			assert.equal(messages.length, 2);
			assert.equal(mockPool.executedQueries.length, 1);

			const executed = mockPool.executedQueries[0];
			assert.ok(executed.sql.includes('SELECT message'));
			assert.ok(executed.sql.includes(`FROM ${fullTableName}`));
			assert.ok(executed.sql.includes('WHERE session_id = $1'));
			assert.ok(executed.sql.includes('ORDER BY id ASC'));
			assert.deepEqual(executed.params, [sessionId]);
		});

		it('should normalize standard @n8n/ai-node-sdk messages correctly', async () => {
			const originalMsg = {
				role: 'user',
				content: [{ type: 'text', text: 'Standard message' }],
			};
			const mockPool = createMockPool([{ message: originalMsg }]);

			const history = new SupabaseChatHistory({
				pool: mockPool,
				fullTableName,
				sessionId,
			});

			const [msg] = await history.getMessages();
			assert.deepEqual(msg, originalMsg);
		});

		it('should normalize LangChain serialized format for human, ai, and system messages', async () => {
			const mockPool = createMockPool([
				{ message: { type: 'human', data: { content: 'Human prompt' } } },
				{ message: { type: 'ai', data: { content: 'AI completion' } } },
				{ message: { type: 'system', data: { content: 'System instruction' } } },
			]);

			const history = new SupabaseChatHistory({
				pool: mockPool,
				fullTableName,
				sessionId,
			});

			const messages = await history.getMessages();
			assert.equal(messages.length, 3);

			assert.deepEqual(messages[0], {
				role: 'user',
				content: [{ type: 'text', text: 'Human prompt' }],
			});
			assert.deepEqual(messages[1], {
				role: 'assistant',
				content: [{ type: 'text', text: 'AI completion' }],
			});
			assert.deepEqual(messages[2], {
				role: 'system',
				content: [{ type: 'text', text: 'System instruction' }],
			});
		});

		it('should normalize generic objects with string content and role variations', async () => {
			const mockPool = createMockPool([
				{ message: { role: 'ai', text: 'AI generated' } },
				{ message: { role: 'assistant', content: 'Assistant reply' } },
				{ message: { role: 'system', content: 'System rule' } },
				{ message: { role: 'tool', content: 'Tool execution result' } },
				{ message: { role: 'unknown_role', content: 'Default to user role' } },
			]);

			const history = new SupabaseChatHistory({
				pool: mockPool,
				fullTableName,
				sessionId,
			});

			const messages = await history.getMessages();
			assert.equal(messages.length, 5);

			assert.equal(messages[0].role, 'assistant');
			assert.equal(messages[0].content[0].text, 'AI generated');

			assert.equal(messages[1].role, 'assistant');
			assert.equal(messages[1].content[0].text, 'Assistant reply');

			assert.equal(messages[2].role, 'system');
			assert.equal(messages[2].content[0].text, 'System rule');

			assert.equal(messages[3].role, 'tool');
			assert.equal(messages[3].content[0].text, 'Tool execution result');

			assert.equal(messages[4].role, 'user');
			assert.equal(messages[4].content[0].text, 'Default to user role');
		});

		it('should handle raw strings or falsy values in message column', async () => {
			const mockPool = createMockPool([
				{ message: 'Raw string message' },
				{ message: null },
			]);

			const history = new SupabaseChatHistory({
				pool: mockPool,
				fullTableName,
				sessionId,
			});

			const messages = await history.getMessages();
			assert.equal(messages.length, 2);

			assert.deepEqual(messages[0], {
				role: 'user',
				content: [{ type: 'text', text: 'Raw string message' }],
			});
			assert.deepEqual(messages[1], {
				role: 'user',
				content: [{ type: 'text', text: '' }],
			});
		});
	});

	describe('addMessage', () => {
		it('should execute parameterized INSERT for a single message', async () => {
			const mockPool = createMockPool();
			const history = new SupabaseChatHistory({
				pool: mockPool,
				fullTableName,
				sessionId,
			});

			const messageToAdd = {
				role: 'user',
				content: [{ type: 'text', text: 'New question' }],
			};

			await history.addMessage(messageToAdd);

			assert.equal(mockPool.executedQueries.length, 1);
			const executed = mockPool.executedQueries[0];
			assert.ok(executed.sql.includes(`INSERT INTO ${fullTableName} (session_id, message)`));
			assert.ok(executed.sql.includes('VALUES ($1, $2);'));
			assert.deepEqual(executed.params, [sessionId, JSON.stringify(messageToAdd)]);
		});
	});

	describe('addMessages', () => {
		it('should do nothing when messages array is empty', async () => {
			const mockPool = createMockPool();
			const history = new SupabaseChatHistory({
				pool: mockPool,
				fullTableName,
				sessionId,
			});

			await history.addMessages([]);
			assert.equal(mockPool.executedQueries.length, 0);
		});

		it('should execute a single multi-row batch INSERT for multiple messages', async () => {
			const mockPool = createMockPool();
			const history = new SupabaseChatHistory({
				pool: mockPool,
				fullTableName,
				sessionId,
			});

			const msg1 = { role: 'user', content: [{ type: 'text', text: 'Msg 1' }] };
			const msg2 = { role: 'assistant', content: [{ type: 'text', text: 'Msg 2' }] };
			const msg3 = { role: 'user', content: [{ type: 'text', text: 'Msg 3' }] };

			await history.addMessages([msg1, msg2, msg3]);

			assert.equal(mockPool.executedQueries.length, 1);
			const executed = mockPool.executedQueries[0];
			assert.ok(executed.sql.includes(`INSERT INTO ${fullTableName} (session_id, message)`));
			assert.ok(executed.sql.includes('VALUES ($1, $2), ($1, $3), ($1, $4);'));
			assert.deepEqual(executed.params, [
				sessionId,
				JSON.stringify(msg1),
				JSON.stringify(msg2),
				JSON.stringify(msg3),
			]);
		});
	});

	describe('clear', () => {
		it('should execute DELETE query filtering by session ID', async () => {
			const mockPool = createMockPool([
				{ message: { role: 'user', content: [{ type: 'text', text: 'Existing' }] } },
			]);

			const history = new SupabaseChatHistory({
				pool: mockPool,
				fullTableName,
				sessionId,
			});

			await history.clear();

			assert.equal(mockPool.executedQueries.length, 1);
			const executed = mockPool.executedQueries[0];
			assert.ok(executed.sql.includes(`DELETE FROM ${fullTableName}`));
			assert.ok(executed.sql.includes('WHERE session_id = $1'));
			assert.deepEqual(executed.params, [sessionId]);
		});
	});

	describe('WindowedChatMemory Integration', () => {
		it('should truncate messages to context window length turns', async () => {
			// In @n8n/ai-node-sdk, 1 turn = 2 messages (user + assistant).
			// Window size = 2 turns => maxMessages = 4.
			const mockPool = createMockPool([
				{ message: { role: 'user', content: [{ type: 'text', text: '1' }] } },
				{ message: { role: 'assistant', content: [{ type: 'text', text: '2' }] } },
				{ message: { role: 'user', content: [{ type: 'text', text: '3' }] } },
				{ message: { role: 'assistant', content: [{ type: 'text', text: '4' }] } },
				{ message: { role: 'user', content: [{ type: 'text', text: '5' }] } },
				{ message: { role: 'assistant', content: [{ type: 'text', text: '6' }] } },
			]);

			const history = new SupabaseChatHistory({
				pool: mockPool,
				fullTableName,
				sessionId,
			});

			const memory = new WindowedChatMemory(history, { windowSize: 2 });
			const loadedMessages = await memory.loadMessages();

			assert.equal(loadedMessages.length, 4);
			assert.equal(loadedMessages[0].content[0].text, '3');
			assert.equal(loadedMessages[1].content[0].text, '4');
			assert.equal(loadedMessages[2].content[0].text, '5');
			assert.equal(loadedMessages[3].content[0].text, '6');
		});

		it('should return all messages when message count is less than window limit', async () => {
			const mockPool = createMockPool([
				{ message: { role: 'user', content: [{ type: 'text', text: 'A' }] } },
				{ message: { role: 'assistant', content: [{ type: 'text', text: 'B' }] } },
			]);

			const history = new SupabaseChatHistory({
				pool: mockPool,
				fullTableName,
				sessionId,
			});

			const memory = new WindowedChatMemory(history, { windowSize: 5 });
			const loadedMessages = await memory.loadMessages();

			assert.equal(loadedMessages.length, 2);
			assert.equal(loadedMessages[0].content[0].text, 'A');
			assert.equal(loadedMessages[1].content[0].text, 'B');
		});

		it('should return empty array when chat history is empty', async () => {
			const mockPool = createMockPool([]);
			const history = new SupabaseChatHistory({
				pool: mockPool,
				fullTableName,
				sessionId,
			});

			const memory = new WindowedChatMemory(history, { windowSize: 5 });
			const loadedMessages = await memory.loadMessages();

			assert.deepEqual(loadedMessages, []);
		});

		it('should persist turns via saveTurn using batch insert', async () => {
			const mockPool = createMockPool([]);
			const history = new SupabaseChatHistory({
				pool: mockPool,
				fullTableName,
				sessionId,
			});

			const memory = new WindowedChatMemory(history, { windowSize: 3 });
			await memory.saveTurn('User question', 'AI answer');

			assert.equal(mockPool.executedQueries.length, 1);
			const executed = mockPool.executedQueries[0];
			assert.ok(executed.sql.includes('VALUES ($1, $2), ($1, $3);'));
			assert.equal(executed.params[0], sessionId);
			assert.deepEqual(JSON.parse(executed.params[1]), {
				role: 'user',
				content: [{ type: 'text', text: 'User question' }],
			});
			assert.deepEqual(JSON.parse(executed.params[2]), {
				role: 'assistant',
				content: [{ type: 'text', text: 'AI answer' }],
			});
		});

		it('should delegate clear to underlying SupabaseChatHistory', async () => {
			const mockPool = createMockPool();
			const history = new SupabaseChatHistory({
				pool: mockPool,
				fullTableName,
				sessionId,
			});

			const memory = new WindowedChatMemory(history, { windowSize: 3 });
			await memory.clear();

			assert.equal(mockPool.executedQueries.length, 1);
			assert.ok(mockPool.executedQueries[0].sql.includes(`DELETE FROM ${fullTableName}`));
		});
	});
});
