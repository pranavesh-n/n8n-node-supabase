import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	validateSqlIdentifier,
	escapeIdentifier,
	generateIndexName,
	sanitizeErrorMessage,
	createPgPoolConfig,
} from '../dist/nodes/SupabaseChatMemory/db.js';

describe('Database Utility Functions (db.ts)', () => {
	describe('validateSqlIdentifier', () => {
		it('should accept valid PostgreSQL identifiers', () => {
			assert.equal(validateSqlIdentifier('public', 'Schema'), 'public');
			assert.equal(
				validateSqlIdentifier('n8n_chat_histories', 'Table Name'),
				'n8n_chat_histories',
			);
			assert.equal(validateSqlIdentifier('_private_table', 'Table Name'), '_private_table');
			assert.equal(validateSqlIdentifier('Table123', 'Table Name'), 'Table123');
			assert.equal(validateSqlIdentifier('   valid_name   ', 'Table Name'), 'valid_name');
		});

		it('should reject empty or whitespace-only identifiers', () => {
			assert.throws(
				() => validateSqlIdentifier('', 'Schema'),
				/Schema cannot be empty/,
			);
			assert.throws(
				() => validateSqlIdentifier('    ', 'Table Name'),
				/Table Name cannot be empty/,
			);
			assert.throws(
				() => validateSqlIdentifier(null, 'Parameter'),
				/Parameter cannot be empty/,
			);
			assert.throws(
				() => validateSqlIdentifier(undefined, 'Parameter'),
				/Parameter cannot be empty/,
			);
		});

		it('should reject identifiers with invalid characters', () => {
			assert.throws(
				() => validateSqlIdentifier('invalid-name', 'Table Name'),
				/Invalid Table Name "invalid-name"/,
			);
			assert.throws(
				() => validateSqlIdentifier('invalid name', 'Table Name'),
				/Invalid Table Name "invalid name"/,
			);
			assert.throws(
				() => validateSqlIdentifier('table@schema', 'Table Name'),
				/Invalid Table Name "table@schema"/,
			);
			assert.throws(
				() => validateSqlIdentifier('table$schema', 'Table Name'),
				/Invalid Table Name "table\$schema"/,
			);
			assert.throws(
				() => validateSqlIdentifier('table.name', 'Table Name'),
				/Invalid Table Name "table.name"/,
			);
		});

		it('should reject identifiers starting with a number', () => {
			assert.throws(
				() => validateSqlIdentifier('123table', 'Table Name'),
				/Invalid Table Name "123table"/,
			);
		});

		it('should reject SQL injection payloads', () => {
			const injections = [
				'test; DROP TABLE users;--',
				'public"; DELETE FROM users; --',
				"public' OR '1'='1",
				'table/*comment*/',
				'table UNION SELECT * FROM passwords',
				'"public"."n8n_chat_histories"',
				'`backtick_table`',
			];

			for (const payload of injections) {
				assert.throws(
					() => validateSqlIdentifier(payload, 'Identifier'),
					/Invalid Identifier/,
					`Failed to reject SQL injection payload: ${payload}`,
				);
			}
		});

		it('should enforce the PostgreSQL 63-byte maximum identifier length', () => {
			const exactly63 = 'a'.repeat(63);
			assert.equal(validateSqlIdentifier(exactly63, 'Table Name'), exactly63);

			const exceeding64 = 'a'.repeat(64);
			assert.throws(
				() => validateSqlIdentifier(exceeding64, 'Table Name'),
				/exceeds the PostgreSQL maximum identifier length of 63 bytes/,
			);
		});
	});

	describe('escapeIdentifier', () => {
		it('should wrap identifiers in standard double quotes', () => {
			assert.equal(escapeIdentifier('public'), '"public"');
			assert.equal(escapeIdentifier('n8n_chat_histories'), '"n8n_chat_histories"');
		});

		it('should properly escape internal double quotes by doubling them', () => {
			assert.equal(escapeIdentifier('my"table'), '"my""table"');
			assert.equal(escapeIdentifier('table"with"quotes'), '"table""with""quotes"');
		});
	});

	describe('generateIndexName', () => {
		it('should generate standard index name with schema and table', () => {
			const indexName = generateIndexName('public', 'n8n_chat_histories');
			assert.equal(indexName, 'idx_public_n8n_chat_histories_sid');
			assert.ok(indexName.length <= 63);
		});

		it('should truncate index name if exceeding 63 bytes', () => {
			const longSchema = 'very_long_tenant_schema_name_for_organization_system';
			const longTable = 'very_long_table_name_for_persisting_chat_messages_history';
			const indexName = generateIndexName(longSchema, longTable);
			assert.equal(indexName.length, 63);
			assert.ok(indexName.startsWith('idx_'));
		});
	});

	describe('sanitizeErrorMessage', () => {
		it('should mask passwords in connection URI strings', () => {
			const rawError =
				'Failed to connect to postgresql://postgres:SuperSecretPassword123@db.supabase.co:5432/postgres: timeout';
			const sanitized = sanitizeErrorMessage(rawError);
			assert.equal(
				sanitized,
				'Failed to connect to postgresql://postgres:***@db.supabase.co:5432/postgres: timeout',
			);
			assert.ok(!sanitized.includes('SuperSecretPassword123'));
		});

		it('should mask passwords in pooler connection URI with user dots', () => {
			const rawError =
				'connect ECONNREFUSED postgresql://postgres.abcdef:MyComplexPass#99@aws-0-us-east-1.pooler.supabase.com:6543/postgres';
			const sanitized = sanitizeErrorMessage(rawError);
			assert.equal(
				sanitized,
				'connect ECONNREFUSED postgresql://postgres.abcdef:***@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
			);
			assert.ok(!sanitized.includes('MyComplexPass#99'));
		});

		it('should leave safe database error messages unchanged', () => {
			const safeError = 'relation "public"."n8n_chat_histories" does not exist';
			assert.equal(sanitizeErrorMessage(safeError), safeError);
		});

		it('should handle empty or falsy error messages gracefully', () => {
			assert.equal(sanitizeErrorMessage(''), 'Unknown database error');
			assert.equal(sanitizeErrorMessage(null), 'Unknown database error');
			assert.equal(sanitizeErrorMessage(undefined), 'Unknown database error');
		});
	});

	describe('createPgPoolConfig', () => {
		it('should construct valid pool config for parameters mode', () => {
			const creds = {
				configurationType: 'parameters',
				host: 'db.abcdefgh.supabase.co',
				database: 'postgres',
				user: 'postgres',
				password: 'secret_db_password',
				port: 5432,
				ssl: 'require',
			};

			const config = createPgPoolConfig(creds);
			assert.equal(config.host, 'db.abcdefgh.supabase.co');
			assert.equal(config.database, 'postgres');
			assert.equal(config.user, 'postgres');
			assert.equal(config.password, 'secret_db_password');
			assert.equal(config.port, 5432);
			assert.equal(config.max, 5);
			assert.equal(config.idleTimeoutMillis, 30000);
			assert.equal(config.connectionTimeoutMillis, 15000);
			assert.deepEqual(config.ssl, { rejectUnauthorized: false });
		});

		it('should apply fallback defaults when optional parameters are omitted', () => {
			const creds = {
				configurationType: 'parameters',
				host: 'db.supabase.co',
				password: 'pwd',
			};

			const config = createPgPoolConfig(creds);
			assert.equal(config.host, 'db.supabase.co');
			assert.equal(config.database, 'postgres');
			assert.equal(config.user, 'postgres');
			assert.equal(config.port, 5432);
			assert.equal(config.password, 'pwd');
			assert.deepEqual(config.ssl, { rejectUnauthorized: false });
		});

		it('should configure ssl with verify-ca mode and custom CA certificate', () => {
			const caCert = '-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----';
			const creds = {
				configurationType: 'parameters',
				host: 'db.supabase.co',
				ssl: 'verify-ca',
				caCertificate: caCert,
			};

			const config = createPgPoolConfig(creds);
			assert.deepEqual(config.ssl, {
				rejectUnauthorized: true,
				ca: caCert,
			});
		});

		it('should configure ssl as false when ssl is disabled', () => {
			const creds = {
				configurationType: 'parameters',
				host: 'localhost',
				ssl: 'disable',
			};

			const config = createPgPoolConfig(creds);
			assert.equal(config.ssl, false);
		});

		it('should construct valid pool config for connectionString mode', () => {
			const uri =
				'postgresql://postgres.ref:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres';
			const creds = {
				configurationType: 'connectionString',
				connectionString: uri,
				ssl: 'require',
			};

			const config = createPgPoolConfig(creds);
			assert.equal(config.connectionString, uri);
			assert.equal(config.host, undefined);
			assert.deepEqual(config.ssl, { rejectUnauthorized: false });
		});

		it('should auto-detect connectionString mode when host is absent', () => {
			const uri = 'postgresql://user:pass@host:5432/db';
			const creds = {
				connectionString: uri,
			};

			const config = createPgPoolConfig(creds);
			assert.equal(config.connectionString, uri);
		});

		it('should accept custom connection timeout', () => {
			const creds = {
				host: 'db.supabase.co',
			};

			const config = createPgPoolConfig(creds, 5000);
			assert.equal(config.connectionTimeoutMillis, 5000);
		});
	});
});
