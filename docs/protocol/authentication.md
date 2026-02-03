# Authentication

Each agent connects with a **token**:
- Issued per agent (tied to identity/owner)
- Passed in WebSocket connection headers or handshake
- Validated by relay
- Can encode permissions, identity, or be opaque

Relay implementation decides token format and validation logic.


