import { GoogleCalendarClient } from "../GoogleCalendarClient.js";

describe("GoogleCalendarClient.deleteEvent", () => {
  const client = new GoogleCalendarClient({ backendUrl: "http://backend" });

  function mockFetchStatus(status: number): void {
    global.fetch = jest.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: `status ${status}`,
    }) as unknown as typeof fetch;
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("resolves on a 200 OK", async () => {
    mockFetchStatus(200);
    await expect(client.deleteEvent("g1")).resolves.toBeUndefined();
  });

  it("treats 404 Not Found as success (event already gone)", async () => {
    mockFetchStatus(404);
    await expect(client.deleteEvent("g1")).resolves.toBeUndefined();
  });

  it("treats 410 Gone as success (event already gone)", async () => {
    mockFetchStatus(410);
    await expect(client.deleteEvent("g1")).resolves.toBeUndefined();
  });

  it("still throws on a 500 (a real failure worth rolling back)", async () => {
    mockFetchStatus(500);
    await expect(client.deleteEvent("g1")).rejects.toThrow(
      "deleteEvent failed",
    );
  });
});
