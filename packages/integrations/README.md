# @janus-scheduler/integrations

Google Calendar two-way sync for [Janus Scheduler](../../README.md).

The package has two entry points:

| Import                                 | Runs in     | Contents                                                                                    |
| -------------------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `@janus-scheduler/integrations`        | the browser | `GoogleSyncManager`, `GoogleCalendarClient`, `GoogleWebSocketListener`, `GoogleEventMapper` |
| `@janus-scheduler/integrations/server` | Node        | `createJanusApp`, `JanusWebSocketHub`, the store interfaces + file defaults                 |

The browser side talks to an HTTP + WebSocket backend that you run. The
`/server` entry **is** that backend — you don't have to reimplement the OAuth
flow, webhook registration, or webhook renewal.

---

## Client (browser)

```ts
import {
  GoogleSyncManager,
  GoogleCalendarClient,
  GoogleEventMapper,
} from "@janus-scheduler/integrations";
import { SchedulerManager } from "@janus-scheduler/react"; // or your framework

const client = new GoogleCalendarClient({
  backendUrl: "https://api.example.com",
});
const sync = new GoogleSyncManager(client, new GoogleEventMapper());

const manager = new SchedulerManager({ ...sync.getHooks() });

// after the user is connected:
const stop = await sync.startRealtimeSync(); // returns a teardown function
```

See the demo apps under [`demo/`](../../demo) for the full wiring
(`handleOAuthRedirect`, `onStatusChange`, `refreshStatus`).

---

## Backend

```ts
import http from "node:http";
import { createJanusApp } from "@janus-scheduler/integrations/server";

const { app, wsHub } = createJanusApp({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: process.env.REDIRECT_URI!, // https://api.example.com/auth/google/callback
  frontendUrl: process.env.FRONTEND_URL!, // your app's origin (used for CORS + redirect)
  webhookUrl: process.env.WEBHOOK_URL!, // https://api.example.com/webhook/google
  channelToken: process.env.CHANNEL_TOKEN!, // any secret string; verifies Google's calls
});

const server = http.createServer(app);
wsHub.attach(server); // bind the WebSocket server
server.listen(3001);
```

`packages/integrations/src/server/server.ts` is a ready-to-run version of the
above (env validation + a daily webhook-renewal cron). Run it with
`npm run start:backend` from the repo root.

### Required environment

| Var                                         | Purpose                                                                     |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth client from Google Cloud Console                                      |
| `REDIRECT_URI`                              | must be `<backend>/auth/google/callback` and registered on the OAuth client |
| `FRONTEND_URL`                              | your app's origin — CORS allow-list and post-OAuth redirect target          |
| `WEBHOOK_URL`                               | must be `<backend>/webhook/google`, publicly reachable over **HTTPS**       |
| `CHANNEL_TOKEN`                             | shared secret Google echoes back on each notification                       |
| `TOKEN_ENCRYPTION_KEY`                      | passphrase for the token-at-rest encryption (see below)                     |

### Deployment requirements

- **HTTPS** — Google requires the webhook receiver and the OAuth redirect URI to
  be HTTPS with a valid certificate.
- **Persistent disk** — the default stores write `janus-tokens.json` and
  `janus-calendar-state.json` in the working directory. On an ephemeral
  filesystem (many PaaS/serverless platforms) the Google connection is lost on
  every restart. Use a mounted volume, or provide your own stores (below).
- **Webhook renewal** — Google push channels expire after ~7 days.
  `server.ts` renews them on a daily cron; if you build your own entry, port
  `renewWebhookIfNeeded`.

### Token encryption

Tokens are stored AES-256-GCM encrypted. The key is derived from
`TOKEN_ENCRYPTION_KEY` with PBKDF2 (100k iterations, per-file random salt).
Files written by an older version (bare SHA-256 key) are still readable and are
transparently upgraded on the next write — no reconnect needed.

---

## Single-tenant by default

`createJanusApp` assumes **one Google account per deployment** — one token file,
one calendar. That fits an internal tool or a single shared team calendar.

### Extending to multi-tenant

1. **Persistence** — implement `TokenStore` and `CalendarStateStore` (both are
   small async `get` / `set` / `clear` interfaces) against your database,
   keyed by _your_ user/tenant id, and pass them:

   ```ts
   createJanusApp({ ...config, tokenStore, calendarStateStore });
   ```

2. **Auth** — the mutating endpoints (`/events`, `/auth/status`,
   `/auth/initial-events`, `/auth/disconnect`) are unauthenticated by default.
   Mount your own auth in front of them. (`/auth/google`,
   `/auth/google/callback`, and `/webhook/google` must stay open — they're
   called by the browser and by Google.) A first-class `authMiddleware` option
   is planned.

3. **Webhook routing** — Google posts every calendar's changes to the one
   `WEBHOOK_URL`. To route a notification to the right tenant you must store
   `channelId → tenant` at registration time and look it up in the webhook
   handler. This is not built in.

Per-connection WebSocket authorization is likewise out of scope today — the
`JanusWebSocketHub` broadcasts to every connected client.
