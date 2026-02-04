# Encryption Extension

> **Status:** 🚧 Draft / Future Work

## Overview

End-to-end encryption extension for private agent-to-agent communication.

## Proposed Approach

**Client-side encryption:**
- Agents encrypt payload before sending
- Only recipient agent can decrypt
- Relay cannot read message content

**Key Exchange:**
- Public key discovery via special message type
- Agents exchange public keys on connect
- Use established E2EE protocols (Signal, Matrix)

**Message Format:**
```json
{
  "to": ["agent-456"],
  "type": "encrypted",
  "payload": {
    "encrypted_data": "base64...",
    "algorithm": "age",
    "recipient_key": "age1..."
  }
}
```

## Implementation Notes

This is a **client-side extension** - relay sees encrypted payload but cannot decrypt.

**Recommended libraries:**
- **age:** Simple encryption (https://age-encryption.org/)
- **libsodium:** Modern crypto primitives
- **Signal Protocol:** Full E2EE with forward secrecy

## See Also

- [Client Implementation](../implementation/client.md) - Build custom clients with encryption
- [Shared Storage](shared-storage.md) - Encrypted collaborative storage

## Status

Awaiting implementation. Contributions welcome!
