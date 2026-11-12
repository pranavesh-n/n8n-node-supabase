import { BaseChatHistory, type Message, type MessageRole } from '@n8n/ai-node-sdk';
import type { Pool } from 'pg';

export interface ISupabaseChatHistoryOptions {
	pool: Pool;
	fullTableName: string;
	sessionId: string;
}

export class SupabaseChatHistory extends BaseChatHistory {
	private readonly pool: Pool;
	private readonly fullTableName: string;
	private readonly sessionId: string;

	constructor(options: ISupabaseChatHistoryOptions) {
		super();
		this.pool = options.pool;
		this.fullTableName = options.fullTableName;
		this.sessionId = options.sessionId;
	}

	async getMessages(): Promise<Message[]> {
		const query = `
			SELECT message
			FROM ${this.fullTableName}
			WHERE session_id = $1
			ORDER BY id ASC;
		`;
		const result = await this.pool.query(query, [this.sessionId]);
		return result.rows.map((row: { message: unknown }) => this.normalizeMessage(row.message));
	}

	async addMessage(message: Message): Promise<void> {
		const query = `
			INSERT INTO ${this.fullTableName} (session_id, message)
			VALUES ($1, $2);
		`;
		await this.pool.query(query, [this.sessionId, JSON.stringify(message)]);
	}

	override async addMessages(messages: Message[]): Promise<void> {
		if (!messages.length) return;
		const placeholders: string[] = [];
		const params: unknown[] = [this.sessionId];
		for (let i = 0; i < messages.length; i++) {
			params.push(JSON.stringify(messages[i]));
			placeholders.push(`($1, $${i + 2})`);
		}
		const query = `
			INSERT INTO ${this.fullTableName} (session_id, message)
			VALUES ${placeholders.join(', ')};
		`;
		await this.pool.query(query, params);
	}

	async clear(): Promise<void> {
		const query = `
			DELETE FROM ${this.fullTableName}
			WHERE session_id = $1;
		`;
		await this.pool.query(query, [this.sessionId]);
	}

	private normalizeMessage(raw: unknown): Message {
		if (!raw || typeof raw !== 'object') {
			return {
				role: 'user',
				content: [{ type: 'text', text: String(raw ?? '') }],
			};
		}

		const obj = raw as Record<string, unknown>;

		// Already compliant with @n8n/ai-node-sdk Message structure
		if (typeof obj.role === 'string' && Array.isArray(obj.content)) {
			return raw as Message;
		}

		// LangChain serialized message format: { type: 'human' | 'ai' | 'system', data: { content: string } }
		if (typeof obj.type === 'string' && obj.data && typeof obj.data === 'object') {
			const data = obj.data as { content?: string; text?: string };
			const text = String(data.content ?? data.text ?? '');
			let role: MessageRole = 'user';
			if (obj.type === 'human') role = 'user';
			else if (obj.type === 'ai') role = 'assistant';
			else if (obj.type === 'system') role = 'system';
			return {
				role,
				content: [{ type: 'text', text }],
			};
		}

		// Generic fallback: { role?: string, content?: string | text?: string }
		const text = typeof obj.text === 'string' ? obj.text : typeof obj.content === 'string' ? obj.content : JSON.stringify(raw);
		let role: MessageRole = 'user';
		if (obj.role === 'assistant' || obj.role === 'ai') role = 'assistant';
		else if (obj.role === 'system') role = 'system';
		else if (obj.role === 'tool') role = 'tool';

		return {
			role,
			content: [{ type: 'text', text }],
		};
	}
}
