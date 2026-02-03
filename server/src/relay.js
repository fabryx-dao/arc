import { nanoid } from 'nanoid';
import { validateToken, extractToken } from './auth.js';

/**
 * ARC Relay - Core message routing
 */
export class ARCRelay {
  constructor() {
    this.agents = new Map(); // agentId → WebSocket
    this.sockets = new WeakMap(); // WebSocket → agentId
  }

  /**
   * Handle new WebSocket connection
   */
  async handleConnection(ws, req) {
    const token = extractToken(req);
    const auth = validateToken(token);

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
        capabilities: ['broadcast', 'direct'],
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

    // Validate required fields
    if (!msg.from || !msg.to || msg.payload === undefined) {
      console.error(`[validate] ${agentId}: Missing required fields`);
      this.sendError(ws, 'invalid_message', 'Missing required fields: from, to, payload');
      return;
    }

    // Validate from matches authenticated agent
    if (msg.from !== agentId) {
      console.error(`[validate] ${agentId}: from field mismatch`);
      this.sendError(ws, 'auth_mismatch', 'from field must match authenticated agent ID');
      return;
    }

    // Validate to is an array
    if (!Array.isArray(msg.to)) {
      console.error(`[validate] ${agentId}: to must be array`);
      this.sendError(ws, 'invalid_message', 'to field must be an array');
      return;
    }

    // Assign relay metadata
    const relayMsg = {
      id: nanoid(12),
      ...msg,
      ts: Date.now()
    };

    console.log(`[message] ${agentId} → ${msg.to.join(',')}: ${msg.type || 'message'}`);

    // Route message
    this.routeMessage(relayMsg, agentId);
  }

  /**
   * Route message based on 'to' field
   */
  routeMessage(msg, senderId) {
    const targets = msg.to;

    // Broadcast to all
    if (targets.includes('*')) {
      this.broadcast(msg, senderId);
      return;
    }

    // Direct messages (Phase 3)
    // For Phase 1, we only support broadcast
    console.warn(`[route] Direct messaging not yet implemented`);
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
    }
  }

  /**
   * Get relay stats
   */
  getStats() {
    return {
      connected: this.agents.size,
      agents: Array.from(this.agents.keys())
    };
  }
}
