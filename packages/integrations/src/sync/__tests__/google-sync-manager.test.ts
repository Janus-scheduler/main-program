import { schedulerStore } from "@janus-scheduler/core";
import type { GoogleCalendarEvent } from "../../types/index.js";

// ── localStorage stub (node test env has none) ──────────────────────────────
const storageBacking = new Map<string, string>();
beforeAll(() => {
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => storageBacking.get(k) ?? null,
    setItem: (k: string, v: string) => {
      storageBacking.set(k, String(v));
    },
    removeItem: (k: string) => {
      storageBacking.delete(k);
    },
    clear: () => storageBacking.clear(),
    key: () => null,
    length: 0,
  } as Storage;
});

// ── GoogleWebSocketListener mock — captures the message handler ──────────────
interface MockListener {
  onMessage: (message: unknown) => void;
  start: jest.Mock;
  stop: jest.Mock;
}
const mockListenerInstances: MockListener[] = [];

jest.mock("../../listener/GoogleWebSocketListener.js", () => ({
  GoogleWebSocketListener: jest
    .fn()
    .mockImplementation((_config: unknown, onMessage: (m: unknown) => void) => {
      const instance: MockListener = {
        onMessage,
        start: jest.fn(),
        stop: jest.fn(),
      };
      mockListenerInstances.push(instance);
      return instance;
    }),
}));

// Imported after jest.mock so the mock is in place.
import { GoogleSyncManager } from "../GoogleSyncManager.js";
import { GoogleEventMapper } from "../../mapper/GoogleEventMapper.js";
import { GoogleCalendarClient } from "../../client/GoogleCalendarClient.js";

type MappingTables = {
  mappingTable: Map<string, string>;
  reverseTable: Map<string, string>;
};

function tablesOf(manager: GoogleSyncManager): MappingTables {
  return manager as unknown as MappingTables;
}

beforeEach(() => {
  storageBacking.clear();
  mockListenerInstances.length = 0;
  schedulerStore.getState().clearAll();
  jest.clearAllMocks();
});

describe("GoogleSyncManager — persisted mapping validation", () => {
  const mapper = new GoogleEventMapper();
  const client = new GoogleCalendarClient({ backendUrl: "http://backend" });

  it("loads well-formed entries", () => {
    storageBacking.set(
      "janus-google-sync-map",
      JSON.stringify([
        { janusId: "j1", googleId: "g1", resourceIds: ["r1"] },
        { janusId: "j2", googleId: "g2", resourceIds: [] },
      ]),
    );

    const manager = new GoogleSyncManager(client, mapper);
    const { mappingTable, reverseTable } = tablesOf(manager);

    expect(mappingTable.get("j1")).toBe("g1");
    expect(reverseTable.get("g2")).toBe("j2");
    expect(mappingTable.size).toBe(2);
  });

  it.each([
    ["a JSON object", JSON.stringify({ janusId: "j1" })],
    ["a JSON primitive", JSON.stringify("nope")],
    ["null", "null"],
    ["malformed JSON", "{not json"],
  ])("ignores %s without throwing", (_label, raw) => {
    storageBacking.set("janus-google-sync-map", raw);

    const manager = new GoogleSyncManager(client, mapper);

    expect(tablesOf(manager).mappingTable.size).toBe(0);
  });

  it("keeps valid entries and drops malformed ones from the same array", () => {
    storageBacking.set(
      "janus-google-sync-map",
      JSON.stringify([
        { janusId: "j1", googleId: "g1", resourceIds: ["r1"] },
        { janusId: "j2" }, // missing googleId / resourceIds
        { janusId: "", googleId: "g3", resourceIds: [] }, // empty id
        { janusId: "j4", googleId: "g4", resourceIds: [42] }, // non-string resourceId
        "loose string",
      ]),
    );

    const manager = new GoogleSyncManager(client, mapper);
    const { mappingTable } = tablesOf(manager);

    expect(mappingTable.size).toBe(1);
    expect(mappingTable.get("j1")).toBe("g1");
  });
});

describe("GoogleSyncManager — WebSocket startup race", () => {
  const mapper = new GoogleEventMapper();

  function timedEvent(id: string, title: string): GoogleCalendarEvent {
    return {
      id,
      summary: title,
      status: "confirmed",
      start: { dateTime: "2026-09-01T09:00:00.000Z" },
      end: { dateTime: "2026-09-01T10:00:00.000Z" },
    };
  }

  it("buffers messages received during the initial load, then applies them", async () => {
    let resolveFetch: (events: GoogleCalendarEvent[]) => void = () => {};
    const fetchGate = new Promise<GoogleCalendarEvent[]>((resolve) => {
      resolveFetch = resolve;
    });

    const client = {
      fetchInitialEvents: jest.fn().mockReturnValue(fetchGate),
      getBackendUrl: jest.fn().mockReturnValue("http://backend"),
    } as unknown as GoogleCalendarClient;

    const manager = new GoogleSyncManager(client, mapper);
    const startPromise = manager.startRealtimeSync();

    // Listener is created and started before the fetch resolves.
    expect(mockListenerInstances).toHaveLength(1);
    expect(mockListenerInstances[0].start).toHaveBeenCalledTimes(1);

    // A live change arrives mid-load — it must NOT be applied yet.
    mockListenerInstances[0].onMessage({
      type: "upserted",
      event: timedEvent("evt1", "Created in Google"),
    });
    expect(schedulerStore.getState().events["google-evt1"]).toBeUndefined();

    // Initial load completes → buffered message is flushed.
    resolveFetch([]);
    const stop = await startPromise;

    expect(schedulerStore.getState().events["google-evt1"]).toBeDefined();
    expect(schedulerStore.getState().events["google-evt1"].title).toBe(
      "Created in Google",
    );

    // Post-flush messages apply immediately (live mode).
    mockListenerInstances[0].onMessage({
      type: "upserted",
      event: timedEvent("evt2", "Second"),
    });
    expect(schedulerStore.getState().events["google-evt2"]).toBeDefined();

    stop();
    expect(mockListenerInstances[0].stop).toHaveBeenCalled();
  });
});
