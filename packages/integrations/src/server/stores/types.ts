import type { TokenData, CalendarState } from "../../types/index.js";

/**
 * Persistence seam for the single Google OAuth token set.
 *
 * The bundled {@link FileTokenStore} writes an encrypted JSON file. A host that
 * needs multi-tenant behaviour (one Google connection per *their* user) or a
 * deployment target without a persistent filesystem (serverless, multi-instance)
 * implements this against their own database instead and passes it to
 * `createJanusApp({ tokenStore })`.
 *
 * All methods are async so a database-backed implementation is possible.
 */
export interface TokenStore {
  /** The stored token set, or `null` when nothing is stored / it can't be read. */
  get(): Promise<TokenData | null>;
  set(tokens: TokenData): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Persistence seam for the calendar bootstrap state (the Janus calendar id, the
 * incremental sync token, and the registered webhook channel). Same rationale as
 * {@link TokenStore}; the bundled default is {@link FileCalendarStateStore}.
 */
export interface CalendarStateStore {
  get(): Promise<CalendarState | null>;
  set(state: CalendarState): Promise<void>;
  clear(): Promise<void>;
}
