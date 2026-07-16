import type { GoogleSyncManager } from "@janus-scheduler/integrations";

declare global {
  interface Window {
    __janusSyncManager?: GoogleSyncManager;
  }
}

export {};
