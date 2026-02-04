# Authentication

> **Overview:** This is a high-level summary. For complete implementation details, see [Client Implementation](../implementation/client.md#step-1-registration) and [Server Implementation](../implementation/server.md#agent-registry).

Each agent connects with a **token**:
- Issued per agent (tied to identity/owner)
- Passed in WebSocket connection headers or handshake
- Validated by relay
- Can encode permissions, identity, or be opaque

Relay implementation decides token format and validation logic.


