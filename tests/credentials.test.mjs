import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SupabasePostgresConnection } from '../dist/credentials/SupabasePostgresConnection.credentials.js';

describe('SupabasePostgresConnection Credentials', () => {
	const credentials = new SupabasePostgresConnection();

	it('should define correct metadata and identifiers', () => {
		assert.equal(credentials.name, 'supabasePostgresConnection');
		assert.equal(credentials.displayName, 'Supabase PostgreSQL Connection');
		assert.equal(
			credentials.documentationUrl,
			'https://supabase.com/docs/guides/database/connecting-to-postgres',
		);
		assert.deepEqual(credentials.icon, {
			light: 'file:supabase-chat-memory.svg',
			dark: 'file:supabase-chat-memory.dark.svg',
		});
	});

	it('should define the required properties array', () => {
		assert.ok(Array.isArray(credentials.properties), 'properties should be an array');
		const propertyNames = credentials.properties.map((p) => p.name);
		assert.ok(propertyNames.includes('configurationType'));
		assert.ok(propertyNames.includes('connectionString'));
		assert.ok(propertyNames.includes('host'));
		assert.ok(propertyNames.includes('database'));
		assert.ok(propertyNames.includes('user'));
		assert.ok(propertyNames.includes('password'));
		assert.ok(propertyNames.includes('port'));
		assert.ok(propertyNames.includes('ssl'));
		assert.ok(propertyNames.includes('caCertificate'));
	});

	describe('Configuration Type property', () => {
		const configTypeProp = credentials.properties.find((p) => p.name === 'configurationType');

		it('should be an options property defaulting to parameters', () => {
			assert.ok(configTypeProp);
			assert.equal(configTypeProp.type, 'options');
			assert.equal(configTypeProp.default, 'parameters');
		});

		it('should provide options for both parameters and connectionString modes', () => {
			assert.ok(configTypeProp);
			const options = configTypeProp.options;
			assert.ok(Array.isArray(options));
			const values = options.map((opt) => opt.value);
			assert.ok(values.includes('parameters'), 'should contain parameters option');
			assert.ok(values.includes('connectionString'), 'should contain connectionString option');
		});
	});

	describe('Connection String mode properties', () => {
		const connStringProp = credentials.properties.find((p) => p.name === 'connectionString');

		it('should configure connectionString with password masking and correct visibility', () => {
			assert.ok(connStringProp);
			assert.equal(connStringProp.type, 'string');
			assert.equal(connStringProp.required, true);
			assert.deepEqual(connStringProp.typeOptions, { password: true });
			assert.deepEqual(connStringProp.displayOptions, {
				show: {
					configurationType: ['connectionString'],
				},
			});
		});
	});

	describe('Parameters mode properties', () => {
		it('should configure host with required flag and parameters conditional', () => {
			const hostProp = credentials.properties.find((p) => p.name === 'host');
			assert.ok(hostProp);
			assert.equal(hostProp.type, 'string');
			assert.equal(hostProp.required, true);
			assert.deepEqual(hostProp.displayOptions, {
				show: {
					configurationType: ['parameters'],
				},
			});
		});

		it('should configure database defaulting to postgres and required', () => {
			const dbProp = credentials.properties.find((p) => p.name === 'database');
			assert.ok(dbProp);
			assert.equal(dbProp.type, 'string');
			assert.equal(dbProp.default, 'postgres');
			assert.equal(dbProp.required, true);
			assert.deepEqual(dbProp.displayOptions, {
				show: {
					configurationType: ['parameters'],
				},
			});
		});

		it('should configure user defaulting to postgres and required', () => {
			const userProp = credentials.properties.find((p) => p.name === 'user');
			assert.ok(userProp);
			assert.equal(userProp.type, 'string');
			assert.equal(userProp.default, 'postgres');
			assert.equal(userProp.required, true);
			assert.deepEqual(userProp.displayOptions, {
				show: {
					configurationType: ['parameters'],
				},
			});
		});

		it('should configure password with password masking and required', () => {
			const pwdProp = credentials.properties.find((p) => p.name === 'password');
			assert.ok(pwdProp);
			assert.equal(pwdProp.type, 'string');
			assert.equal(pwdProp.required, true);
			assert.deepEqual(pwdProp.typeOptions, { password: true });
			assert.deepEqual(pwdProp.displayOptions, {
				show: {
					configurationType: ['parameters'],
				},
			});
		});

		it('should configure port defaulting to 5432 and required', () => {
			const portProp = credentials.properties.find((p) => p.name === 'port');
			assert.ok(portProp);
			assert.equal(portProp.type, 'number');
			assert.equal(portProp.default, 5432);
			assert.equal(portProp.required, true);
			assert.deepEqual(portProp.displayOptions, {
				show: {
					configurationType: ['parameters'],
				},
			});
		});
	});

	describe('SSL security options', () => {
		const sslProp = credentials.properties.find((p) => p.name === 'ssl');
		const caCertProp = credentials.properties.find((p) => p.name === 'caCertificate');

		it('should configure ssl options defaulting to require', () => {
			assert.ok(sslProp);
			assert.equal(sslProp.type, 'options');
			assert.equal(sslProp.default, 'require');
			const values = (sslProp.options || []).map((o) => o.value);
			assert.ok(values.includes('require'));
			assert.ok(values.includes('verify-ca'));
			assert.ok(values.includes('disable'));
		});

		it('should configure caCertificate displayed only for verify-ca with password masking', () => {
			assert.ok(caCertProp);
			assert.equal(caCertProp.type, 'string');
			assert.deepEqual(caCertProp.typeOptions, { rows: 4, password: true });
			assert.deepEqual(caCertProp.displayOptions, {
				show: {
					ssl: ['verify-ca'],
				},
			});
		});
	});
});
