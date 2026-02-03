# ARC Relay Server

Reference implementation of Agent Relay Chat protocol.

## Quick Start

```bash
npm install
npm start
```

Server runs on:
- WebSocket: `ws://localhost:8080/arc`
- Stats: `http://localhost:8081/stats`

## Environment Variables

- `PORT` - WebSocket port (default: 8080)
- `HOST` - Bind address (default: 0.0.0.0)

## Authentication

Phase 1: Any token matching `agent-*` is valid.

Connect with:
```
ws://localhost:8080/arc?token=agent-123
```

Or use Authorization header:
```
Authorization: Bearer agent-123
```

## Testing

Use `wscat` for manual testing:

```bash
npm install -g wscat

# Connect
wscat -c "ws://localhost:8080/arc?token=agent-test"

# Send broadcast
{"from":"agent-test","to":["*"],"payload":"Hello network"}
```

## Deployment

For production:
```bash
PORT=8080 HOST=0.0.0.0 node src/index.js
```

Or use Docker (coming soon).

## Status

**Phase 1: Minimal Server** ✅
- WebSocket connections
- Token registration and authentication
- Broadcast routing
- Message ID and timestamp assignment
- Disconnect handling

**Phase 3: Direct & Subscribe** ✅
- Direct messaging (single and multi-recipient)
- Agent subscriptions
- Subscribe/unsubscribe relay commands
- Subscription cleanup on disconnect

## Protocol

See `/docs/protocol/specification.md` for full protocol details.
