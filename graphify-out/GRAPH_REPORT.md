# Graph Report - n8n-nodes-groq  (2026-11-12)

## Corpus Check
- 19 files · ~8,124 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 1 file(s) not represented in the graph (top: (none) 1)

## Summary
- 173 nodes · 209 edges · 11 communities (9 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- package.json
- node.test.mjs
- compilerOptions
- db.ts
- postbuild.js
- n8n-nodes-supabase-chat-memory
- SupabaseChatHistory.ts
- scripts
- SupabaseChatHistory
- n8n

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 21 edges
2. `SupabaseChatHistory` - 9 edges
3. `scripts` - 8 edges
4. `n8n-nodes-supabase-chat-memory` - 8 edges
5. `n8n-workflow` - 7 edges
6. `getOrCreatePool()` - 6 edges
7. `ensureTableExists()` - 6 edges
8. `n8n` - 6 edges
9. `@n8n/ai-node-sdk` - 5 edges
10. `pg` - 4 edges

## Surprising Connections (you probably didn't know these)
- `n8n-workflow@^2.16.0` --declares--> `n8n-workflow`  [EXTRACTED]
  package.json → package.json  _Bridges community 0 → community 3_
- `n8n-workflow@*` --declares--> `n8n-workflow`  [EXTRACTED]
  package.json → package.json  _Bridges community 3 → community 6_

## Import Cycles
- None detected.

## Communities (11 total, 2 thin omitted)

### Community 0 - "package.json"
Cohesion: 0.07
Nodes (30): author, email, name, description, devDependencies, eslint@9.32.0, @n8n/node-cli@*, n8n-workflow@^2.16.0 (+22 more)

### Community 1 - "node.test.mjs"
Cohesion: 0.09
Nodes (4): require, { WindowedChatMemory }, { NodeConnectionTypes, NodeOperationError }, require

### Community 2 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, incremental, lib, module, moduleResolution (+14 more)

### Community 3 - "db.ts"
Cohesion: 0.17
Nodes (15): SupabasePostgresConnection, createPgPoolConfig(), ensureTableExists(), escapeIdentifier(), generateIndexName(), getOrCreatePool(), getPoolKey(), poolCache (+7 more)

### Community 4 - "postbuild.js"
Cohesion: 0.11
Nodes (14): fs, path, root, targets, tempIconPath, distCredDir, distNodeDir, { execSync } (+6 more)

### Community 5 - "n8n-nodes-supabase-chat-memory"
Cohesion: 0.11
Nodes (16): 1. Host & Port Parameters (Default), 2. Connection String / URI, Build, Creating Credentials, Database Schema, Development & Testing, Features, In n8n (Community Nodes UI) (+8 more)

### Community 6 - "SupabaseChatHistory.ts"
Cohesion: 0.22
Nodes (8): ISupabaseChatHistoryOptions, dependencies, pg@^8.13.1, peerDependencies, @n8n/ai-node-sdk@*, n8n-workflow@*, @n8n/ai-node-sdk, pg

### Community 7 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, build:watch, lint, lint:fix, prepublishOnly, release, test

### Community 9 - "n8n"
Cohesion: 0.33
Nodes (6): n8n, aiNodeSdkVersion, credentials, n8nNodesApiVersion, nodes, strict

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `n8n-workflow` connect `db.ts` to `package.json`, `node.test.mjs`, `SupabaseChatHistory.ts`?**
  _High betweenness centrality (0.126) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.07459677419354839 - nodes in this community are weakly interconnected._
- **Why does `@n8n/ai-node-sdk` connect `SupabaseChatHistory.ts` to `package.json`, `node.test.mjs`, `db.ts`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Should `node.test.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.08994708994708994 - nodes in this community are weakly interconnected._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `postbuild.js` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._