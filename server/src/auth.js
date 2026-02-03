/**
 * Token-based authentication using registry
 */

export function validateToken(token, registry) {
  if (!token) {
    return { valid: false, error: 'Missing token' };
  }

  const agentId = registry.getAgentId(token);
  
  if (!agentId) {
    return { valid: false, error: 'Invalid or unregistered token' };
  }

  return { valid: true, agentId };
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
