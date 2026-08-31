import * as fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { TokenData } from "../../types/index.js";
import type { TokenStore } from "./types.js";

/**
 * v2 envelope. `salt` is a fresh random value per write, fed with the
 * `TOKEN_ENCRYPTION_KEY` passphrase through PBKDF2 to derive the AES key —
 * so a weak passphrase can't be brute-forced with a fast single hash.
 *
 * A legacy v1 envelope has no `v`/`salt` and its key was a bare
 * `sha256(passphrase)`. `decrypt` still reads those so existing token files
 * keep working; the next `set()` rewrites them as v2.
 */
interface EncryptedEnvelope {
  v?: 2;
  salt?: string;
  iv: string;
  tag: string;
  data: string;
}

const PBKDF2_ITERATIONS = 100_000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function getSecret(): string {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY environment variable is required to store Google tokens.",
    );
  }
  return secret;
}

function deriveKeyV2(secret: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    secret,
    salt,
    PBKDF2_ITERATIONS,
    KEY_BYTES,
    "sha256",
  );
}

/** Legacy v1 key derivation — read-only, for envelopes written before PBKDF2. */
function deriveKeyLegacy(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(plaintext: string): EncryptedEnvelope {
  const salt = crypto.randomBytes(SALT_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const key = deriveKeyV2(getSecret(), salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  return {
    v: 2,
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
    data: data.toString("hex"),
  };
}

function decrypt(envelope: EncryptedEnvelope): string {
  const secret = getSecret();
  const key =
    envelope.v === 2 && envelope.salt
      ? deriveKeyV2(secret, Buffer.from(envelope.salt, "hex"))
      : deriveKeyLegacy(secret);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(envelope.iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, "hex"));
  const data = Buffer.concat([
    decipher.update(Buffer.from(envelope.data, "hex")),
    decipher.final(),
  ]);
  return data.toString("utf-8");
}

/**
 * Default {@link TokenStore} — an AES-256-GCM encrypted JSON file next to the
 * server process (`janus-tokens.json` in `process.cwd()` unless a path is
 * given). Requires a persistent filesystem and assumes a single Google
 * connection for the deployment.
 */
export class FileTokenStore implements TokenStore {
  private readonly file: string;

  constructor(filePath?: string) {
    this.file = filePath ?? path.join(process.cwd(), "janus-tokens.json");
  }

  async get(): Promise<TokenData | null> {
    try {
      const raw = await fs.readFile(this.file, "utf-8");
      const envelope = JSON.parse(raw) as EncryptedEnvelope;
      return JSON.parse(decrypt(envelope)) as TokenData;
    } catch (err: unknown) {
      // Missing/corrupt file, a rotated encryption key, or a plaintext file
      // left over from before encryption — all treated as "not connected",
      // prompting a clean reconnect.
      const error = err as { code?: string };
      if (error.code !== "ENOENT") {
        console.error(
          "[FileTokenStore] Failed to read or decrypt tokens:",
          err,
        );
      }
      return null;
    }
  }

  async set(tokens: TokenData): Promise<void> {
    const envelope = encrypt(JSON.stringify(tokens));
    await fs.writeFile(this.file, JSON.stringify(envelope, null, 2), "utf-8");
  }

  async clear(): Promise<void> {
    try {
      await fs.unlink(this.file);
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code !== "ENOENT") {
        throw err;
      }
    }
  }
}
