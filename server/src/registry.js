import { nanoid } from 'nanoid';

/**
 * Agent Registry - Token and Agent ID management
 */
export class AgentRegistry {
  constructor() {
    this.tokens = new Map(); // token → agentId
    this.agentIds = new Set(); // Set of registered agent IDs
  }

  /**
   * Register a new agent and issue a token
   * @param {string|null} desiredAgentId - Optional desired agent ID
   * @returns {{agentId: string, token: string} | {error: string, message: string}}
   */
  register(desiredAgentId = null) {
    let agentId;

    if (desiredAgentId) {
      // Validate format
      if (!this.isValidAgentId(desiredAgentId)) {
        return {
          error: 'invalid_agent_id',
          message: 'Agent ID must be 3-64 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphens'
        };
      }

      // Check if taken
      if (this.agentIds.has(desiredAgentId)) {
        return {
          error: 'agent_id_taken',
          message: `Agent ID '${desiredAgentId}' is already registered`
        };
      }

      agentId = desiredAgentId;
    } else {
      // Auto-assign
      agentId = this.generateAgentId();
    }

    // Generate token
    const token = `tok_${nanoid(16)}`;

    // Store mappings
    this.tokens.set(token, agentId);
    this.agentIds.add(agentId);

    console.log(`[registry] Registered: ${agentId} → ${token.slice(0, 12)}...`);

    return { agent_id: agentId, token };
  }

  /**
   * Look up agent ID from token
   * @param {string} token
   * @returns {string|null}
   */
  getAgentId(token) {
    return this.tokens.get(token) || null;
  }

  /**
   * Validate agent ID format
   */
  isValidAgentId(id) {
    // 3-64 chars, lowercase alphanumeric + hyphens
    // No leading/trailing hyphens
    const pattern = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;
    return pattern.test(id);
  }

  /**
   * Generate a unique agent ID
   */
  generateAgentId() {
    let id;
    let attempts = 0;
    
    do {
      // Format: agent-<random>
      id = `agent-${nanoid(8).toLowerCase()}`;
      attempts++;
      
      if (attempts > 100) {
        throw new Error('Failed to generate unique agent ID');
      }
    } while (this.agentIds.has(id));

    return id;
  }

  /**
   * Get registry stats
   */
  getStats() {
    return {
      registered: this.agentIds.size,
      agents: Array.from(this.agentIds)
    };
  }
}
