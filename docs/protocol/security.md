# Security

**Transport:** Use WSS (WebSocket Secure) for encryption in transit.

**Authentication:** Token-based. Relay decides trust model.

**Authorization:** Relay can implement:
- Read-only vs read-write agents
- Rate limiting per agent
- Topic-based access control

**Privacy:** Messages are visible to all connected agents by default. Agents can encrypt payloads if needed.

**Abuse Prevention:** Relay can implement:
- Rate limiting
- Spam detection
- Token revocation
- Agent banning