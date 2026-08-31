import { createJanusApp } from "../app.js";
import { JanusWebSocketHub } from "../websocket.js";

const config = {
  clientId: "id",
  clientSecret: "secret",
  redirectUri: "http://localhost/cb",
  frontendUrl: "http://localhost:5173",
  webhookUrl: "http://localhost/webhook",
  channelToken: "tok",
};

describe("createJanusApp", () => {
  it("returns an express app and a WebSocket hub", () => {
    const { app, wsHub } = createJanusApp(config);
    expect(typeof app).toBe("function"); // express() is a function
    expect(wsHub).toBeInstanceOf(JanusWebSocketHub);
  });

  it("wsHub.broadcast is a safe no-op before attach()", () => {
    const { wsHub } = createJanusApp(config);
    expect(() => wsHub.broadcast({ hello: "world" })).not.toThrow();
  });
});
