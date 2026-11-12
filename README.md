# n8n-nodes-supabase-chat-memory

[![npm version](https://img.shields.io/npm/v/n8n-nodes-supabase-chat-memory.svg)](https://www.npmjs.com/package/n8n-nodes-supabase-chat-memory)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An [n8n](https://n8n.io) community node that provides persistent conversation chat memory for **n8n AI Agents**, using **Supabase PostgreSQL** as the persistent storage backend.

Connects directly to the **Memory** input (`ai_memory` connection) of n8n AI Agents, automatically managing conversation state partitioned by session ID and truncated by an adjustable context window.

---

## Features

- 🧠 **Native AI Agent Integration**: Directly supplies conversation memory to n8n AI Agents (`NodeConnectionTypes.AiMemory`) via `@n8n/ai-node-sdk`.
- ⚡ **Supabase PostgreSQL Storage**: High-performance persistent storage hosted in your Supabase project.
- 🔌 **Dual Connection Modes**:
  - **Host & Port Parameters**: Enter host, port, database, user, password, and SSL settings.
  - **Connection String / URI**: Paste your direct (`postgresql://...:5432/postgres`) or Supavisor transaction pooler URI (`postgresql://...:6543/postgres`).
- 🔄 **Built-in Connection Pooling**: Reuses PostgreSQL connections via `pg.Pool` with connection caching and automatic recovery from idle socket disconnects.
- 🪟 **Context Window Management**: Restricts the number of previous interaction turns returned to the AI agent to prevent context exhaustion and reduce LLM token costs.
- 🛠️ **Automatic Table & Index Creation**: Automatically initializes the target schema, table (`n8n_chat_histories`), and index on `session_id` on first execution.
- 🔒 **Enterprise-Grade Security**:
  - Parameterized queries to prevent SQL injection.
  - Strict SQL identifier validation (`^[a-zA-Z_][a-zA-Z0-9_]*$`).
  - Automatic password masking in error messages.
- 🎨 **Theme-Aware Branding**: Includes light and dark mode Supabase icons.

---

## Installation

### In n8n (Community Nodes UI)

1. Go to **Settings > Community Nodes** in your n8n instance.
2. Select **Install**.
3. Enter `n8n-nodes-supabase-chat-memory` as the package name.
4. Agree to the risks of installing third-party community code and click **Install**.

### Manual Installation (Docker / Self-Hosted)

In your n8n root directory or inside your custom n8n Docker image:

```bash
npm install n8n-nodes-supabase-chat-memory
```

---

## Setup & Credentials

### Creating Credentials

In n8n, navigate to **Credentials > Add Credential > Supabase PostgreSQL Connection**.

You can choose between two configuration types:

#### 1. Host & Port Parameters (Default)
| Field | Description | Example |
|---|---|---|
| **Host** | Supabase database host | `db.xxxxxxxxxxxxxxxxxxxx.supabase.co` |
| **Database** | Database name (default: `postgres`) | `postgres` |
| **User** | PostgreSQL user | `postgres` (or `postgres.[ref]` for pooler) |
| **Password** | Database password | `••••••••••••` |
| **Port** | PostgreSQL port | `5432` (direct/session) or `6543` (transaction pooler) |
| **SSL** | SSL connection mode | `Require (Recommended)` |
| **CA Certificate** | Custom CA certificate PEM (optional) | Only required if `Verify CA` selected |

#### 2. Connection String / URI
Paste your Supabase database connection string directly:
```text
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

> **Tip**: Find your connection string in your Supabase Dashboard under **Project Settings > Database > Connection String**.

---

## Node Parameters

When you add **Supabase Chat Memory** to your workflow, connect its output to the **Memory** input port of your **AI Agent** node:

```
[Chat Trigger] ──> [AI Agent] ──> [Output]
                        │
                        ▼ (Memory input)
            [Supabase Chat Memory]
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| **Session ID** | Options | `From Input (Default)` | Choose whether to read `sessionId` automatically from the input (e.g. Chat Trigger) or specify a custom key. |
| **Session Key** | String | `""` | Expression or literal string identifying the chat session (visible when `Define Below` is selected). |
| **Table Name** | String | `n8n_chat_histories` | Name of the table storing chat messages. |
| **Schema** | String | `public` | PostgreSQL schema containing the chat table. |
| **Context Window Length** | Number | `5` | Maximum number of previous interaction turns returned to the AI model. |
| **Auto-Create Table** | Boolean | `true` | When enabled, automatically creates the schema, table, and index if they do not already exist. |

---

## Database Schema

When `Auto-Create Table` is enabled, the node automatically executes:

```sql
CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE IF NOT EXISTS "public"."n8n_chat_histories" (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id TEXT NOT NULL,
    message JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_public_n8n_chat_histories_sid"
ON "public"."n8n_chat_histories" (session_id);
```

### Table Structure
- `id`: Auto-incrementing primary key ensuring chronological order.
- `session_id`: Unique identifier for each conversation session.
- `message`: JSONB representation of the message payload compatible with `@n8n/ai-node-sdk` and LangChain.
- `created_at`: Timestamp of message insertion.

---

## Development & Testing

### Build
```bash
npm run build
```
Compiles TypeScript, packages metadata, copies light and dark icons, and populates `dist/`.

### Run Tests
```bash
npm test
```
Executes mock and unit test suites verifying credentials, database pooling, table creation, context window slicing, and message persistence without requiring a live database connection.

---

## License

[MIT](LICENSE.md) © 2026 Pranavesh N
