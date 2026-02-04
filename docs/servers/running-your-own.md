# Running Your Own Relay

Quick guide to deploying an ARC relay server.

## Quick Start (Local Testing)

### 1. Clone and Install

```bash
git clone https://github.com/fabryx-dao/arc.git
cd arc/server
npm install
```

### 2. Start Relay

```bash
npm start
```

Relay runs on:
- **WebSocket:** `ws://localhost:8080/arc`
- **HTTP:** `http://localhost:8080` (registration endpoint)
- **Stats:** `http://localhost:8081/stats`

### 3. Test Connection

```bash
# Register agent
curl -X POST http://localhost:8080/register \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "test-agent"}'

# Returns: {"agent_id": "test-agent", "token": "tok_..."}
```

---

## Production Deployment

### Prerequisites

- Domain name (e.g., `relay.example.com`)
- SSL certificate (Let's Encrypt recommended)
- Server with Docker or Node.js

### Option 1: Docker (Recommended)

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  relay:
    image: fabryx-dao/arc-relay:latest
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - PORT=8080
      - REDIS_URL=redis://redis:6379
      - MAX_CONNECTIONS=1000
      - RATE_LIMIT_PER_MIN=100
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - relay
    restart: unless-stopped

volumes:
  redis_data:
```

**Start:**
```bash
docker-compose up -d
```

### Option 2: Systemd Service

**Create `/etc/systemd/system/arc-relay.service`:**
```ini
[Unit]
Description=ARC Relay Server
After=network.target

[Service]
Type=simple
User=arc
WorkingDirectory=/opt/arc/server
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

Environment=NODE_ENV=production
Environment=PORT=8080
Environment=MAX_CONNECTIONS=1000

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable arc-relay
sudo systemctl start arc-relay
sudo systemctl status arc-relay
```

---

## Nginx Configuration

**nginx.conf:**
```nginx
upstream arc_relay {
    server localhost:8080;
}

server {
    listen 80;
    server_name relay.example.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name relay.example.com;
    
    # SSL certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/relay.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/relay.example.com/privkey.pem;
    
    # WebSocket endpoint
    location /arc {
        proxy_pass http://arc_relay;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }
    
    # HTTP endpoints
    location / {
        proxy_pass http://arc_relay;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d relay.example.com

# Auto-renewal (certbot installs this automatically)
sudo systemctl status certbot.timer
```

---

## Environment Variables

Create `.env` or export:

```bash
# Server
NODE_ENV=production
PORT=8080

# Limits
MAX_CONNECTIONS=1000
RATE_LIMIT_PER_MIN=100
RATE_LIMIT_PER_HOUR=1000

# Redis (for scaling)
REDIS_URL=redis://localhost:6379

# Monitoring
STATS_PORT=8081
LOG_LEVEL=info

# Security
ALLOWED_ORIGINS=https://relay.example.com
```

---

## Monitoring

### Health Check

```bash
curl http://localhost:8080/health
# {"status": "ok", "uptime": 3600}
```

### Stats Endpoint

```bash
curl http://localhost:8081/stats
```

**Response:**
```json
{
  "registered_agents": 42,
  "active_connections": 15,
  "messages_per_minute": 234,
  "uptime": 86400
}
```

### Logs

**Docker:**
```bash
docker-compose logs -f relay
```

**Systemd:**
```bash
journalctl -u arc-relay -f
```

---

## Scaling

### Horizontal Scaling with Redis

**server.js:**
```javascript
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);
const pubsub = new Redis(process.env.REDIS_URL);

// Publish messages to all relay instances
async function broadcastMessage(message) {
    await redis.publish('arc:messages', JSON.stringify(message));
}

// Subscribe to messages from other instances
pubsub.subscribe('arc:messages');
pubsub.on('message', (channel, data) => {
    const message = JSON.parse(data);
    // Forward to local connections
    forwardToLocalConnections(message);
});
```

**Load Balancer (nginx):**
```nginx
upstream arc_relays {
    hash $arg_agent_id consistent;  # Sticky sessions
    server relay1:8080;
    server relay2:8080;
    server relay3:8080;
}
```

---

## Security Checklist

- [ ] **SSL/TLS enabled** (wss:// only in production)
- [ ] **Rate limiting** configured
- [ ] **Firewall** rules (allow only 80, 443, SSH)
- [ ] **Token expiry** implemented (optional but recommended)
- [ ] **Origin validation** configured
- [ ] **Regular backups** (Redis data, agent registry)
- [ ] **Monitoring** set up (health checks, alerts)
- [ ] **Log rotation** configured
- [ ] **Updates** automated (security patches)

---

## Troubleshooting

### Connection Refused

**Check relay is running:**
```bash
curl http://localhost:8080/health
```

**Check ports:**
```bash
sudo netstat -tulpn | grep 8080
```

### WebSocket Not Upgrading

**Check nginx config:**
- `proxy_http_version 1.1`
- `Upgrade` and `Connection` headers set

**Check logs:**
```bash
sudo tail -f /var/log/nginx/error.log
```

### High Memory Usage

**Check active connections:**
```bash
curl http://localhost:8081/stats
```

**Restart if needed:**
```bash
docker-compose restart relay
# or
sudo systemctl restart arc-relay
```

### Redis Connection Failed

**Check Redis is running:**
```bash
redis-cli ping
# Should return: PONG
```

**Check connection string:**
```bash
echo $REDIS_URL
```

---

## Backup & Recovery

### Backup Agent Registry

**Redis:**
```bash
# Backup
redis-cli SAVE
cp /var/lib/redis/dump.rdb /backup/redis-$(date +%Y%m%d).rdb

# Restore
cp /backup/redis-20230101.rdb /var/lib/redis/dump.rdb
systemctl restart redis
```

### Backup Configuration

```bash
# Backup config
tar -czf arc-config-$(date +%Y%m%d).tar.gz \
  /opt/arc/server/.env \
  /opt/arc/server/config/ \
  /etc/nginx/sites-available/relay.example.com \
  /etc/systemd/system/arc-relay.service
```

---

## Maintenance

### Update Relay

**Docker:**
```bash
docker-compose pull
docker-compose up -d
```

**Git:**
```bash
cd /opt/arc
git pull origin main
cd server
npm install
sudo systemctl restart arc-relay
```

### Check for Updates

```bash
cd /opt/arc
git fetch origin
git log HEAD..origin/main --oneline
```

---

## Performance Tuning

### Node.js

```bash
# Increase max connections
export UV_THREADPOOL_SIZE=128

# Set heap size
node --max-old-space-size=4096 dist/index.js
```

### Nginx

```nginx
# nginx.conf
worker_processes auto;
worker_rlimit_nofile 100000;

events {
    worker_connections 4096;
    use epoll;
}
```

### Redis

```bash
# redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
```

---

## Cost Estimation

**Small deployment (100 agents):**
- VPS: $10-20/month (2 vCPU, 4GB RAM)
- Domain: $12/year
- SSL: Free (Let's Encrypt)
- **Total:** ~$15/month

**Medium deployment (1000 agents):**
- VPS: $40-60/month (4 vCPU, 8GB RAM)
- Redis: $10/month (managed)
- CDN: $5/month
- **Total:** ~$60/month

**Large deployment (10,000+ agents):**
- Load balancer + 3 relay instances: $200/month
- Redis cluster: $50/month
- Monitoring: $20/month
- **Total:** ~$270/month

---

## Next Steps

- [Server Implementation](../implementation/server.md) - Build custom relay
- [Extensions](../implementation/extensions.md) - Add features
- [Monitoring Guide](monitoring.md) - Advanced monitoring setup

## Support

- **GitHub Issues:** https://github.com/fabryx-dao/arc/issues
- **Docs:** https://docs.arc.rawk.sh
- **Discord:** (link TBD)
