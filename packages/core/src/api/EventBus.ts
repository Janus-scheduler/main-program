import { JanusEventMap } from "./api.types";

type EventHandler<K extends keyof JanusEventMap> = (
  payload: JanusEventMap[K],
) => void;

export class JanusEventBus {
  private listeners: {
    [K in keyof JanusEventMap]?: Array<EventHandler<K>>;
  } = {};

  /**
   * Subscribe to a Janus Scheduler event.
   */
  on<K extends keyof JanusEventMap>(event: K, handler: EventHandler<K>): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(handler);
  }

  /**
   * Unsubscribe from a Janus Scheduler event.
   */
  off<K extends keyof JanusEventMap>(event: K, handler: EventHandler<K>): void {
    if (!this.listeners[event]) return;
    const currentListeners = this.listeners[event] as Array<EventHandler<K>>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.listeners as any)[event] = currentListeners.filter(
      (h) => h !== handler,
    );
  }

  /**
   * Emit an event to all subscribers.
   */
  emit<K extends keyof JanusEventMap>(
    event: K,
    payload: JanusEventMap[K],
  ): void {
    if (!this.listeners[event]) return;
    this.listeners[event]!.forEach((handler) => {
      try {
        handler(payload);
      } catch (e) {
        console.error(`Error in event handler for ${event}:`, e);
      }
    });
  }
}

export const janusEventBus = new JanusEventBus();
