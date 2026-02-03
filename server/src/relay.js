import { nanoid } from 'nanoid';
import { validateToken, extractToken } from './auth.js';

/**
 * ARC Relay - Core message routing
 */
export class ARCRelay {
  constructor(registry) {
    this.registry = registry;
    this.agents = new Map(); // agentId → WebSocket
    this.sockets = new WeakMap(); // WebSocket → agentId
    this.subscriptions = new Map(); // agentId → Set<subscriberAgentId>
  }

  /**
   * Handle new WebSocket connection
   */
  async handleConnection(ws, req) {
    const token = extractToken(req);
    const auth = validateToken(token, this.registry);

    if (!auth.valid) {
      console.log(`[auth] Connection rejected: ${auth.error}`);
      ws.close(4001, auth.error);
      return;
    }

    const agentId = auth.agentId;
    console.log(`[connect] ${agentId}`);

    // Store agent connection
    this.agents.set(agentId, ws);
    this.sockets.set(ws, agentId);

    // Send welcome message
    this.sendToAgent(ws, {
      id: nanoid(12),
      from: 'relay',
      to: [agentId],
      type: 'welcome',
      payload: {
        relay: 'free.agentrelay.chat',
        version: '0.1.0',
        capabilities: ['broadcast', 'direct', 'subscribe'],
        extensions: []
      },
      ts: Date.now()
    });

    // Handle incoming messages
    ws.on('message', (data) => this.handleMessage(ws, data));

    // Handle disconnection
    ws.on('close', () => this.handleDisconnect(ws));
    ws.on('error', (err) => {
      console.error(`[error] ${agentId}:`, err);
      this.handleDisconnect(ws);
    });
  }

  /**
   * Handle incoming message from agent
   */
  handleMessage(ws, data) {
    const agentId = this.sockets.get(ws);
    
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (err) {
      console.error(`[parse] ${agentId}: Invalid JSON`);
      this.sendError(ws, 'invalid_message', 'Malformed JSON');
      return;
    }

    // Validate required fields (client does NOT send 'from')
    if (!msg.to || msg.payload === undefined) {
      console.error(`[validate] ${agentId}: Missing required fields`);
      this.sendError(ws, 'invalid_message', 'Missing required fields: to, payload');
      return;
    }

    // Validate to is an array
    if (!Array.isArray(msg.to)) {
      console.error(`[validate] ${agentId}: to must be array`);
      this.sendError(ws, 'invalid_message', 'to field must be an array');
      return;
    }

    // Assign relay metadata (including 'from' from authenticated agentId)
    const relayMsg = {
      id: nanoid(12),
      from: agentId,  // Relay assigns 'from' from authenticated identity
      to: msg.to,
      payload: msg.payload,
      ts: Date.now()
    };

    // Copy optional fields
    if (msg.type) relayMsg.type = msg.type;
    if (msg.ref) relayMsg.ref = msg.ref;

    console.log(`[message] ${agentId} → ${msg.to.join(',')}: ${msg.type || 'message'}`);

    // Route message
    this.routeMessage(relayMsg, agentId);
  }

  /**
   * Route message based on 'to' field
   */
  routeMessage(msg, senderId) {
    const targets = msg.to;

    // Special handling for relay commands
    if (targets.includes('relay')) {
      this.handleRelayCommand(msg, senderId);
      return;
    }

    // Broadcast to all
    if (targets.includes('*')) {
      this.broadcast(msg, senderId);
      
      // Also deliver to subscribers of the sender
      this.deliverToSubscribers(msg, senderId);
      return;
    }

    // Direct messages to specific agents
    this.directMessage(msg, targets, senderId);
  }

  /**
   * Handle relay commands (subscribe, unsubscribe, etc.)
   */
  handleRelayCommand(msg, senderId) {
    const type = msg.type;

    if (type === 'subscribe') {
      this.handleSubscribe(msg, senderId);
    } else if (type === 'unsubscribe') {
      this.handleUnsubscribe(msg, senderId);
    } else if (type === 'list_subscriptions') {
      this.handleListSubscriptions(senderId);
    } else {
      console.warn(`[relay] Unknown command: ${type}`);
    }
  }

  /**
   * Handle subscribe request
   */
  handleSubscribe(msg, senderId) {
    const agents = msg.payload?.agents;
    
    if (!Array.isArray(agents)) {
      console.error(`[subscribe] ${senderId}: Invalid payload format`);
      return;
    }

    let subscribed = 0;
    for (const targetId of agents) {
      if (!this.subscriptions.has(targetId)) {
        this.subscriptions.set(targetId, new Set());
      }
      this.subscriptions.get(targetId).add(senderId);
      subscribed++;
    }

    console.log(`[subscribe] ${senderId} → ${agents.join(', ')}`);

    // Send confirmation
    const ws = this.agents.get(senderId);
    if (ws) {
      this.sendToAgent(ws, {
        id: nanoid(12),
        from: 'relay',
        to: [senderId],
        type: 'subscribed',
        payload: { agents, count: subscribed },
        ts: Date.now()
      });
    }
  }

  /**
   * Handle unsubscribe request
   */
  handleUnsubscribe(msg, senderId) {
    const agents = msg.payload?.agents;
    
    if (!Array.isArray(agents)) {
      console.error(`[unsubscribe] ${senderId}: Invalid payload format`);
      return;
    }

    let unsubscribed = 0;
    for (const targetId of agents) {
      const subscribers = this.subscriptions.get(targetId);
      if (subscribers) {
        subscribers.delete(senderId);
        if (subscribers.size === 0) {
          this.subscriptions.delete(targetId);
        }
        unsubscribed++;
      }
    }

    console.log(`[unsubscribe] ${senderId} × ${agents.join(', ')}`);

    // Send confirmation
    const ws = this.agents.get(senderId);
    if (ws) {
      this.sendToAgent(ws, {
        id: nanoid(12),
        from: 'relay',
        to: [senderId],
        type: 'unsubscribed',
        payload: { agents, count: unsubscribed },
        ts: Date.now()
      });
    }
  }

  /**
   * Handle list subscriptions request
   */
  handleListSubscriptions(senderId) {
    const subscribedTo = [];
    
    // Find all agents this sender is subscribed to
    for (const [agentId, subscribers] of this.subscriptions.entries()) {
      if (subscribers.has(senderId)) {
        subscribedTo.push(agentId);
      }
    }

    console.log(`[list_subscriptions] ${senderId}: ${subscribedTo.length} subscriptions`);

    // Send response
    const ws = this.agents.get(senderId);
    if (ws) {
      this.sendToAgent(ws, {
        id: nanoid(12),
        from: 'relay',
        to: [senderId],
        type: 'subscriptions',
        payload: { agents: subscribedTo },
        ts: Date.now()
      });
    }
  }

  /**
   * Deliver message to subscribers of sender
   */
  deliverToSubscribers(msg, senderId) {
    const subscribers = this.subscriptions.get(senderId);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    let delivered = 0;
    for (const subscriberId of subscribers) {
      const ws = this.agents.get(subscriberId);
      if (ws && ws.readyState === 1) {
        this.sendToAgent(ws, msg);
        delivered++;
      }
    }

    if (delivered > 0) {
      console.log(`[subscribers] Delivered to ${delivered} subscribers of ${senderId}`);
    }
  }

  /**
   * Send direct message to specific agents
   */
  directMessage(msg, targets, senderId) {
    let delivered = 0;
    let notFound = [];

    for (const targetId of targets) {
      const ws = this.agents.get(targetId);
      if (ws && ws.readyState === 1) {
        this.sendToAgent(ws, msg);
        delivered++;
      } else {
        notFound.push(targetId);
      }
    }

    console.log(`[direct] ${senderId} → ${targets.join(', ')}: ${delivered} delivered, ${notFound.length} not connected`);
  }

  /**
   * Broadcast message to all connected agents except sender
   */
  broadcast(msg, senderId) {
    let delivered = 0;
    for (const [agentId, ws] of this.agents.entries()) {
      if (agentId !== senderId && ws.readyState === 1) { // OPEN
        this.sendToAgent(ws, msg);
        delivered++;
      }
    }
    console.log(`[broadcast] Delivered to ${delivered} agents`);
  }

  /**
   * Send message to specific agent WebSocket
   */
  sendToAgent(ws, msg) {
    if (ws.readyState === 1) { // OPEN
      ws.send(JSON.stringify(msg));
    }
  }

  /**
   * Send error message to agent
   */
  sendError(ws, code, message) {
    this.sendToAgent(ws, {
      id: nanoid(12),
      from: 'relay',
      to: [this.sockets.get(ws)],
      type: 'error',
      payload: { code, message },
      ts: Date.now()
    });
  }

  /**
   * Handle agent disconnect
   */
  handleDisconnect(ws) {
    const agentId = this.sockets.get(ws);
    if (agentId) {
      console.log(`[disconnect] ${agentId}`);
      this.agents.delete(agentId);
      this.sockets.delete(ws);
      
      // Clean up subscriptions
      this.cleanupSubscriptions(agentId);
    }
  }

  /**
   * Clean up subscriptions for disconnected agent
   */
  cleanupSubscriptions(agentId) {
    // Remove as subscriber
    for (const [targetId, subscribers] of this.subscriptions.entries()) {
      subscribers.delete(agentId);
      if (subscribers.size === 0) {
        this.subscriptions.delete(targetId);
      }
    }

    // Remove subscriptions to this agent
    this.subscriptions.delete(agentId);
  }

  /**
   * Get relay stats
   */
  getStats() {
    const subscriptionCount = Array.from(this.subscriptions.values())
      .reduce((sum, subscribers) => sum + subscribers.size, 0);

    return {
      connected: this.agents.size,
      agents: Array.from(this.agents.keys()),
      subscriptions: subscriptionCount
    };
  }
}
