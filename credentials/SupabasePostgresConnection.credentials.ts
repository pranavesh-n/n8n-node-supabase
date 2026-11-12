import type {
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

export class SupabasePostgresConnection implements ICredentialType {
	name = 'supabasePostgresConnection';

	displayName = 'Supabase PostgreSQL Connection';

	documentationUrl = 'https://supabase.com/docs/guides/database/connecting-to-postgres';

	icon: Icon = {
		light: 'file:supabase.svg',
		dark: 'file:supabase.dark.svg',
	};

	properties: INodeProperties[] = [
		{
			displayName: 'Configuration Type',
			name: 'configurationType',
			type: 'options',
			options: [
				{
					name: 'Host & Port Parameters',
					value: 'parameters',
					description: 'Configure individual database host, port, user, and password',
				},
				{
					name: 'Connection String / URI',
					value: 'connectionString',
					description: 'Connect using a direct or pooler PostgreSQL URI string',
				},
			],
			default: 'parameters',
			description: 'How to provide PostgreSQL connection details',
		},
		{
			displayName: 'Connection String',
			name: 'connectionString',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			placeholder:
				'postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres',
			description:
				'Supabase PostgreSQL connection string URI. Supports direct (port 5432) or Supavisor transaction pooler (port 6543).',
			displayOptions: {
				show: {
					configurationType: ['connectionString'],
				},
			},
			required: true,
		},
		{
			displayName: 'Host',
			name: 'host',
			type: 'string',
			default: '',
			placeholder: 'db.xxxxxxxxxxxxxxxxxxxx.supabase.co',
			description:
				'The Supabase database host. Found in Supabase Settings -> Database (e.g. direct host db.[ref].supabase.co or connection pooler aws-0-[region].pooler.supabase.com).',
			displayOptions: {
				show: {
					configurationType: ['parameters'],
				},
			},
			required: true,
		},
		{
			displayName: 'Database',
			name: 'database',
			type: 'string',
			default: 'postgres',
			description: 'The database name. Defaults to "postgres" for Supabase.',
			displayOptions: {
				show: {
					configurationType: ['parameters'],
				},
			},
			required: true,
		},
		{
			displayName: 'User',
			name: 'user',
			type: 'string',
			default: 'postgres',
			placeholder: 'postgres or postgres.[project-ref]',
			description:
				'The PostgreSQL user. Default is "postgres", or "postgres.[project-ref]" when connecting via connection pooler.',
			displayOptions: {
				show: {
					configurationType: ['parameters'],
				},
			},
			required: true,
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'The database password set when creating the Supabase project.',
			displayOptions: {
				show: {
					configurationType: ['parameters'],
				},
			},
			required: true,
		},
		{
			displayName: 'Port',
			name: 'port',
			type: 'number',
			default: 5432,
			description:
				'Database port. Port 5432 for direct connection or session pooler; port 6543 for transaction pooler.',
			displayOptions: {
				show: {
					configurationType: ['parameters'],
				},
			},
			required: true,
		},
		{
			displayName: 'SSL',
			name: 'ssl',
			type: 'options',
			options: [
				{
					name: 'Require (Recommended)',
					value: 'require',
					description: 'Require SSL encryption (standard for Supabase databases)',
				},
				{
					name: 'Verify CA',
					value: 'verify-ca',
					description: 'Require SSL and verify the server certificate against a trusted CA',
				},
				{
					name: 'Disable',
					value: 'disable',
					description: 'Do not use SSL (not supported by Supabase cloud)',
				},
			],
			default: 'require',
			description: 'SSL encryption mode for connecting to Supabase PostgreSQL',
		},
		{
			displayName: 'CA Certificate',
			name: 'caCertificate',
			type: 'string',
			typeOptions: {
				rows: 4,
				password: true,
			},
			default: '',
			displayOptions: {
				show: {
					ssl: ['verify-ca'],
				},
			},
			description: 'Custom CA certificate in PEM format for certificate verification',
		},
	];
}
