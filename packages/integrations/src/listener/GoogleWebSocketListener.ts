import type { JanusGoogleConfig, WebSocketMessage } from "../types/index.js";

type MessageHandler = (message: WebSocketMessage) => void;

export class GoogleWebSocketListener {
  private readonly wsUrl: string;
  private readonly onMessage: MessageHandler;
  private ws: WebSocket | null = null;
  private shouldReconnect = true;
  private readonly reconnectDelayMs = 3000;

  constructor(config: JanusGoogleConfig, onMessage: MessageHandler) {
    // Convert http(s) → ws(s)
    this.wsUrl = config.backendUrl.replace(/\/$/, "").replace(/^http/, "ws");
    this.onMessage = onMessage;
  }

  start(): void {
    this.shouldReconnect = true;
    this.connect();
  }

  stop(): void {
    this.shouldReconnect = false;
    this.ws?.close();
    this.ws = null;
  }

  private connect(): void {
    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        console.log("[Janus Integrations] WebSocket connected");
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data as string) as WebSocketMessage;
          this.onMessage(message);
        } catch (err) {
          console.error(
            "[Janus Integrations] Failed to parse WebSocket message:",
            err,
          );
        }
      };

      this.ws.onclose = () => {
        console.log("[Janus Integrations] WebSocket disconnected");
        if (this.shouldReconnect) {
          setTimeout(() => this.connect(), this.reconnectDelayMs);
        }
      };

      this.ws.onerror = () => {
        // onclose fires after onerror, so reconnect is handled there
        console.error("[Janus Integrations] WebSocket error");
      };
    } catch (err) {
      console.error("[Janus Integrations] WebSocket connection failed:", err);
      if (this.shouldReconnect) {
        setTimeout(() => this.connect(), this.reconnectDelayMs);
      }
    }
  }
}
