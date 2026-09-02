import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { FileTokenStore } from "../FileTokenStore.js";
import { FileCalendarStateStore } from "../FileCalendarStateStore.js";
import type { TokenData, CalendarState } from "../../../types/index.js";

const SECRET = "test-passphrase";
let tmpDir: string;

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = SECRET;
});

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "janus-store-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const sampleTokens: TokenData = {
  access_token: "at-123",
  refresh_token: "rt-456",
  expiry_date: 1_900_000_000_000,
};

const sampleState: CalendarState = {
  janusCalendarId: "cal-1",
  syncToken: "sync-1",
  webhookChannelId: "chan-1",
  webhookResourceId: "res-1",
  webhookExpiration: "1900000000000",
};

/** Reproduce the legacy (pre-PBKDF2) envelope: sha256(secret) key, no v/salt. */
function writeLegacyEnvelope(file: string, tokens: TokenData): void {
  const key = crypto.createHash("sha256").update(SECRET).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(tokens), "utf-8"),
    cipher.final(),
  ]);
  const envelope = {
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
    data: data.toString("hex"),
  };
  fs.writeFileSync(file, JSON.stringify(envelope, null, 2));
}

describe("FileTokenStore", () => {
  it("round-trips tokens through an encrypted file", async () => {
    const file = path.join(tmpDir, "tokens.json");
    const store = new FileTokenStore(file);

    await store.set(sampleTokens);
    expect(await store.get()).toEqual(sampleTokens);

    // File on disk is a v2 envelope and not plaintext.
    const raw = fs.readFileSync(file, "utf-8");
    expect(JSON.parse(raw)).toMatchObject({ v: 2, salt: expect.any(String) });
    expect(raw).not.toContain("rt-456");
  });

  it("returns null when the file is missing", async () => {
    const store = new FileTokenStore(path.join(tmpDir, "nope.json"));
    expect(await store.get()).toBeNull();
  });

  it("reads a legacy v1 envelope, then rewrites it as v2", async () => {
    const file = path.join(tmpDir, "tokens.json");
    writeLegacyEnvelope(file, sampleTokens);

    const store = new FileTokenStore(file);
    expect(await store.get()).toEqual(sampleTokens);

    await store.set(sampleTokens);
    expect(JSON.parse(fs.readFileSync(file, "utf-8"))).toMatchObject({ v: 2 });
  });

  it("returns null when decryption fails (wrong key)", async () => {
    const file = path.join(tmpDir, "tokens.json");
    await new FileTokenStore(file).set(sampleTokens);

    process.env.TOKEN_ENCRYPTION_KEY = "a-different-passphrase";
    try {
      expect(await new FileTokenStore(file).get()).toBeNull();
    } finally {
      process.env.TOKEN_ENCRYPTION_KEY = SECRET;
    }
  });

  it("clear() removes the file", async () => {
    const file = path.join(tmpDir, "tokens.json");
    const store = new FileTokenStore(file);
    await store.set(sampleTokens);
    await store.clear();
    expect(fs.existsSync(file)).toBe(false);
  });
});

describe("FileCalendarStateStore", () => {
  it("round-trips calendar state", async () => {
    const store = new FileCalendarStateStore(path.join(tmpDir, "state.json"));
    await store.set(sampleState);
    expect(await store.get()).toEqual(sampleState);
  });

  it("returns null when missing", async () => {
    const store = new FileCalendarStateStore(path.join(tmpDir, "nope.json"));
    expect(await store.get()).toBeNull();
  });
});
