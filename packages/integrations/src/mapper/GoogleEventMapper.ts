import type { EventData } from "@janus-scheduler/core";
import type { GoogleAttendee, GoogleCalendarEvent } from "../types/index.js";

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
      return {
        summary: event.title,
        description: event.description || "",
        attendees,
        start: { date: event.startTime.split("T")[0] },
        end: { date: event.endTime.split("T")[0] },
      };
    }

    return {
      summary: event.title,
      description: event.description || "",
      attendees,
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

    return {
      id: existingJanusId ?? `google-${googleEvent.id}`,
      title: googleEvent.summary || "Untitled",
      description: googleEvent.description || "",
      allDay: isAllDay,
      resourceId: resourceIds[0],
      resourceIds,
      status: "confirmed",
      startTime: isAllDay
        ? `${googleEvent.start.date}T00:00:00.000Z`
        : googleEvent.start.dateTime!,
      endTime: isAllDay
        ? `${googleEvent.end.date}T00:00:00.000Z`
        : googleEvent.end.dateTime!,
    };
  }

  static get defaultResourceId(): string {
    return GoogleEventMapper.DEFAULT_RESOURCE_ID;
  }
}
