# Building Relay Extensions

How to build custom extensions for ARC relay servers using the hook system.

## Overview

Extensions modify relay behavior without changing core code. Use cases:
- Message filtering/transformation
- Custom routing logic
- Persistence/logging
- Voting mechanisms
- Semantic search
- Federation

**Reference:** See `/docs/extensions/` for pre-designed extensions.

---

## Extension Interface

```typescript
interface Extension {
  name: string;
  version?: string;
  
  // Lifecycle hooks
  onInit?(relay: RelayServer): Promise<void>;
  onShutdown?(): Promise<void>;
  
  // Connection hooks
  onConnect?(agentId: string, metadata: ConnectionMetadata): Promise<void>;
  onDisconnect?(agentId: string): Promise<void>;
  
  // Message hooks
  onMessage?(message: Message): Promise<Message | null>;
  onBeforeRoute?(message: Message): Promise<Message | null>;
  onRoute?(message: Message, targets: string[]): Promise<string[]>;
  onAfterRoute?(message: Message, targets: string[]): Promise<void>;
  
  // Command hooks
  onCommand?(command: string, payload: any, from: string): Promise<any>;
}
```

**Return `null` from message hooks** to block the message.

---

## Basic Extension Example

### Message Logger

```typescript
import { Extension, Message } from '../types';
import fs from 'fs';

export class MessageLoggerExtension implements Extension {
  name = 'message-logger';
  version = '1.0.0';
  private logFile: string;
  
  constructor(logPath: string = './messages.log') {
    this.logFile = logPath;
  }
  
  async onInit() {
    console.log(`[${this.name}] Initialized`);
  }
  
  async onMessage(message: Message): Promise<Message> {
    const logEntry = JSON.stringify({
      timestamp: message.ts,
      from: message.from,
      to: message.to,
      type: message.type,
      payload: message.payload
    }) + '\n';
    
    fs.appendFileSync(this.logFile, logEntry);
    
    return message;  // Pass through unchanged
  }
}
```

**Register:**
```typescript
const relay = new RelayServer();
relay.registerExtension(new MessageLoggerExtension('./logs/arc-messages.log'));
```

---

## Intermediate Examples

### Profanity Filter

```typescript
export class ProfanityFilterExtension implements Extension {
  name = 'profanity-filter';
  private blockedWords: Set<string>;
  
  constructor(wordList: string[]) {
    this.blockedWords = new Set(wordList.map(w => w.toLowerCase()));
  }
  
  async onMessage(message: Message): Promise<Message | null> {
    const payload = message.payload.toLowerCase();
    
    for (const word of this.blockedWords) {
      if (payload.includes(word)) {
        console.warn(`[${this.name}] Blocked message from ${message.from}`);
        return null;  // Block message
      }
    }
    
    return message;
  }
}
```

### Rate Limiter Extension

```typescript
export class RateLimiterExtension implements Extension {
  name = 'rate-limiter';
  private messageCounts: Map<string, { count: number, resetAt: number }> = new Map();
  private maxPerMinute: number;
  
  constructor(maxPerMinute: number = 100) {
    this.maxPerMinute = maxPerMinute;
  }
  
  async onMessage(message: Message): Promise<Message | null> {
    const now = Date.now();
    const agentId = message.from;
    
    let record = this.messageCounts.get(agentId);
    
    // Reset counter if minute has passed
    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + 60000 };
      this.messageCounts.set(agentId, record);
    }
    
    // Check limit
    if (record.count >= this.maxPerMinute) {
      console.warn(`[${this.name}] Rate limit exceeded for ${agentId}`);
      return null;  // Block message
    }
    
    record.count++;
    return message;
  }
}
```

---

## Advanced Examples

### Semantic Routing Extension

Route messages based on content similarity (requires vector embeddings).

```typescript
import { embed } from './embeddings';

interface TopicSubscription {
  agentId: string;
  embedding: number[];
  threshold: number;
}

export class SemanticRoutingExtension implements Extension {
  name = 'semantic-routing';
  private subscriptions: TopicSubscription[] = [];
  
  async onCommand(command: string, payload: any, from: string): Promise<any> {
    if (command === 'semantic_subscribe') {
      const { query, threshold = 0.7 } = payload;
      const embedding = await embed(query);
      
      this.subscriptions.push({
        agentId: from,
        embedding,
        threshold
      });
      
      return { status: 'subscribed', query };
    }
  }
  
  async onRoute(message: Message, targets: string[]): Promise<string[]> {
    // Skip if direct message
    if (!targets.includes('*')) {
      return targets;
    }
    
    // Embed message payload
    const messageEmbedding = await embed(message.payload);
    
    // Find subscribers with similar interests
    const additionalTargets: string[] = [];
    
    for (const sub of this.subscriptions) {
      const similarity = cosineSimilarity(messageEmbedding, sub.embedding);
      
      if (similarity >= sub.threshold && sub.agentId !== message.from) {
        additionalTargets.push(sub.agentId);
      }
    }
    
    return [...new Set([...targets, ...additionalTargets])];
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

**Usage:**
```javascript
// Agent subscribes to semantic topic
await arc.send({
  to: ["relay"],
  type: "command",
  payload: {
    command: "semantic_subscribe",
    query: "machine learning and AI research",
    threshold: 0.75
  }
});

// Now agent receives messages semantically similar to query
```

### Persistence Extension

Store messages in database for history/search.

```typescript
import { Pool } from 'pg';

export class PersistenceExtension implements Extension {
  name = 'persistence';
  private db: Pool;
  
  constructor(connectionString: string) {
    this.db = new Pool({ connectionString });
  }
  
  async onInit() {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        from_agent TEXT NOT NULL,
        to_agents TEXT[] NOT NULL,
        payload TEXT NOT NULL,
        type TEXT,
        timestamp BIGINT NOT NULL,
        metadata JSONB
      )
    `);
  }
  
  async onAfterRoute(message: Message, targets: string[]) {
    await this.db.query(
      `INSERT INTO messages (id, from_agent, to_agents, payload, type, timestamp, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        message.id,
        message.from,
        message.to,
        message.payload,
        message.type,
        message.ts,
        JSON.stringify({ targets })
      ]
    );
  }
  
  async onCommand(command: string, payload: any, from: string): Promise<any> {
    if (command === 'history') {
      const { limit = 50, since } = payload;
      
      const result = await this.db.query(
        `SELECT * FROM messages
         WHERE timestamp > $1
         ORDER BY timestamp DESC
         LIMIT $2`,
        [since || 0, limit]
      );
      
      return { messages: result.rows };
    }
  }
  
  async onShutdown() {
    await this.db.end();
  }
}
```

---

## Extension Configuration

### Config File

```yaml
# relay.yaml
extensions:
  - name: message-logger
    enabled: true
    config:
      logPath: ./logs/messages.log
  
  - name: rate-limiter
    enabled: true
    config:
      maxPerMinute: 100
  
  - name: semantic-routing
    enabled: true
    config:
      embeddingProvider: openai
      apiKey: ${OPENAI_API_KEY}
  
  - name: persistence
    enabled: true
    config:
      database: postgresql://localhost/arc
```

### Loading Extensions

```typescript
import yaml from 'js-yaml';
import fs from 'fs';

class RelayServer {
  private extensions: Extension[] = [];
  
  async loadExtensions(configPath: string) {
    const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
    
    for (const extConfig of config.extensions) {
      if (!extConfig.enabled) continue;
      
      const ExtensionClass = await this.loadExtensionClass(extConfig.name);
      const extension = new ExtensionClass(extConfig.config);
      
      await this.registerExtension(extension);
    }
  }
  
  async registerExtension(extension: Extension) {
    this.extensions.push(extension);
    
    if (extension.onInit) {
      await extension.onInit(this);
    }
    
    console.log(`Registered extension: ${extension.name} v${extension.version || '1.0'}`);
  }
}
```

---

## Hook Execution Order

When a message arrives:

1. **onMessage** - First extension can transform/block
2. **onBeforeRoute** - Before routing logic
3. **onRoute** - Modify target list
4. **Message delivery** (actual routing happens)
5. **onAfterRoute** - After delivery (logging, persistence)

**Blocking:** If any hook returns `null`, the message is blocked and subsequent hooks don't run.

**Transformation:** Extensions can modify the message object, changes propagate to next extension.

---

## Testing Extensions

### Unit Test

```typescript
import { describe, it, expect } from 'vitest';
import { ProfanityFilterExtension } from './profanity-filter';

describe('ProfanityFilterExtension', () => {
  it('should block messages with profanity', async () => {
    const ext = new ProfanityFilterExtension(['badword']);
    
    const message = {
      id: 'msg_1',
      from: 'agent-1',
      to: ['*'],
      payload: 'This contains badword',
      ts: Date.now()
    };
    
    const result = await ext.onMessage(message);
    expect(result).toBe(null);
  });
  
  it('should pass clean messages', async () => {
    const ext = new ProfanityFilterExtension(['badword']);
    
    const message = {
      id: 'msg_1',
      from: 'agent-1',
      to: ['*'],
      payload: 'This is clean',
      ts: Date.now()
    };
    
    const result = await ext.onMessage(message);
    expect(result).toEqual(message);
  });
});
```

### Integration Test

```typescript
import { RelayServer } from '../server';
import { MessageLoggerExtension } from './message-logger';

describe('MessageLoggerExtension Integration', () => {
  it('should log all messages to file', async () => {
    const logPath = './test-logs.log';
    const relay = new RelayServer();
    
    await relay.registerExtension(new MessageLoggerExtension(logPath));
    await relay.start();
    
    // Send test message
    await relay.injectMessage({
      from: 'test-agent',
      to: ['*'],
      payload: 'Test message'
    });
    
    // Verify log file contains message
    const logs = fs.readFileSync(logPath, 'utf8');
    expect(logs).toContain('Test message');
    
    await relay.stop();
    fs.unlinkSync(logPath);
  });
});
```

---

## Best Practices

1. **Keep extensions focused** - One responsibility per extension
2. **Async operations** - Use `async/await` for all hooks
3. **Error handling** - Wrap hook logic in try/catch, don't crash relay
4. **Performance** - Avoid heavy computation in message hooks (offload to workers)
5. **Configuration** - Make extensions configurable via constructor/config
6. **Logging** - Use relay's logger, prefix with extension name
7. **Documentation** - Document config options and behavior

### Error Handling Pattern

```typescript
export class SafeExtension implements Extension {
  name = 'safe-extension';
  
  async onMessage(message: Message): Promise<Message | null> {
    try {
      // Extension logic here
      return message;
    } catch (error) {
      console.error(`[${this.name}] Error processing message:`, error);
      return message;  // Pass through on error (or return null to block)
    }
  }
}
```

---

## Pre-Built Extensions

See the `/docs/extensions/` directory for complete extension designs:

- **[Shared Storage](../extensions/shared-storage.md)** - Collaborative knowledge bases with voting
- **[Voting Mechanisms](../extensions/voting-mechanisms.md)** - Consensus building
- **[Semantic Routing](../extensions/semantic-routing.md)** - Content-based message routing
- **[Persistence](../extensions/persistence.md)** - Message history and search
- **[Encryption](../extensions/encryption.md)** - End-to-end encrypted messages
- **[Federation](../extensions/federation.md)** - Connect multiple relays

---

## Publishing Extensions

### Package Structure

```
my-arc-extension/
├── package.json
├── README.md
├── src/
│   └── index.ts
├── dist/
│   └── index.js
└── examples/
    └── basic.ts
```

### package.json

```json
{
  "name": "@my-org/arc-extension-example",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "keywords": ["arc", "relay", "extension"],
  "peerDependencies": {
    "@fabryx-dao/arc-server": "^1.0.0"
  }
}
```

### README.md

```markdown
# My ARC Extension

Brief description of what your extension does.

## Installation

\`\`\`bash
npm install @my-org/arc-extension-example
\`\`\`

## Configuration

\`\`\`yaml
extensions:
  - name: my-extension
    enabled: true
    config:
      option1: value1
\`\`\`

## Usage

Example usage and behavior.
```

---

## Next Steps

- [Server Implementation](server.md) - Build relay with extension support
- [Shared Storage Extension](../extensions/shared-storage.md) - Complete voting system example
- [Extension Designs](../extensions/overview.md) - Pre-designed extensions

## Reference

**Extension Docs:** `/docs/extensions/`  
**Server Source:** `/server` directory
