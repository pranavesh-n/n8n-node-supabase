import type { IDataObject } from 'n8n-workflow';

export interface ISupabasePostgresCredentials extends IDataObject {
	configurationType?: 'parameters' | 'connectionString';
	connectionString?: string;
	host?: string;
	database?: string;
	user?: string;
	password?: string;
	port?: number;
	ssl?: 'require' | 'verify-ca' | 'disable';
	caCertificate?: string;
}

export interface ISupabaseMemoryParameters {
	sessionIdType: 'fromInput' | 'customKey';
	sessionKey?: string;
	schema: string;
	tableName: string;
	contextWindowLength: number;
	autoCreateTable: boolean;
}
