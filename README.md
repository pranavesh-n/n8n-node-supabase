# n8n-nodes-supabase-chat-memory

[![npm version](https://img.shields.io/npm/v/n8n-nodes-supabase-chat-memory.svg)](https://www.npmjs.com/package/n8n-nodes-supabase-chat-memory)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An [n8n](https://n8n.io) community node that provides persistent conversation memory for **n8n AI Agents**, using **Supabase PostgreSQL** as the persistent storage backend.

Connects directly to the **Memory** input (`ai_memory` connection) of any n8n AI Agent node, automatically persisting and restoring conversation history partitioned by session ID and truncated by an adjustable context window.

---

## Table of Contents

- [Features](#features)
- [How to Install in n8n](#how-to-install-in-n8n)
  - [Method 1: Via n8n Community Nodes UI (Recommended)](#method-1-via-n8n-community-nodes-ui-recommended)
  - [Method 2: Docker / Self-Hosted n8n](#method-2-docker--self-hosted-n8n)
  - [Method 3: Custom Dockerfile](#method-3-custom-dockerfile)
  - [Method 4: Local Development (npm link)](#method-4-local-development-npm-link)
- [How to Connect to Supabase Database](#how-to-connect-to-supabase-database)
  - [Step 1: Get Connection Details from Supabase](#step-1-get-connection-details-from-supabase)
  - [Direct Connection vs Connection Pooler (Important)](#direct-connection-vs-connection-pooler-important)
  - [Step 2: Create Credentials in n8n](#step-2-create-credentials-in-n8n)
    - [Option A: Connection String / URI (Fastest & Recommended)](#option-a-connection-string--uri-fastest--recommended)
    - [Option B: Host & Port Parameters](#option-b-host--port-parameters)
  - [Step 3: Test and Save Credential](#step-3-test-and-save-credential)
- [How to Use in AI Workflows](#how-to-use-in-ai-workflows)
- [Node Configuration & Parameters](#node-configuration--parameters)
- [Database Schema & Auto-Creation](#database-schema--auto-creation)
- [Troubleshooting & FAQs](#troubleshooting--faqs)
- [Development & Testing](#development--testing)
- [License](#license)

---

## Features

- 🧠 **Native AI Agent Integration**: Supplies conversation memory directly to the n8n AI Agent node via `@n8n/ai-node-sdk` (`NodeConnectionTypes.AiMemory`).
- ⚡ **Supabase PostgreSQL Storage**: High-performance persistent storage hosted in your Supabase project.
- 🔌 **Dual Connection Modes**:
  - **Connection String / URI**: Paste your direct or Supavisor transaction pooler URI.
  - **Host & Port Parameters**: Configure individual host, port, user, password, and SSL settings.
- 🔄 **Built-in Connection Pooling**: Reuses PostgreSQL connections via `pg.Pool` with connection caching and automatic recovery from idle socket disconnects.
- 🪟 **Context Window Management**: Restricts the number of previous interaction turns returned to the AI agent to prevent context exhaustion and reduce LLM token costs.
- 🛠️ **Automatic Table & Index Creation**: Automatically initializes the target schema, table (`n8n_chat_histories`), and index on `session_id` on first execution.
- 🔒 **Enterprise-Grade Security**:
  - Parameterized queries to eliminate SQL injection risks.
  - Strict SQL identifier validation (`^[a-zA-Z_][a-zA-Z0-9_]*$`).
  - Automatic database password masking in error messages and logs.
- 🎨 **Theme-Aware Branding**: Includes light and dark mode Supabase icons.

---

## How to Install in n8n

### Method 1: Via n8n Community Nodes UI (Recommended)

1. Open your n8n web interface.
2. In the bottom left menu, navigate to **Settings** > **Community Nodes**.
3. Click **Install**.
4. In the **npm Package Name** field, paste:
   ```text
   n8n-nodes-supabase-chat-memory
   ```
5. Check the box agreeing to the risks of installing third-party community code.
6. Click **Install**. n8n will fetch the package from npm and make the node immediately available in your workflow editor under the name **Supabase Chat Memory**.

> **Note**: If the **Community Nodes** option is not visible in your n8n settings, ensure the environment variable `N8N_COMMUNITY_PACKAGES_ENABLED=true` is set on your n8n instance.

---

### Method 2: Docker / Self-Hosted n8n

If you run n8n with Docker or Docker Compose, you can install the package directly into the persistent n8n volume:

#### Using `docker exec`:
```bash
docker exec -it <n8n-container-name> npm install n8n-nodes-supabase-chat-memory
```
Restart the container afterwards:
```bash
docker restart <n8n-container-name>
```

#### Inside the `.n8n` directory:
If your n8n data directory is mapped to a local folder (e.g., `~/.n8n`):
```bash
cd ~/.n8n/nodes
npm install n8n-nodes-supabase-chat-memory
```
Then restart n8n.

---

### Method 3: Custom Dockerfile

To bake this node permanently into your n8n Docker image:

```dockerfile
FROM n8nio/n8n:latest

USER root
RUN cd /usr/local/lib/node_modules/n8n && npm install n8n-nodes-supabase-chat-memory
USER node
```

Build and run your custom image:
```bash
docker build -t custom-n8n:latest .
docker run -it --rm --name n8n -p 5678:5678 custom-n8n:latest
```

---

### Method 4: Local Development (npm link)

If you are developing or testing local changes:

1. Clone and build this repository:
   ```bash
   git clone https://github.com/pranavesh-n/n8n-node-supabase.git
   cd n8n-nodes-supabase
   npm install
   npm run build
   npm link
   ```
2. Link it into your local n8n installation:
   ```bash
   cd ~/.n8n/nodes
   npm link n8n-nodes-supabase-chat-memory
   ```
3. Restart n8n.

---

## How to Connect to Supabase Database

### Step 1: Get Connection Details from Supabase

1. Log into your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project.
3. Click the **Project Settings** (gear icon) in the left sidebar.
4. Select **Database** under Configuration.
5. Scroll down to the **Connection parameters** / **Connection string** section.

---

### Direct Connection vs Connection Pooler (Important)

Supabase offers two connection modes:

| Mode | Host Format | Port | User Format | Notes |
|---|---|---|---|---|
| **Connection Pooler (Supavisor)** *(Recommended)* | `aws-0-[region].pooler.supabase.com` | `6543` (Transaction) or `5432` (Session) | `postgres.[project-ref]` | Supports IPv4 & IPv6, handles high concurrency, recommended for serverless/containers. |
| **Direct Connection** | `db.[project-ref].supabase.co` | `5432` | `postgres` | Requires IPv6 network support or the Supabase IPv4 Add-on. |

> 💡 **Recommendation**: Use the **Connection Pooler (Supavisor)** on port `6543` (Transaction mode) or `5432` (Session mode). It works seamlessly over IPv4 networks and Docker environments without connection timeouts.

---

### Step 2: Create Credentials in n8n

1. In n8n, navigate to **Credentials** in the left sidebar.
2. Click **Add Credential** and search for **Supabase PostgreSQL Connection**.
3. Choose your preferred configuration type:

#### Option A: Connection String / URI (Fastest & Recommended)

1. In Supabase Dashboard under **Project Settings > Database > Connection string**, select the **URI** tab.
2. Switch mode to **Transaction** (port `6543`) or **Session** (port `5432`).
3. Copy the URI string. It looks like this:
   ```text
   postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
4. In n8n, set **Configuration Type** to `Connection String / URI`.
5. Paste the URI into the **Connection String** field and replace `[YOUR-PASSWORD]` with your actual Supabase database password.

---

#### Option B: Host & Port Parameters

In n8n, set **Configuration Type** to `Host & Port Parameters` and fill in:

| Field | Supavisor Pooler (Recommended) | Direct Connection |
|---|---|---|
| **Host** | `aws-0-[region].pooler.supabase.com` | `db.[project-ref].supabase.co` |
| **Port** | `6543` (Transaction) or `5432` (Session) | `5432` |
| **Database** | `postgres` | `postgres` |
| **User** | `postgres.[project-ref]` | `postgres` |
| **Password** | Your database password | Your database password |
| **SSL** | `Require (Recommended)` | `Require (Recommended)` |

> 🔑 **Forgot your Supabase Database Password?**  
> In Supabase Dashboard, go to **Project Settings > Database**, scroll to **Database password**, and click **Reset database password**.

---

### Step 3: Test and Save Credential

1. Once entered, click **Save** in n8n.
2. n8n will verify the connection to your Supabase PostgreSQL database.
3. If successful, your credential is ready to be used in workflows!

---

## How to Use in AI Workflows

### 1. Build the Workflow

Connect the **Supabase Chat Memory** node to the **Memory** input port of your **AI Agent** node:

```text
[Chat Trigger / Webhook] ──> [AI Agent] ──> [Output]
                                  │
                                  ▼ (Memory input)
                      [Supabase Chat Memory]
```

### 2. Configure the Node

1. Select your **Supabase PostgreSQL Connection** credential.
2. **Session ID**:
   - `From Input (Default)`: Automatically extracts `sessionId` from the chat trigger or webhook payload.
   - `Define Below`: Provide a custom expression or string (e.g., `{{ $json.chatInput.sessionId }}` or `{{ $json.userId }}`).
3. **Context Window Length**: Set how many interaction turns (user + assistant pairs) to load into context (default: `5`).
4. **Auto-Create Table**: Keep enabled (`true`). The node automatically creates the schema, table (`n8n_chat_histories`), and index if they do not exist yet.

### 3. Verify in Supabase

After running the workflow or sending a chat message:
1. Open your Supabase Dashboard.
2. Go to **Table Editor**.
3. Select table **n8n_chat_histories** in schema **public**.
4. You will see saved conversation records with `id`, `session_id`, `message` (JSONB), and `created_at`.

---

## Node Configuration & Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| **Credential** | Credential | — | Select configured Supabase PostgreSQL credential. |
| **Session ID** | Options | `From Input (Default)` | `From Input`: reads session ID from trigger payload.<br>`Define Below`: use custom expression or string. |
| **Session Key** | String | `""` | The session ID value or expression (active when `Define Below` is chosen). |
| **Table Name** | String | `n8n_chat_histories` | Name of the table storing conversation messages. |
| **Schema** | String | `public` | PostgreSQL schema name. |
| **Context Window Length** | Number | `5` | Maximum number of message turns retrieved and sent to the LLM. |
| **Auto-Create Table** | Boolean | `true` | Automatically creates schema, table, and index on first execution if missing. |

---

## Database Schema & Auto-Creation

When **Auto-Create Table** is enabled, the node runs the following DDL statements automatically on first execution:

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
- `id`: Auto-incrementing 64-bit primary key ensuring chronological ordering.
- `session_id`: Unique identifier partitioning messages by conversation or user.
- `message`: JSONB representation of the message (compatible with `@n8n/ai-node-sdk` and LangChain message structures).
- `created_at`: Timestamp with time zone of message persistence.

---

## Troubleshooting & FAQs

### 1. `password authentication failed for user "postgres"`
- Double-check the database password in your credentials.
- If using the **Connection Pooler**, verify your user is formatted as `postgres.[project-ref]` (e.g. `postgres.abcdefghijklmnop`), NOT just `postgres`.

### 2. `connect ETIMEDOUT` or `getaddrinfo ENOTFOUND`
- If using direct host `db.[project-ref].supabase.co:5432`, your network or Docker host may lack IPv6 connectivity.
- **Fix**: Switch to the Supabase **Connection Pooler** host (`aws-0-[region].pooler.supabase.com`) on port `6543`, which supports IPv4.

### 3. `SSL SYSCALL error: EOF detected` or SSL handshake errors
- Set **SSL** to `Require (Recommended)`. Supabase requires SSL encryption for all PostgreSQL connections.
- Ensure the port corresponds to the connection mode (`6543` for transaction pooler, `5432` for direct/session pooler).

### 4. `permission denied for schema public` or table creation errors
- Ensure your database user has permission to create tables in the `public` schema (the default `postgres` role has full permissions).
- If your DBA restricts DDL in production, disable `Auto-Create Table` and run the SQL script above manually in the Supabase SQL Editor.

---

## Development & Testing

### Build
```bash
npm run build
```
Compiles TypeScript into `dist/`, runs the postbuild asset copier, and copies light/dark icons.

### Run Tests
```bash
npm test
```
Runs the test suite across unit, credential, database pooling, table creation, and message windowing tests.

---

## License

[MIT](LICENSE.md) © 2026 Pranavesh N
