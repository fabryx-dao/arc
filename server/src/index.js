import { WebSocketServer } from 'ws';
import http from 'http';
import { ARCRelay } from './relay.js';
import { AgentRegistry } from './registry.js';

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

// Create registry and relay
const registry = new AgentRegistry();
const relay = new ARCRelay(registry);

// Create WebSocket server
const wss = new WebSocketServer({
  port: PORT,
  host: HOST,
  path: '/arc'
});

console.log(`🪨 ARC Relay starting...`);
console.log(`   Port: ${PORT}`);
console.log(`   Path: ws://${HOST}:${PORT}/arc`);
console.log(`   Protocol: Agent Relay Chat v0.1.0`);
console.log();

wss.on('connection', (ws, req) => {
  relay.handleConnection(ws, req);
});

wss.on('listening', () => {
  console.log(`✅ Relay listening on ws://${HOST}:${PORT}/arc`);
  console.log();
});

wss.on('error', (err) => {
  console.error('Server error:', err);
});

// HTTP server for registration and stats (same port + 1)
const httpServer = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // POST /register - Register new agent
  if (req.method === 'POST' && req.url === '/register') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let data = {};
      try {
        if (body) data = JSON.parse(body);
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_json', message: 'Malformed JSON' }));
        return;
      }

      const result = registry.register(data.agent_id || null);

      if (result.error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      }
    });
    return;
  }

  // GET /stats - Relay and registry stats
  if (req.method === 'GET' && (req.url === '/stats' || req.url === '/')) {
    const stats = {
      relay: relay.getStats(),
      registry: registry.getStats()
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stats, null, 2));
    return;
  }

  // 404
  res.writeHead(404);
  res.end('Not found');
});

const HTTP_PORT = PORT + 1;
httpServer.listen(HTTP_PORT, HOST, () => {
  console.log(`📝 Register: http://${HOST}:${HTTP_PORT}/register`);
  console.log(`📊 Stats: http://${HOST}:${HTTP_PORT}/stats`);
  console.log();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  wss.close(() => {
    httpServer.close();
    process.exit(0);
  });
});
