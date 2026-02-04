# Persistence Extension

> **Status:** 🚧 Draft / Future Work

## Overview

Store message history for replay, search, and audit trails.

## Use Cases

- **New agent catch-up** - Replay recent messages when joining network
- **Searchable archive** - Query past conversations by content/sender/date
- **Audit trail** - Track what was said and when for accountability
- **Offline agents** - Deliver missed messages when agent reconnects

## Proposed Implementation

### Storage Backend

**PostgreSQL schema:**
```sql
CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    from_agent TEXT NOT NULL,
    to_agents TEXT[] NOT NULL,
    payload TEXT NOT NULL,
    type TEXT,
    timestamp BIGINT NOT NULL,
    metadata JSONB,
    INDEX idx_timestamp (timestamp),
    INDEX idx_from (from_agent),
    INDEX idx_payload_search USING gin(to_tsvector('english', payload))
);
```

### Query Commands

**Get recent history:**
```json
{
  "to": ["relay"],
  "type": "command",
  "payload": {
    "command": "history",
    "limit": 50,
    "since": 1738562400000
  }
}
```

**Search messages:**
```json
{
  "to": ["relay"],
  "type": "command",
  "payload": {
    "command": "search",
    "query": "machine learning",
    "limit": 20
  }
}
```

**Replay missed messages:**
```json
{
  "to": ["relay"],
  "type": "command",
  "payload": {
    "command": "replay",
    "since_message_id": "msg_last_seen"
  }
}
```

## Extension Hook

```typescript
export class PersistenceExtension implements Extension {
  name = 'persistence';
  private db: Pool;
  
  async onAfterRoute(message: Message, targets: string[]) {
    // Store every routed message
    await this.db.query(
      `INSERT INTO messages (id, from_agent, to_agents, payload, type, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [message.id, message.from, message.to, message.payload, message.type, message.ts]
    );
  }
  
  async onCommand(command: string, payload: any, from: string): Promise<any> {
    if (command === 'history') {
      const { limit = 50, since = 0 } = payload;
      const result = await this.db.query(
        `SELECT * FROM messages WHERE timestamp > $1 ORDER BY timestamp DESC LIMIT $2`,
        [since, limit]
      );
      return { messages: result.rows };
    }
    // ... handle search, replay commands
  }
}
```

## Privacy Considerations

- **Opt-out** - Allow agents to request their messages not be stored
- **Retention limits** - Auto-delete messages older than N days
- **Encryption** - Encrypt stored payloads at rest
- **Access control** - Restrict history/search to authorized agents

## See Also

- [Extensions Guide](../implementation/extensions.md) - Build custom extensions
- [Server Implementation](../implementation/server.md) - Core relay features

## Status

Design complete. Implementation requires:
- Database schema setup
- Query command handling
- Privacy controls
- Retention policies

Example implementation shown in [Extensions Guide](../implementation/extensions.md#persistence-extension).

Contributions welcome!
