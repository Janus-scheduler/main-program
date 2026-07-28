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

export class GoogleEventMapper {
  private static readonly DEFAULT_RESOURCE_ID = "google-calendar";

  /**
   * Convert a Janus EventData → Google Calendar event format.
   * `attendees` is always included (even empty) so that an update which
   * removes the last assigned person clears attendees on the Google side too —
   * PATCH only touches fields present in the request body.
   */
  toGoogle(
    event: EventData,
    attendees: GoogleAttendee[] = [],
  ): GoogleCalendarEvent {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
        description: event.description || "",
        attendees,
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
      description: event.description || "",
      attendees,
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
        description: googleEvent.description || "",
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
      description: googleEvent.description || "",
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
}
