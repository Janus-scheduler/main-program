/**
 * time.ts
 *
 * Timezone-aware date/time utilities for the Janus Scheduler.
 * All functions use the native Intl API — no external dependencies.
 */

/** Get the browser's IANA timezone string (e.g. "Asia/Kolkata"). */
export function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// ─────────────────────────────────────────────────────────────────────────────
// Memoized Intl.DateTimeFormat instances, keyed by IANA timezone.
//
// Constructing an Intl.DateTimeFormat resolves ICU locale + timezone data and
// is one of the most expensive operations in the engine (~10-50µs). The
// scheduler calls these helpers once per event per store change — tens of
// thousands of times on large datasets — so the formatters are cached.
//
// Reuse is behaviour-identical: Intl.DateTimeFormat instances are immutable and
// stateless, and formatToParts() keeps no cursor between calls. Timezone
// offsets (incl. DST) are resolved per format() call against the passed Date,
// not baked into the formatter.
//
// There is one cache per distinct options shape. `getUtcMsForZonedDatetime` and
// `toFakeLocalDate` use byte-identical options, so they share `_fullPartsFmts`.
// ─────────────────────────────────────────────────────────────────────────────

/** en-CA, year/month/day — the date half of isoToZonedDisplay. */
const _dateFmts = new Map<string, Intl.DateTimeFormat>();
/** en-US, hour/minute, hour12:false — the time half of isoToZonedDisplay. */
const _timeFmts = new Map<string, Intl.DateTimeFormat>();
/** en-US, full y/m/d h:m:s, hour12:false — shared by the two offset helpers. */
const _fullPartsFmts = new Map<string, Intl.DateTimeFormat>();
/** en, timeZoneName:shortOffset — formatTimezoneLabel. */
const _offsetFmts = new Map<string, Intl.DateTimeFormat>();

/**
 * Return a cached formatter for `timezone`, constructing it on first use.
 *
 * `create()` is invoked *before* the cache write on purpose: an invalid
 * timezone throws a RangeError here and nothing is stored, so a bad key can
 * never poison the cache and callers keep their existing throw behaviour.
 */
function _memoFmt(
  cache: Map<string, Intl.DateTimeFormat>,
  timezone: string,
  create: () => Intl.DateTimeFormat,
): Intl.DateTimeFormat {
  let fmt = cache.get(timezone);
  if (fmt === undefined) {
    fmt = create();
    // The IANA timezone set is finite (~600 entries), so this cannot grow
    // without bound. The guard is a defensive backstop only.
    if (cache.size > 512) cache.clear();
    cache.set(timezone, fmt);
  }
  return fmt;
}

/**
 * Convert a UTC ISO string → { date, time } displayed in the given IANA timezone.
 * date: "YYYY-MM-DD"  |  time: "HH:MM" (24-hour)
 */
export function isoToZonedDisplay(
  iso: string,
  timezone: string,
): { date: string; time: string } {
  const d = new Date(iso);

  const dateParts = _memoFmt(
    _dateFmts,
    timezone,
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
  ).formatToParts(d);

  const year = dateParts.find((p) => p.type === "year")?.value ?? "";
  const month = dateParts.find((p) => p.type === "month")?.value ?? "";
  const day = dateParts.find((p) => p.type === "day")?.value ?? "";

  const timeParts = _memoFmt(
    _timeFmts,
    timezone,
    () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
  ).formatToParts(d);

  let hour = timeParts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = timeParts.find((p) => p.type === "minute")?.value ?? "00";
  if (hour === "24") hour = "00"; // midnight edge case

  return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
}

/**
 * Get the UTC milliseconds for a date+time string interpreted in the given IANA timezone.
 * date: "YYYY-MM-DD"  |  time: "HH:MM"
 */
export function getUtcMsForZonedDatetime(
  date: string,
  time: string,
  timezone: string,
): number {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, m] = time.split(":").map(Number);

  const getOffset = (utcInstant: number) => {
    const parts = _memoFmt(
      _fullPartsFmts,
      timezone,
      () =>
        new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
    ).formatToParts(new Date(utcInstant));

    const zonedY = Number(parts.find((p) => p.type === "year")?.value);
    const zonedMo = Number(parts.find((p) => p.type === "month")?.value);
    const zonedD = Number(parts.find((p) => p.type === "day")?.value);
    let zonedH = Number(parts.find((p) => p.type === "hour")?.value);
    const zonedM = Number(parts.find((p) => p.type === "minute")?.value);
    const zonedS = Number(parts.find((p) => p.type === "second")?.value);
    if (zonedH === 24) zonedH = 0;

    const zonedAsUtc = Date.UTC(
      zonedY,
      zonedMo - 1,
      zonedD,
      zonedH,
      zonedM,
      zonedS,
    );
    return zonedAsUtc - utcInstant;
  };

  const nominalUtc = Date.UTC(y, mo - 1, d, h, m, 0);
  const firstOffset = getOffset(nominalUtc);
  const candidate = nominalUtc - firstOffset;
  const secondOffset = getOffset(candidate);

  return secondOffset === firstOffset ? candidate : nominalUtc - secondOffset;
}

/**
 * Convert a user-entered date+time (in the given timezone) → UTC ISO string.
 * date: "YYYY-MM-DD"  |  time: "HH:MM"
 */
export function zonedInputToISO(
  date: string,
  time: string,
  timezone: string,
): string {
  return new Date(getUtcMsForZonedDatetime(date, time, timezone)).toISOString();
}

/**
 * Return a "fake" local Date whose local-time getters reflect the given timezone.
 * Used to pass to existing formatter functions that call getHours(), getDay(), etc.
 */
export function toFakeLocalDate(tsMs: number, timezone: string): Date {
  const parts = _memoFmt(
    _fullPartsFmts,
    timezone,
    () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }),
  ).formatToParts(new Date(tsMs));

  const y = Number(parts.find((p) => p.type === "year")?.value);
  const mo = Number(parts.find((p) => p.type === "month")?.value) - 1;
  const d = Number(parts.find((p) => p.type === "day")?.value);
  let h = Number(parts.find((p) => p.type === "hour")?.value);
  const min = Number(parts.find((p) => p.type === "minute")?.value);
  const s = Number(parts.find((p) => p.type === "second")?.value);
  if (h === 24) h = 0;

  // Constructed with local Date constructor → getHours() etc. return correct values
  return new Date(y, mo, d, h, min, s);
}

/**
 * Human-readable label for a timezone including its UTC offset.
 * e.g. "Asia/Kolkata (UTC+5:30)"
 */
export function formatTimezoneLabel(tz: string): string {
  try {
    const offset =
      _memoFmt(
        _offsetFmts,
        tz,
        () =>
          new Intl.DateTimeFormat("en", {
            timeZone: tz,
            timeZoneName: "shortOffset",
          }),
      )
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value ?? "";
    return `${tz} (${offset})`;
  } catch {
    return tz;
  }
}

/**
 * All IANA timezone strings supported by the browser.
 * Falls back to a curated list when Intl.supportedValuesOf is unavailable.
 */
export function getAllTimezones(): string[] {
  try {
    const list = Intl.supportedValuesOf("timeZone") as string[];
    return list ?? FALLBACK_TIMEZONES;
  } catch {
    return FALLBACK_TIMEZONES;
  }
}

const FALLBACK_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Colombo",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
  "Pacific/Auckland",
];
