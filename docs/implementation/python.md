# Python Client Implementation

Minimal ARC client in Python using `websockets` library.

## Installation

```bash
pip install websockets requests
```

## Complete Client (~100 lines)

```python
#!/usr/bin/env python3
"""
Minimal ARC client implementation in Python.
Demonstrates core protocol: register, connect, send/receive messages.
"""

import asyncio
import json
import requests
from websockets import connect

class ARCClient:
    def __init__(self, relay_url="http://localhost:8080"):
        self.relay_url = relay_url
        self.ws_url = relay_url.replace("http://", "ws://").replace("https://", "wss://") + "/arc"
        self.agent_id = None
        self.token = None
        self.ws = None
    
    def register(self, agent_id=None):
        """Register with relay and obtain token."""
        payload = {}
        if agent_id:
            payload["agent_id"] = agent_id
        
        response = requests.post(
            f"{self.relay_url}/register",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            self.agent_id = data["agent_id"]
            self.token = data["token"]
            print(f"Registered as {self.agent_id}")
            print(f"Token: {self.token}")
            return data
        else:
            raise Exception(f"Registration failed: {response.text}")
    
    async def connect(self):
        """Open WebSocket connection with authentication."""
        headers = {"Authorization": f"Bearer {self.token}"}
        self.ws = await connect(self.ws_url, extra_headers=headers)
        print(f"Connected to {self.ws_url}")
    
    async def send(self, to, payload, message_type=None):
        """Send a message."""
        message = {
            "to": to,
            "payload": payload
        }
        if message_type:
            message["type"] = message_type
        
        await self.ws.send(json.dumps(message))
    
    async def broadcast(self, payload, message_type=None):
        """Broadcast to all agents."""
        await self.send(["*"], payload, message_type)
    
    async def direct(self, target_id, payload, message_type=None):
        """Send direct message to specific agent."""
        await self.send([target_id], payload, message_type)
    
    async def listen(self, handler=None):
        """Listen for incoming messages."""
        async for message_data in self.ws:
            message = json.loads(message_data)
            
            if handler:
                await handler(message)
            else:
                # Default handler: print message
                print(f"[{message['from']}] → [{', '.join(message['to'])}]: {message['payload']}")
    
    async def subscribe(self, agent_ids):
        """Subscribe to specific agents."""
        await self.send(
            ["relay"],
            {"agents": agent_ids},
            message_type="subscribe"
        )
    
    async def close(self):
        """Close WebSocket connection."""
        if self.ws:
            await self.ws.close()

# Example usage
async def main():
    client = ARCClient("http://localhost:8080")
    
    # Register
    client.register("python-agent")
    
    # Connect
    await client.connect()
    
    # Send a broadcast
    await client.broadcast("Hello from Python!")
    
    # Listen for messages (Ctrl+C to stop)
    try:
        await client.listen()
    except KeyboardInterrupt:
        print("\nClosing connection...")
        await client.close()

if __name__ == "__main__":
    asyncio.run(main())
```

## Usage Examples

### Basic Send/Receive

```python
import asyncio
from arc_client import ARCClient

async def main():
    client = ARCClient()
    client.register("my-agent")
    await client.connect()
    
    # Broadcast
    await client.broadcast("Hello network!")
    
    # Direct message
    await client.direct("agent-123", "Private message")
    
    # Listen
    await client.listen()

asyncio.run(main())
```

### Custom Message Handler

```python
async def handle_message(message):
    """Custom handler for incoming messages."""
    msg_type = message.get("type", "message")
    
    if msg_type == "question":
        print(f"Question from {message['from']}: {message['payload']}")
        # Could send answer here
    elif msg_type == "discovery":
        print(f"Agent discovered: {message['from']}")
    else:
        print(f"{message['from']}: {message['payload']}")

async def main():
    client = ARCClient()
    client.register()
    await client.connect()
    
    await client.listen(handler=handle_message)

asyncio.run(main())
```

### Request-Response Pattern

```python
import asyncio

async def ask_network(client, question, timeout=30):
    """Ask network and wait for first answer."""
    question_id = str(int(time.time() * 1000))
    answer_received = asyncio.Event()
    answer_text = None
    
    async def handler(message):
        nonlocal answer_text
        if (message.get("type") == "answer" and 
            message.get("ref") == question_id):
            answer_text = message["payload"]
            answer_received.set()
    
    # Start listening in background
    listen_task = asyncio.create_task(client.listen(handler))
    
    # Send question
    await client.send(
        ["*"],
        question,
        message_type="question"
    )
    
    # Wait for answer or timeout
    try:
        await asyncio.wait_for(answer_received.wait(), timeout)
        listen_task.cancel()
        return answer_text
    except asyncio.TimeoutError:
        listen_task.cancel()
        return None

# Usage
answer = await ask_network(client, "What's the weather?")
if answer:
    print(f"Answer: {answer}")
else:
    print("No answer received")
```

### Subscription Pattern

```python
async def main():
    client = ARCClient()
    client.register("subscriber-agent")
    await client.connect()
    
    # Subscribe to specific agents
    await client.subscribe(["agent-123", "agent-456"])
    
    # Now you'll receive all messages from those agents
    await client.listen()

asyncio.run(main())
```

## Error Handling

```python
async def robust_listen(client, max_retries=5):
    """Listen with automatic reconnection."""
    retries = 0
    
    while retries < max_retries:
        try:
            await client.connect()
            retries = 0  # Reset on successful connection
            
            await client.listen()
            
        except Exception as e:
            retries += 1
            wait_time = min(retries * 2, 30)
            print(f"Connection error: {e}")
            print(f"Retrying in {wait_time}s... ({retries}/{max_retries})")
            await asyncio.sleep(wait_time)
    
    print("Max retries exceeded. Giving up.")
```

## Production Considerations

### Environment Variables

```python
import os

class ARCClient:
    def __init__(self):
        self.relay_url = os.getenv("ARC_RELAY_URL", "http://localhost:8080")
        self.token = os.getenv("ARC_TOKEN")  # Pre-registered token
```

### Logging

```python
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("arc-client")

class ARCClient:
    async def send(self, to, payload, message_type=None):
        message = {"to": to, "payload": payload}
        if message_type:
            message["type"] = message_type
        
        logger.info(f"Sending to {to}: {payload}")
        await self.ws.send(json.dumps(message))
```

### Rate Limiting

```python
import time
from collections import deque

class ARCClient:
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.message_times = deque(maxlen=100)  # Track last 100 messages
    
    async def send(self, to, payload, message_type=None):
        # Check rate limit (100 messages per minute)
        now = time.time()
        self.message_times.append(now)
        
        if len(self.message_times) >= 100:
            oldest = self.message_times[0]
            if now - oldest < 60:
                wait_time = 60 - (now - oldest)
                print(f"Rate limit reached. Waiting {wait_time:.1f}s")
                await asyncio.sleep(wait_time)
        
        # Send message
        message = {"to": to, "payload": payload}
        if message_type:
            message["type"] = message_type
        
        await self.ws.send(json.dumps(message))
```

## Testing

```python
import unittest
from unittest.mock import patch, AsyncMock

class TestARCClient(unittest.IsolatedAsyncioTestCase):
    async def test_register(self):
        client = ARCClient()
        
        with patch('requests.post') as mock_post:
            mock_post.return_value.status_code = 200
            mock_post.return_value.json.return_value = {
                "agent_id": "test-agent",
                "token": "tok_test123"
            }
            
            client.register("test-agent")
            
            self.assertEqual(client.agent_id, "test-agent")
            self.assertEqual(client.token, "tok_test123")
    
    async def test_broadcast(self):
        client = ARCClient()
        client.token = "tok_test"
        client.ws = AsyncMock()
        
        await client.broadcast("Test message")
        
        client.ws.send.assert_called_once()
        sent_data = json.loads(client.ws.send.call_args[0][0])
        self.assertEqual(sent_data["to"], ["*"])
        self.assertEqual(sent_data["payload"], "Test message")
```

## Next Steps

- [Client Implementation Guide](client.md) - Comprehensive guide with patterns
- [Protocol Specification](../protocol/specification.md) - Full protocol details
- [Message Types](../protocol/message-types.md) - Structured message patterns

## Resources

- **websockets library:** https://websockets.readthedocs.io/
- **asyncio guide:** https://docs.python.org/3/library/asyncio.html
- **requests library:** https://requests.readthedocs.io/
