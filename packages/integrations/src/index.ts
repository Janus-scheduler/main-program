// ── Public client-side exports ────────────────────────────────────────────────
export { GoogleCalendarClient } from "./client/GoogleCalendarClient.js";
export { GoogleEventMapper } from "./mapper/GoogleEventMapper.js";
export { GoogleSyncManager } from "./sync/GoogleSyncManager.js";
export type {
  RemoteEventChange,
  GoogleSyncManagerOptions,
} from "./sync/GoogleSyncManager.js";
export { GoogleWebSocketListener } from "./listener/GoogleWebSocketListener.js";
export type {
  JanusGoogleConfig,
  GoogleCalendarEvent,
  WebSocketMessage,
} from "./types/index.js";

// // ── Server-side exports ───────────────────────────────────────────────────────
// // These are only imported in a Node.js server context (not in browser bundles)
// export { createJanusApp } from "./server/app.js";
// export type { JanusServerConfig } from "./server/app.js";
