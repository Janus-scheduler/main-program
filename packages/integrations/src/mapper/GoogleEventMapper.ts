import {
  isoToZonedDisplay,
  zonedInputToISO,
  type EventData,
} from "@janus-scheduler/core";
import type { GoogleAttendee, GoogleCalendarEvent } from "../types/index.js";

/** Add (or, with a negative count, subtract) whole days from a "YYYY-MM-DD" string. */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
}

/**
 * Janus stores a bare RFC5545 RRULE line (no "RRULE:" prefix, no DTSTART —
 * that's derived separately from startTime). Google's `recurrence` field
 * wants an array of full lines, each with its type prefix.
 */
function toGoogleRecurrence(recurrenceRule?: string): string[] | undefined {
  if (!recurrenceRule) return undefined;
  return [`RRULE:${recurrenceRule}`];
}

/** Inverse of toGoogleRecurrence — pulls the RRULE line back out and strips the prefix. */
function fromGoogleRecurrence(recurrence?: string[]): string | undefined {
  const rruleLine = recurrence?.find((line) => line.startsWith("RRULE:"));
  return rruleLine?.slice("RRULE:".length);
}

/**
 * Marks the start of the auto-generated equipment block appended to
 * `description` when pushing to Google. Always a single well-known line so
 * toJanus() can strip it back out — otherwise a Google-authored echo of our
 * own push (e.g. via the webhook) would bake the block into Janus's
 * `description` field, and the next push would append a second block on top
 * of it.
 */
const EQUIPMENT_BLOCK_MARKER = "\n\n— Equipment —\n";

/** Rebuilds `description` from the user's own text plus a fresh equipment block — never appends onto a previous block. */
function buildDescription(
  description: string,
  equipmentNames: string[],
): string {
  if (equipmentNames.length === 0) return description;
  const lines = equipmentNames.map((name) => `• ${name}`).join("\n");
  return `${description}${EQUIPMENT_BLOCK_MARKER}${lines}`;
}

/** Inverse of buildDescription — strips the generated equipment block back out. */
function stripEquipmentBlock(description: string): string {
  const idx = description.indexOf(EQUIPMENT_BLOCK_MARKER);
  return idx === -1 ? description : description.slice(0, idx);
}

/** Context the caller (which has store access) resolves from an event's resourceIds. */
export interface GoogleResourceContext {
  /** Names of assigned "room" resources — joined into Google's `location` field. */
  roomNames?: string[];
  /** Names of assigned "equipment" resources — rendered into a generated `description` block. */
  equipmentNames?: string[];
  /** All assigned resourceIds (every type), stashed in `extendedProperties.private` for lossless round-tripping later. */
  resourceIds?: string[];
}

export class GoogleEventMapper {
  private static readonly DEFAULT_RESOURCE_ID = "google-calendar";
  private static readonly RESOURCE_IDS_PROPERTY = "janusResourceIds";

  /**
   * Convert a Janus EventData → Google Calendar event format.
   * `attendees`, `location`, and `extendedProperties` are always included
   * (even empty) so that an update which removes the last assigned
   * person/room/resource clears them on the Google side too — PATCH only
   * touches fields present in the request body.
   */
  toGoogle(
    event: EventData,
    attendees: GoogleAttendee[] = [],
    resourceContext: GoogleResourceContext = {},
  ): GoogleCalendarEvent {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const {
      roomNames = [],
      equipmentNames = [],
      resourceIds = [],
    } = resourceContext;

    const location = roomNames.join(", ");
    const description = buildDescription(
      event.description || "",
      equipmentNames,
    );
    const extendedProperties = {
      private: {
        [GoogleEventMapper.RESOURCE_IDS_PROPERTY]: resourceIds.join(","),
      },
    };

    if (event.allDay) {
      // event.startTime/endTime are UTC-anchored instants produced by
      // zonedInputToISO(date, "00:00"/"23:59", localTz) — the calendar date
      // they represent depends on the local timezone offset, not the raw
      // UTC date embedded in the string. Splitting the ISO string directly
      // was off by a day whenever the local offset crossed a UTC day
      // boundary (e.g. any timezone behind UTC pushes 23:59 local into the
      // next UTC day).
      const startDate = isoToZonedDisplay(event.startTime, timeZone).date;
      const lastIncludedDate = isoToZonedDisplay(event.endTime, timeZone).date;
      return {
        summary: event.title,
        description,
        location,
        attendees,
        extendedProperties,
        recurrence: toGoogleRecurrence(event.recurrenceRule),
        start: { date: startDate },
        // Google's all-day end.date is EXCLUSIVE (the day AFTER the last
        // included day); Janus's endTime is the last *included* day
        // (23:59 local) — add one day to convert conventions.
        end: { date: addDays(lastIncludedDate, 1) },
      };
    }

    return {
      summary: event.title,
      description,
      location,
      attendees,
      extendedProperties,
      recurrence: toGoogleRecurrence(event.recurrenceRule),
      start: { dateTime: event.startTime, timeZone },
      end: { dateTime: event.endTime, timeZone },
    };
  }

  /**
   * Convert a Google Calendar event → Janus EventData shape.
   * Uses existingJanusId when updating a known event,
   * otherwise generates a stable id from the Google event id.
   *
   * `resolvedResourceIds` — resourceIds reverse-mapped from the Google event's
   * attendee emails (by the caller, which has store access). Falls back to the
   * placeholder "google-calendar" resource when nothing resolves, since
   * Event.isValid()/addEvent requires at least one resourceId.
   */
  toJanus(
    googleEvent: GoogleCalendarEvent,
    existingJanusId?: string,
    resolvedResourceIds?: string[],
  ): EventData {
    const isAllDay = !googleEvent.start.dateTime;
    const resourceIds =
      resolvedResourceIds && resolvedResourceIds.length > 0
        ? resolvedResourceIds
        : [GoogleEventMapper.DEFAULT_RESOURCE_ID];

    if (isAllDay) {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Google's end.date is EXCLUSIVE — subtract a day to get the last
      // included day (Janus's convention), then build both timestamps the
      // same way Janus's own UI does (zonedInputToISO), so a later
      // round-trip back through toGoogle() resolves to identical dates.
      const lastIncludedDate = addDays(googleEvent.end.date!, -1);
      return {
        id: existingJanusId ?? `google-${googleEvent.id}`,
        title: googleEvent.summary || "Untitled",
        description: stripEquipmentBlock(googleEvent.description || ""),
        allDay: true,
        resourceId: resourceIds[0],
        resourceIds,
        status: "confirmed",
        recurrenceRule: fromGoogleRecurrence(googleEvent.recurrence),
        startTime: zonedInputToISO(googleEvent.start.date!, "00:00", timeZone),
        endTime: zonedInputToISO(lastIncludedDate, "23:59", timeZone),
      };
    }

    return {
      id: existingJanusId ?? `google-${googleEvent.id}`,
      title: googleEvent.summary || "Untitled",
      description: stripEquipmentBlock(googleEvent.description || ""),
      allDay: false,
      resourceId: resourceIds[0],
      resourceIds,
      status: "confirmed",
      recurrenceRule: fromGoogleRecurrence(googleEvent.recurrence),
      startTime: googleEvent.start.dateTime!,
      endTime: googleEvent.end.dateTime!,
    };
  }

  static get defaultResourceId(): string {
    return GoogleEventMapper.DEFAULT_RESOURCE_ID;
  }

  static get resourceIdsPropertyKey(): string {
    return GoogleEventMapper.RESOURCE_IDS_PROPERTY;
  }
}
