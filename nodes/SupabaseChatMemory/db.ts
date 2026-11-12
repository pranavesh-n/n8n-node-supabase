import { Client, Pool, type PoolConfig } from 'pg';
import type { ISupabasePostgresCredentials } from './types.js';

/**
 * Validates that a string is a safe PostgreSQL identifier.
 * Prevents SQL injection by enforcing standard PostgreSQL naming rules.
 */
export function validateSqlIdentifier(name: string, paramName: string): string {
	const trimmed = (name || '').trim();
	if (!trimmed) {
		throw new Error(`${paramName} cannot be empty.`);
	}
	// PostgreSQL identifier rule: start with letter or underscore, followed by letters, numbers, underscores
	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
		throw new Error(
			`Invalid ${paramName} "${name}". Only letters, digits, and underscores are allowed (must begin with a letter or underscore).`,
		);
	}
	if (Buffer.byteLength(trimmed, 'utf8') > 63) {
		throw new Error(
			`${paramName} "${name}" exceeds the PostgreSQL maximum identifier length of 63 bytes.`,
		);
	}
	return trimmed;
}

/**
 * Quotes an identifier safely for PostgreSQL SQL queries.
 */
export function escapeIdentifier(name: string): string {
	return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Generates an index name conforming to the 63-byte PostgreSQL identifier limit.
 */
export function generateIndexName(schema: string, table: string): string {
	const prefix = `idx_${schema}_${table}_sid`;
	if (prefix.length <= 63) {
		return prefix;
	}
	return prefix.substring(0, 63);
}

/**
 * Sanitizes error messages by masking database passwords if present in URLs or strings.
 */
export function sanitizeErrorMessage(message: string): string {
	if (!message) return 'Unknown database error';
	// Mask passwords in postgres://user:password@host or similar connection URI formats
	return message.replace(/(:[^:@/\s]+)(@[^:@/\s]+)/g, ':***$2');
}

/**
 * Constructs a pg.Pool configuration object from credentials.
 */
export function createPgPoolConfig(
	credentials: ISupabasePostgresCredentials,
	timeoutMs = 15000,
): PoolConfig {
	const sslMode = credentials.ssl || 'require';
	let sslConfig: boolean | object = false;
	if (sslMode === 'require') {
		sslConfig = { rejectUnauthorized: false };
	} else if (sslMode === 'verify-ca') {
		sslConfig = {
			rejectUnauthorized: true,
			ca: credentials.caCertificate ? credentials.caCertificate.trim() : undefined,
		};
	} else if (sslMode === 'disable') {
		sslConfig = false;
	}

	const baseConfig: PoolConfig = {
		ssl: sslConfig,
		max: 5,
		idleTimeoutMillis: 30000,
		connectionTimeoutMillis: timeoutMs,
	};

	if (
		credentials.configurationType === 'connectionString' ||
		(!credentials.host && credentials.connectionString)
	) {
		return {
			...baseConfig,
			connectionString: (credentials.connectionString || '').trim(),
		};
	}

	const host = credentials.host?.trim();
	const database = (credentials.database || 'postgres').trim();
	const user = credentials.user?.trim() || 'postgres';
	const password = credentials.password ?? '';
	const port = Number(credentials.port) || 5432;

	return {
		...baseConfig,
		host,
		database,
		user,
		password,
		port,
	};
}

// Global cache of connection pools keyed by connection signature
const poolCache = new Map<string, Pool>();

function getPoolKey(credentials: ISupabasePostgresCredentials): string {
	if (credentials.configurationType === 'connectionString' || credentials.connectionString) {
		return `uri:${credentials.connectionString?.trim()}|ssl:${credentials.ssl}`;
	}
	return `params:${credentials.user}@${credentials.host}:${credentials.port}/${credentials.database}|ssl:${credentials.ssl}`;
}

/**
 * Retrieves an existing pool or creates and caches a new one.
 * Attaches an error handler to avoid uncaught background socket drops.
 */
export function getOrCreatePool(credentials: ISupabasePostgresCredentials): Pool {
	const key = getPoolKey(credentials);
	let pool = poolCache.get(key);
	if (!pool) {
		const config = createPgPoolConfig(credentials);
		pool = new Pool(config);
		// Listen to pool error event to prevent unhandled node crash on socket disconnect
		pool.on('error', (err) => {
			console.warn('[SupabaseChatMemory] Unexpected pool error on idle client:', sanitizeErrorMessage(err.message));
		});
		poolCache.set(key, pool);
	}
	return pool;
}

/**
 * Closes all active pools in the cache (useful during testing and teardown).
 */
export async function closeAllPools(): Promise<void> {
	for (const [key, pool] of poolCache.entries()) {
		try {
			await pool.end();
		} catch {
			// ignore pool termination errors during shutdown
		}
		poolCache.delete(key);
	}
}

/**
 * Tests database connectivity using a short-lived pg.Client.
 */
export async function testDatabaseConnection(
	credentials: ISupabasePostgresCredentials,
): Promise<void> {
	const poolConfig = createPgPoolConfig(credentials, 5000);
	const client = new Client(poolConfig);
	try {
		await client.connect();
		await client.query('SELECT 1;');
	} finally {
		await client.end().catch(() => {});
	}
}

/**
 * Ensures the target schema, table, and index exist and are compatible.
 * Automatically creates them if autoCreate is enabled.
 */
export async function ensureTableExists(
	db: Pool | Client,
	schema: string,
	table: string,
	autoCreate: boolean,
): Promise<{ fullTableName: string }> {
	const validSchema = validateSqlIdentifier(schema, 'Schema');
	const validTable = validateSqlIdentifier(table, 'Table Name');
	const escapedSchema = escapeIdentifier(validSchema);
	const escapedTable = escapeIdentifier(validTable);
	const fullTableName = `${escapedSchema}.${escapedTable}`;

	// Check table existence in information_schema
	const tableExistsQuery = `
		SELECT EXISTS (
			SELECT 1 FROM information_schema.tables 
			WHERE table_schema = $1 AND table_name = $2
		) AS table_exists;
	`;
	const res = await db.query(tableExistsQuery, [validSchema, validTable]);
	const tableExists = res.rows[0]?.table_exists === true;

	if (!tableExists) {
		if (!autoCreate) {
			throw new Error(
				`Table ${fullTableName} does not exist in Supabase and "Auto-Create Table" is disabled.\n` +
					`Please create it manually or enable "Auto-Create Table".\n` +
					`SQL to create manually:\n` +
					`CREATE TABLE IF NOT EXISTS ${fullTableName} (\n` +
					`    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n` +
					`    session_id TEXT NOT NULL,\n` +
					`    message JSONB NOT NULL,\n` +
					`    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP\n` +
					`);\n` +
					`CREATE INDEX IF NOT EXISTS ${escapeIdentifier(generateIndexName(validSchema, validTable))} ON ${fullTableName}(session_id);`,
			);
		}

		// Create schema if needed (only if other than 'public')
		if (validSchema !== 'public') {
			await db.query(`CREATE SCHEMA IF NOT EXISTS ${escapedSchema};`);
		}

		// Create table
		const createTableSql = `
			CREATE TABLE IF NOT EXISTS ${fullTableName} (
				id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
				session_id TEXT NOT NULL,
				message JSONB NOT NULL,
				created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
			);
		`;
		await db.query(createTableSql);

		// Create index on session_id
		const rawIndexName = generateIndexName(validSchema, validTable);
		const escapedIndexName = escapeIdentifier(rawIndexName);
		const createIndexSql = `
			CREATE INDEX IF NOT EXISTS ${escapedIndexName}
			ON ${fullTableName}(session_id);
		`;
		await db.query(createIndexSql);
	} else {
		// Table exists: verify column compatibility
		const columnsQuery = `
			SELECT column_name
			FROM information_schema.columns
			WHERE table_schema = $1 AND table_name = $2;
		`;
		const colRes = await db.query(columnsQuery, [validSchema, validTable]);
		const columns = new Set(colRes.rows.map((r: { column_name: string }) => r.column_name.toLowerCase()));

		if (!columns.has('session_id') || !columns.has('message')) {
			throw new Error(
				`Existing table ${fullTableName} is incompatible: missing required columns ('session_id' and 'message'). Found columns: ${Array.from(columns).join(', ')}.`,
			);
		}
	}

	return { fullTableName };
}
