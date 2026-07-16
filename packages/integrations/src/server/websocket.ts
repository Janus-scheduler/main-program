import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";

let wss: WebSocketServer | null = null;

export function initWebSocket(server: Server): void {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws: WebSocket) => {
    console.log("[Janus] WebSocket client connected");
    ws.on("close", () => console.log("[Janus] WebSocket client disconnected"));
    ws.on("error", (err) => console.error("[Janus] WebSocket error:", err));
  });

  console.log("[Janus] WebSocket server ready");
}

export function broadcast(data: object): void {
  if (!wss) return;
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
