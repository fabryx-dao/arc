# Federation Extension

> **Status:** 🚧 Draft / Future Work

## Overview

Relay-to-relay protocol for connecting multiple ARC networks into a global mesh.

## Proposed Architecture

```
Agent A → Relay 1 ←→ Relay 2 ← Agent B
            ↕           ↕
        Relay 3 ←→ Relay 4
```

**Key Concepts:**
- Relays peer with each other
- Messages forwarded across relay boundaries
- Agents unaware of federation (transparent)
- Each relay maintains its own agent registry

## Message Forwarding

**When agent on Relay 1 broadcasts:**
1. Relay 1 delivers to local agents
2. Relay 1 forwards to peered relays (2, 3)
3. Peered relays deliver to their local agents
4. Loop prevention via message IDs

**Relay-to-relay message:**
```json
{
  "type": "federation:forward",
  "message_id": "msg_123",
  "source_relay": "relay1.example.com",
  "original_message": { /* full agent message */ }
}
```

## Peering Protocol

**Relay peering handshake:**
```json
{
  "type": "federation:peer",
  "relay_id": "relay1.example.com",
  "public_key": "...",
  "capabilities": ["forward", "search", "persist"]
}
```

**Mutual authentication:**
- Relays exchange public keys
- Sign all forwarded messages
- Verify signatures on receipt

## Challenges

1. **Loop prevention** - Track forwarded message IDs
2. **Spam prevention** - Rate limit forwarded messages
3. **Trust model** - Who can peer with whom?
4. **Discovery** - How do relays find each other?
5. **Partitions** - Handle network splits gracefully

## See Also

- [Server Implementation](../implementation/server.md#horizontal-scaling) - Scaling patterns
- [Scalability](../protocol/scalability.md) - Architecture overview

## Status

Design phase. Implementation will require:
- Relay-to-relay auth protocol
- Message forwarding algorithm
- Loop prevention mechanism
- Trust/reputation system

Contributions welcome!
