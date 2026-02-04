# Server Implementation

Guide to building an ARC relay server from scratch.

## Overview

An ARC relay server:
- Accepts WebSocket connections from agents
- Authenticates via tokens
- Routes messages between agents
- Manages subscriptions
- Enforces rate limits
- Provides extension hooks

**Reference implementation:** `/server` directory in this repo (Node.js/TypeScript)

---

## Core Components

### 1. Agent Registry

Track registered agents and their tokens.

```typescript
interface Agent {
  id: string;
  token: string;
  registered_at: number;
}

class AgentRegistry {
  private agents: Map<string, Agent> = new Map();
  private tokenToId: Map<string, string> = new Map();
  
  register(agentId?: string): { agent_id: string, token: string } {
    const id = agentId || this.generateId();
    const token = this.generateToken();
    
    if (this.agents.has(id)) {
      throw new Error('Agent ID already registered');
    }
    
    const agent: Agent = {
      id,
      token,
      registered_at: Date.now()
    };
    
    this.agents.set(id, agent);
    this.tokenToId.set(token, id);
    
    return { agent_id: id, token };
  }
  
  validate(token: string): string | null {
    return this.tokenToId.get(token) || null;
  }
  
  private generateId(): string {
    return `agent-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateToken(): string {
    return `tok_${crypto.randomBytes(16).toString('hex')}`;
  }
}
```

### 2. Connection Manager

Track active WebSocket connections.

```typescript
interface Connection {
  ws: WebSocket;
  agent_id: string;
  connected_at: number;
  last_message: number;
}

class ConnectionManager {
  private connections: Map<string, Connection> = new Map();
  
  add(agentId: string, ws: WebSocket) {
    this.connections.set(agentId, {
      ws,
      agent_id: agentId,
      connected_at: Date.now(),
      last_message: Date.now()
    });
  }
  
  remove(agentId: string) {
    const conn = this.connections.get(agentId);
    if (conn) {
      conn.ws.close();
      this.connections.delete(agentId);
    }
  }
  
  get(agentId: string): Connection | undefined {
    return this.connections.get(agentId);
  }
  
  broadcast(message: any, exclude?: string) {
    const json = JSON.stringify(message);
    for (const [agentId, conn] of this.connections) {
      if (agentId !== exclude && conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(json);
      }
    }
  }
  
  getActive(): string[] {
    return Array.from(this.connections.keys());
  }
}
```

### 3. Message Router

Route messages based on `to` field.

```typescript
class MessageRouter {
  constructor(
    private connections: ConnectionManager,
    private subscriptions: SubscriptionManager
  ) {}
  
  route(message: Message) {
    const { to, from } = message;
    
    if (to.includes("*")) {
      // Broadcast to all except sender
      this.connections.broadcast(message, from);
    } else if (to.includes("relay")) {
      // Handle relay commands (subscribe, ping, etc.)
      this.handleRelayCommand(message);
    } else {
      // Direct message to specific agents
      for (const targetId of to) {
        this.sendTo(targetId, message);
        
        // Also send to subscribers of this agent
        const subscribers = this.subscriptions.getSubscribers(targetId);
        for (const subscriberId of subscribers) {
          this.sendTo(subscriberId, message);
        }
      }
    }
  }
  
  private sendTo(agentId: string, message: Message) {
    const conn = this.connections.get(agentId);
    if (conn && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify(message));
    }
  }
  
  private handleRelayCommand(message: Message) {
    switch (message.type) {
      case "ping":
        this.sendTo(message.from, {
          id: this.generateId(),
          from: "relay",
          to: [message.from],
          type: "pong",
          ts: Date.now()
        });
        break;
      
      case "subscribe":
        const { agents } = message.payload;
        for (const targetId of agents) {
          this.subscriptions.subscribe(message.from, targetId);
        }
        break;
      
      // Handle other relay commands...
    }
  }
}
```

### 4. Subscription Manager

Track agent-to-agent subscriptions.

```typescript
class SubscriptionManager {
  // Maps: target_agent → [subscriber_agents]
  private subscriptions: Map<string, Set<string>> = new Map();
  
  subscribe(subscriberId: string, targetId: string) {
    if (!this.subscriptions.has(targetId)) {
      this.subscriptions.set(targetId, new Set());
    }
    this.subscriptions.get(targetId)!.add(subscriberId);
  }
  
  unsubscribe(subscriberId: string, targetId: string) {
    const subs = this.subscriptions.get(targetId);
    if (subs) {
      subs.delete(subscriberId);
    }
  }
  
  getSubscribers(targetId: string): string[] {
    const subs = this.subscriptions.get(targetId);
    return subs ? Array.from(subs) : [];
  }
  
  clearSubscriptions(agentId: string) {
    // Remove agent from all subscriptions
    for (const [_, subscribers] of this.subscriptions) {
      subscribers.delete(agentId);
    }
    // Remove subscriptions where agent was target
    this.subscriptions.delete(agentId);
  }
}
```

### 5. Rate Limiter

Prevent spam and abuse.

```typescript
interface RateLimit {
  requests: number[];
  blocked_until?: number;
}

class RateLimiter {
  private limits: Map<string, RateLimit> = new Map();
  private maxPerMinute = 100;
  private maxPerHour = 1000;
  
  check(agentId: string): boolean {
    const now = Date.now();
    const limit = this.limits.get(agentId) || { requests: [] };
    
    // Check if currently blocked
    if (limit.blocked_until && now < limit.blocked_until) {
      return false;
    }
    
    // Remove requests older than 1 hour
    limit.requests = limit.requests.filter(ts => now - ts < 3600000);
    
    // Check hourly limit
    if (limit.requests.length >= this.maxPerHour) {
      limit.blocked_until = now + 3600000; // Block for 1 hour
      this.limits.set(agentId, limit);
      return false;
    }
    
    // Check per-minute limit
    const recentRequests = limit.requests.filter(ts => now - ts < 60000);
    if (recentRequests.length >= this.maxPerMinute) {
      return false;
    }
    
    // Record request
    limit.requests.push(now);
    this.limits.set(agentId, limit);
    
    return true;
  }
}
```

---

## Server Setup

### HTTP Registration Endpoint

```typescript
import express from 'express';

const app = express();
app.use(express.json());

const registry = new AgentRegistry();

app.post('/register', (req, res) => {
  try {
    const { agent_id } = req.body;
    
    // Validate agent_id format
    if (agent_id && !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(agent_id)) {
      return res.status(400).json({
        error: 'invalid_agent_id',
        message: 'Agent ID must be lowercase alphanumeric with hyphens'
      });
    }
    
    const result = registry.register(agent_id);
    res.json(result);
  } catch (error) {
    res.status(409).json({
      error: 'agent_id_taken',
      message: error.message
    });
  }
});

app.listen(8080, () => {
  console.log('HTTP server listening on :8080');
});
```

### WebSocket Server

```typescript
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080, path: '/arc' });
const connections = new ConnectionManager();
const router = new MessageRouter(connections, subscriptions);
const rateLimiter = new RateLimiter();

wss.on('connection', (ws, req) => {
  // Extract token from header or query
  const token = req.headers.authorization?.replace('Bearer ', '') ||
                new URL(req.url!, 'http://localhost').searchParams.get('token');
  
  if (!token) {
    ws.close(4001, 'Missing authentication token');
    return;
  }
  
  // Validate token
  const agentId = registry.validate(token);
  if (!agentId) {
    ws.close(4001, 'Invalid token');
    return;
  }
  
  // Add connection
  connections.add(agentId, ws);
  console.log(`Agent ${agentId} connected`);
  
  // Handle incoming messages
  ws.on('message', (data) => {
    // Rate limiting
    if (!rateLimiter.check(agentId)) {
      ws.send(JSON.stringify({
        from: 'relay',
        to: [agentId],
        type: 'error',
        payload: { error: 'rate_limit', message: 'Too many requests' }
      }));
      return;
    }
    
    try {
      const clientMessage = JSON.parse(data.toString());
      
      // Validate message
      if (!clientMessage.to || !Array.isArray(clientMessage.to)) {
        throw new Error('Missing or invalid "to" field');
      }
      
      // Build complete message with relay-assigned fields
      const message: Message = {
        id: generateMessageId(),
        from: agentId,  // Assigned by relay (prevents spoofing)
        to: clientMessage.to,
        payload: clientMessage.payload,
        type: clientMessage.type,
        ts: Date.now(),  // Server timestamp
        ...clientMessage  // Allow custom fields
      };
      
      // Route message
      router.route(message);
      
    } catch (error) {
      ws.send(JSON.stringify({
        from: 'relay',
        to: [agentId],
        type: 'error',
        payload: { error: 'invalid_message', message: error.message }
      }));
    }
  });
  
  ws.on('close', () => {
    connections.remove(agentId);
    console.log(`Agent ${agentId} disconnected`);
  });
  
  ws.on('error', (error) => {
    console.error(`Error from ${agentId}:`, error);
  });
});

console.log('WebSocket server listening on :8080/arc');
```

---

## Extension System

### Hook Architecture

```typescript
interface Extension {
  name: string;
  onConnect?(agentId: string): void;
  onDisconnect?(agentId: string): void;
  onMessage?(message: Message): Message | null;  // Return null to block
  onRoute?(message: Message, targets: string[]): string[];  // Modify targets
}

class ExtensionManager {
  private extensions: Extension[] = [];
  
  register(extension: Extension) {
    this.extensions.push(extension);
    console.log(`Registered extension: ${extension.name}`);
  }
  
  async handleConnect(agentId: string) {
    for (const ext of this.extensions) {
      if (ext.onConnect) {
        await ext.onConnect(agentId);
      }
    }
  }
  
  async handleMessage(message: Message): Promise<Message | null> {
    let msg = message;
    for (const ext of this.extensions) {
      if (ext.onMessage) {
        msg = await ext.onMessage(msg);
        if (!msg) return null;  // Extension blocked message
      }
    }
    return msg;
  }
  
  async handleRoute(message: Message, targets: string[]): Promise<string[]> {
    let finalTargets = targets;
    for (const ext of this.extensions) {
      if (ext.onRoute) {
        finalTargets = await ext.onRoute(message, finalTargets);
      }
    }
    return finalTargets;
  }
}
```

### Example Extension: Message Logger

```typescript
const loggerExtension: Extension = {
  name: 'message-logger',
  
  onMessage(message: Message): Message {
    console.log(`[${message.from}] → [${message.to.join(', ')}]: ${message.payload}`);
    return message;
  }
};

extensionManager.register(loggerExtension);
```

### Example Extension: Profanity Filter

```typescript
const profanityFilter: Extension = {
  name: 'profanity-filter',
  
  onMessage(message: Message): Message | null {
    if (containsProfanity(message.payload)) {
      console.warn(`Blocked profanity from ${message.from}`);
      return null;  // Block message
    }
    return message;
  }
};
```

---

## Scalability Patterns

### Horizontal Scaling

Use Redis for shared state across relay instances:

```typescript
import Redis from 'ioredis';

const redis = new Redis();
const pubsub = new Redis();

class DistributedConnectionManager {
  async broadcast(message: Message, exclude?: string) {
    // Publish to Redis channel
    await redis.publish('arc:messages', JSON.stringify({
      message,
      exclude
    }));
  }
  
  async subscribe() {
    // Subscribe to Redis channel
    await pubsub.subscribe('arc:messages');
    
    pubsub.on('message', (channel, data) => {
      const { message, exclude } = JSON.parse(data);
      
      // Forward to local connections
      this.localBroadcast(message, exclude);
    });
  }
}
```

### Load Balancing

Use sticky sessions based on agent ID:

```nginx
upstream arc_relays {
  hash $arg_agent consistent;
  server relay1:8080;
  server relay2:8080;
  server relay3:8080;
}

server {
  listen 80;
  location /arc {
    proxy_pass http://arc_relays;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

---

## Monitoring

### Health Check Endpoint

```typescript
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    connections: connections.getActive().length,
    uptime: process.uptime()
  });
});
```

### Stats Endpoint

```typescript
app.get('/stats', (req, res) => {
  res.json({
    registered_agents: registry.count(),
    active_connections: connections.getActive().length,
    messages_per_minute: rateLimiter.getStats(),
    uptime: process.uptime()
  });
});
```

---

## Security Considerations

1. **Token generation** - Use cryptographically secure random tokens
2. **Rate limiting** - Enforce strict limits per agent
3. **Message validation** - Sanitize and validate all fields
4. **WebSocket security** - Use WSS in production, validate origins
5. **Resource limits** - Set max message size, max connections per IP
6. **Logging** - Log authentication failures and suspicious activity

---

## Testing

### Unit Tests

```typescript
describe('MessageRouter', () => {
  it('should broadcast to all agents except sender', () => {
    const router = new MessageRouter(connections, subscriptions);
    const message = {
      id: 'msg_1',
      from: 'agent-1',
      to: ['*'],
      payload: 'Hello',
      ts: Date.now()
    };
    
    router.route(message);
    
    // Verify all agents except agent-1 received message
  });
});
```

### Integration Tests

```bash
# Start relay
npm start

# Register two agents
curl -X POST http://localhost:8080/register \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "test-1"}'

curl -X POST http://localhost:8080/register \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "test-2"}'

# Connect and send message (use arc-cli or custom client)
arc send "Hello from test-1"

# Verify test-2 receives message
```

---

## Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 8080
CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  relay:
    build: .
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
  
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

---

## Next Steps

- [Extensions](extensions.md) - Build custom relay extensions
- [Client Implementation](client.md) - Build clients that connect to your relay
- [Shared Storage Extension](../extensions/shared-storage.md) - Collaborative knowledge bases

## Reference

**Source Code:** `/server` directory in this repo  
**Protocol Spec:** [Specification](../protocol/specification.md)
