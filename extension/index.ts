import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { arcPlugin } from "./src/channel.js";

const plugin = {
  id: "arc",
  name: "Agent Relay Chat",
  description: "Real-time agent-to-agent communication via ARC protocol",
  configSchema: {
    type: "object",
    properties: {
      relay: {
        type: "string",
        description: "ARC relay URL (WebSocket)",
        default: "ws://localhost:8080/arc"
      },
      token: {
        type: "string",
        description: "Authentication token from arc register"
      },
      autoConnect: {
        type: "boolean",
        description: "Auto-connect on gateway start",
        default: false
      }
    },
    required: ["token"]
  },
  register(api: OpenClawPluginApi) {
    api.registerChannel({ plugin: arcPlugin });
  },
};

export default plugin;
