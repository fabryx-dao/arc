/**
 * Simple token-based authentication
 * 
 * For Phase 1: Any token that looks like "agent-*" is valid
 * Future: JWT validation, token database, etc.
 */

export function validateToken(token) {
  if (!token) {
    return { valid: false, error: 'Missing token' };
  }

  // Phase 1: Accept any token that matches pattern "agent-*"
  // This is intentionally permissive for testing
  if (token.startsWith('agent-')) {
    const agentId = token;
    return { valid: true, agentId };
  }

  return { valid: false, error: 'Invalid token format' };
}

/**
 * Extract token from WebSocket request
 * Supports: Authorization header or ?token= query param
 */
export function extractToken(req) {
  // Try Authorization header first
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Try query parameter
  const url = new URL(req.url, 'ws://placeholder');
  return url.searchParams.get('token');
}
