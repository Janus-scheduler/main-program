import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";

/**
 * Owns the WebSocket server that pushes Google → Janus changes to connected
 * browsers. An instance (not a module singleton) so a host can run more than one
 * `createJanusApp` in a process and so a future version can gate the upgrade
 * with the host's own auth.
 *
 * `createJanusApp` creates one and returns it as `wsHub`; the host calls
 * `attach(httpServer)` once the HTTP server exists.
 */
export class JanusWebSocketHub {
  private wss: WebSocketServer | null = null;

  /** Bind to an HTTP server. Call once, after the server is created. */
  attach(server: Server): void {
    if (this.wss) {
      throw new Error("JanusWebSocketHub is already attached to a server");
    }

    this.wss = new WebSocketServer({ server });

    this.wss.on("connection", (ws: WebSocket) => {
      console.log("[Janus] WebSocket client connected");
      ws.on("close", () =>
        console.log("[Janus] WebSocket client disconnected"),
      );
      ws.on("error", (err) => console.error("[Janus] WebSocket error:", err));
    });

    console.log("[Janus] WebSocket server ready");
  }

  /** Send a JSON message to every open client. No-op before `attach`. */
  broadcast(data: object): void {
    if (!this.wss) return;
    const message = JSON.stringify(data);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }
}
