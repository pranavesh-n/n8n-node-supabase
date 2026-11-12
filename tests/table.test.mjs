import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ensureTableExists } from '../dist/nodes/SupabaseChatMemory/db.js';

describe('ensureTableExists (table.ts)', () => {
	function createMockDb(config = {}) {
		const executedQueries = [];
		const client = {
			executedQueries,
			async query(sql, params = []) {
				executedQueries.push({ sql: sql.trim(), params });
				const cleanSql = sql.toLowerCase();

				if (cleanSql.includes('information_schema.tables')) {
					return {
						rows: [{ table_exists: config.tableExists ?? false }],
					};
				}

				if (cleanSql.includes('information_schema.columns')) {
					const columns = config.columns ?? ['id', 'session_id', 'message', 'created_at'];
					return {
						rows: columns.map((col) => ({ column_name: col })),
					};
				}

				return { rows: [] };
			},
		};
		return client;
	}

	it('should create schema, table, and index when table does not exist and autoCreateTable is true', async () => {
		const mockDb = createMockDb({ tableExists: false });
		const result = await ensureTableExists(mockDb, 'public', 'n8n_chat_histories', true);

		assert.deepEqual(result, { fullTableName: '"public"."n8n_chat_histories"' });
		assert.equal(mockDb.executedQueries.length, 3);

		// Query 1: information_schema.tables check
		assert.ok(mockDb.executedQueries[0].sql.includes('information_schema.tables'));
		assert.deepEqual(mockDb.executedQueries[0].params, ['public', 'n8n_chat_histories']);

		// Query 2: CREATE TABLE IF NOT EXISTS
		const createTableSql = mockDb.executedQueries[1].sql;
		assert.ok(createTableSql.includes('CREATE TABLE IF NOT EXISTS "public"."n8n_chat_histories"'));
		assert.ok(createTableSql.includes('id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY'));
		assert.ok(createTableSql.includes('session_id TEXT NOT NULL'));
		assert.ok(createTableSql.includes('message JSONB NOT NULL'));
		assert.ok(createTableSql.includes('created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP'));

		// Query 3: CREATE INDEX IF NOT EXISTS
		const createIndexSql = mockDb.executedQueries[2].sql;
		assert.ok(createIndexSql.includes('CREATE INDEX IF NOT EXISTS "idx_public_n8n_chat_histories_sid"'));
		assert.ok(createIndexSql.includes('ON "public"."n8n_chat_histories"(session_id)'));
	});

	it('should create custom schema when schema is not "public"', async () => {
		const mockDb = createMockDb({ tableExists: false });
		const result = await ensureTableExists(mockDb, 'tenant_alpha', 'chat_memory', true);

		assert.deepEqual(result, { fullTableName: '"tenant_alpha"."chat_memory"' });
		assert.equal(mockDb.executedQueries.length, 4);

		// Query 1: table exists check
		assert.ok(mockDb.executedQueries[0].sql.includes('information_schema.tables'));

		// Query 2: CREATE SCHEMA
		assert.equal(mockDb.executedQueries[1].sql, 'CREATE SCHEMA IF NOT EXISTS "tenant_alpha";');

		// Query 3: CREATE TABLE
		assert.ok(mockDb.executedQueries[2].sql.includes('"tenant_alpha"."chat_memory"'));

		// Query 4: CREATE INDEX
		assert.ok(mockDb.executedQueries[3].sql.includes('"idx_tenant_alpha_chat_memory_sid"'));
	});

	it('should throw an actionable error when table does not exist and autoCreateTable is false', async () => {
		const mockDb = createMockDb({ tableExists: false });

		await assert.rejects(
			async () => {
				await ensureTableExists(mockDb, 'public', 'n8n_chat_histories', false);
			},
			(err) => {
				assert.ok(
					err.message.includes(
						'Table "public"."n8n_chat_histories" does not exist in Supabase and "Auto-Create Table" is disabled.',
					),
				);
				assert.ok(err.message.includes('SQL to create manually:'));
				assert.ok(
					err.message.includes('CREATE TABLE IF NOT EXISTS "public"."n8n_chat_histories"'),
				);
				assert.ok(
					err.message.includes('CREATE INDEX IF NOT EXISTS "idx_public_n8n_chat_histories_sid"'),
				);
				return true;
			},
		);

		// Assert no CREATE TABLE queries were executed
		assert.equal(mockDb.executedQueries.length, 1);
		assert.ok(mockDb.executedQueries[0].sql.includes('information_schema.tables'));
	});

	it('should verify column compatibility when table exists and columns are valid', async () => {
		const mockDb = createMockDb({
			tableExists: true,
			columns: ['id', 'session_id', 'message', 'created_at'],
		});

		const result = await ensureTableExists(mockDb, 'public', 'n8n_chat_histories', true);
		assert.deepEqual(result, { fullTableName: '"public"."n8n_chat_histories"' });

		assert.equal(mockDb.executedQueries.length, 2);
		assert.ok(mockDb.executedQueries[0].sql.includes('information_schema.tables'));
		assert.ok(mockDb.executedQueries[1].sql.includes('information_schema.columns'));
		assert.deepEqual(mockDb.executedQueries[1].params, ['public', 'n8n_chat_histories']);
	});

	it('should handle case-insensitive column names when verifying columns', async () => {
		const mockDb = createMockDb({
			tableExists: true,
			columns: ['ID', 'SESSION_ID', 'MESSAGE', 'CREATED_AT'],
		});

		const result = await ensureTableExists(mockDb, 'public', 'n8n_chat_histories', false);
		assert.deepEqual(result, { fullTableName: '"public"."n8n_chat_histories"' });
	});

	it('should throw an error when existing table is missing the "message" column', async () => {
		const mockDb = createMockDb({
			tableExists: true,
			columns: ['id', 'session_id', 'created_at'],
		});

		await assert.rejects(
			async () => {
				await ensureTableExists(mockDb, 'public', 'n8n_chat_histories', true);
			},
			(err) => {
				assert.ok(
					err.message.includes(
						"Existing table \"public\".\"n8n_chat_histories\" is incompatible: missing required columns ('session_id' and 'message').",
					),
				);
				assert.ok(err.message.includes('Found columns: id, session_id, created_at'));
				return true;
			},
		);
	});

	it('should throw an error when existing table is missing the "session_id" column', async () => {
		const mockDb = createMockDb({
			tableExists: true,
			columns: ['id', 'message', 'created_at'],
		});

		await assert.rejects(
			async () => {
				await ensureTableExists(mockDb, 'public', 'n8n_chat_histories', true);
			},
			(err) => {
				assert.ok(
					err.message.includes(
						"Existing table \"public\".\"n8n_chat_histories\" is incompatible: missing required columns ('session_id' and 'message').",
					),
				);
				return true;
			},
		);
	});

	it('should reject invalid SQL identifier inputs before querying database', async () => {
		const mockDb = createMockDb();

		await assert.rejects(
			async () => {
				await ensureTableExists(mockDb, 'public; DROP TABLE users;--', 'valid_table', true);
			},
			/Invalid Schema/,
		);

		await assert.rejects(
			async () => {
				await ensureTableExists(mockDb, 'public', 'bad-table-name', true);
			},
			/Invalid Table Name/,
		);

		assert.equal(mockDb.executedQueries.length, 0, 'No queries should have been executed');
	});
});
