import type { ChannelPlugin } from "openclaw/plugin-sdk";
import WebSocket from "ws";

interface ARCConfig {
  relay: string;
  token: string;
  autoConnect?: boolean;
}

interface ARCMessage {
  id: string;
  from: string;
  to: string[];
  payload: any;
  type?: string;
  ts: number;
}

/**
 * ARC Channel Plugin for OpenClaw
 * 
 * Maintains persistent WebSocket connection to ARC relay
 * Routes incoming messages to agent
 * Sends agent messages to relay
 */
export const arcPlugin: ChannelPlugin<ARCConfig> = {
  id: "arc",
  meta: {
    displayName: "Agent Relay Chat",
    description: "Real-time agent-to-agent communication",
    color: "#4CAF50",
    icon: "🪨"
  },
  capabilities: {
    chatTypes: ["broadcast", "direct"],
    streaming: false,
    media: false,
    reactions: false,
    threads: false,
    polls: false
  },
  configSchema: {
    type: "object",
    properties: {
      relay: { type: "string" },
      token: { type: "string" },
      autoConnect: { type: "boolean" }
    },
    required: ["token"]
  },
  
  async start({ config, runtime }) {
    const relay = config.relay || "ws://localhost:8080/arc";
    const token = config.token;

    if (!token) {
      runtime.log.warn("ARC: No token configured, skipping connection");
      return;
    }

    runtime.log.info(`ARC: Connecting to ${relay}...`);

    const ws = new WebSocket(`${relay}?token=${token}`);
    let agentId: string | null = null;
    let isConnected = false;

    ws.on("open", () => {
      runtime.log.info("ARC: WebSocket connection established");
    });

    ws.on("message", async (data: Buffer) => {
      try {
        const msg: ARCMessage = JSON.parse(data.toString());

        // Handle welcome message
        if (msg.type === "welcome") {
          agentId = msg.to[0];
          isConnected = true;
          runtime.log.info(`ARC: Connected as ${agentId}`);
          runtime.log.info(`ARC: Relay: ${msg.payload.relay} v${msg.payload.version}`);
          runtime.log.info(`ARC: Capabilities: ${msg.payload.capabilities.join(", ")}`);
          return;
        }

        // Skip relay control messages
        if (msg.from === "relay") {
          return;
        }

        // Route message to agent
        const messageText = typeof msg.payload === "string" 
          ? msg.payload 
          : JSON.stringify(msg.payload);

        runtime.log.info(`ARC: Message from ${msg.from} (${msg.type || "message"})`);

        // Format message for agent
        const formattedMessage = `[ARC] ${msg.from}: ${messageText}`;

        // Send to agent via runtime
        await runtime.sendToAgent({
          text: formattedMessage,
          metadata: {
            channel: "arc",
            from: msg.from,
            messageId: msg.id,
            timestamp: msg.ts,
            type: msg.type,
            raw: msg
          }
        });

      } catch (err) {
        runtime.log.error("ARC: Error processing message:", err);
      }
    });

    ws.on("close", (code: number, reason: Buffer) => {
      isConnected = false;
      runtime.log.warn(`ARC: Connection closed (${code}): ${reason.toString()}`);
    });

    ws.on("error", (err: Error) => {
      runtime.log.error("ARC: WebSocket error:", err);
    });

    // Register message sender
    runtime.registerMessageSender(async ({ text, target, metadata }) => {
      if (!isConnected) {
        throw new Error("ARC: Not connected to relay");
      }

      // Parse target (default: broadcast)
      const to = target ? [target] : ["*"];

      // Prepare message (client doesn't send 'from', relay assigns it)
      const message = {
        to,
        payload: text,
        type: metadata?.type || undefined
      };

      // Send via WebSocket
      ws.send(JSON.stringify(message));

      runtime.log.info(`ARC: Sent message to ${to.join(", ")}`);
    });

    // Keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);

    // Cleanup on stop
    runtime.onStop(() => {
      clearInterval(pingInterval);
      ws.close();
      runtime.log.info("ARC: Disconnected");
    });
  }
};
