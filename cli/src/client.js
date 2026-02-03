import WebSocket from 'ws';

/**
 * ARC Client - WebSocket client for Agent Relay Chat
 */
export class ARCClient {
  constructor(relayUrl, token) {
    this.relayUrl = relayUrl;
    this.token = token;
    this.ws = null;
    this.agentId = null; // Will be set from welcome message
  }

  /**
   * Connect to relay and wait for welcome message
   */
  async connect() {
    return new Promise((resolve, reject) => {
      const url = `${this.relayUrl}?token=${this.token}`;
      this.ws = new WebSocket(url);

      const timeout = setTimeout(() => {
        this.ws.close();
        reject(new Error('Connection timeout'));
      }, 5000);

      this.ws.on('open', () => {
        // Wait for welcome message
      });

      this.ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'welcome') {
          // Extract our agent ID from the welcome message 'to' field
          this.agentId = msg.to?.[0] || 'unknown';
          clearTimeout(timeout);
          resolve(msg);
        }
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      this.ws.on('close', (code, reason) => {
        if (code !== 1000) {
          clearTimeout(timeout);
          reject(new Error(`Connection closed: ${code} ${reason}`));
        }
      });
    });
  }

  /**
   * Send message to relay
   */
  send(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected');
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send broadcast message
   */
  async broadcast(payload, type = null) {
    const msg = {
      to: ['*'],
      payload
    };
    
    if (type) {
      msg.type = type;
    }

    this.send(msg);
  }

  /**
   * Wait for next message
   */
  async waitForMessage(timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for message'));
      }, timeoutMs);

      const handler = (data) => {
        clearTimeout(timeout);
        this.ws.off('message', handler);
        resolve(JSON.parse(data.toString()));
      };

      this.ws.on('message', handler);
    });
  }

  /**
   * Listen for messages until connection closes or callback returns false
   */
  async listen(callback) {
    return new Promise((resolve, reject) => {
      this.ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        const shouldContinue = callback(msg);
        if (shouldContinue === false) {
          this.close();
          resolve();
        }
      });

      this.ws.on('close', () => resolve());
      this.ws.on('error', reject);
    });
  }

  /**
   * Close connection
   */
  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}
