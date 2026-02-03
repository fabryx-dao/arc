import { WebSocketServer } from 'ws';
import { ARCRelay } from './relay.js';

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

// Create relay
const relay = new ARCRelay();

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

// Stats endpoint (HTTP on same port + 1)
import http from 'http';
const statsServer = http.createServer((req, res) => {
  if (req.url === '/stats' || req.url === '/') {
    const stats = relay.getStats();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stats, null, 2));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const STATS_PORT = PORT + 1;
statsServer.listen(STATS_PORT, HOST, () => {
  console.log(`📊 Stats: http://${HOST}:${STATS_PORT}/stats`);
  console.log();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  wss.close(() => {
    statsServer.close();
    process.exit(0);
  });
});
