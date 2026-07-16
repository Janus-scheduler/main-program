import type { EventData } from "@janus-scheduler/core";
import type { GoogleCalendarEvent } from "../types/index.js";

export class GoogleEventMapper {
  private static readonly DEFAULT_RESOURCE_ID = "google-calendar";

  /**
   * Convert a Janus EventData → Google Calendar event format
   */
  toGoogle(event: EventData): GoogleCalendarEvent {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (event.allDay) {
      return {
        summary: event.title,
        description: event.description || "",
        start: { date: event.startTime.split("T")[0] },
        end: { date: event.endTime.split("T")[0] },
      };
    }

    return {
      summary: event.title,
      description: event.description || "",
      start: { dateTime: event.startTime, timeZone },
      end: { dateTime: event.endTime, timeZone },
    };
  }

  /**
   * Convert a Google Calendar event → Janus EventData shape.
   * Uses existingJanusId when updating a known event,
   * otherwise generates a stable id from the Google event id.
   */
  toJanus(
    googleEvent: GoogleCalendarEvent,
    existingJanusId?: string,
  ): EventData {
    const isAllDay = !googleEvent.start.dateTime;

    return {
      id: existingJanusId ?? `google-${googleEvent.id}`,
      title: googleEvent.summary || "Untitled",
      description: googleEvent.description || "",
      allDay: isAllDay,
      // resourceIds is required by Event.isValid() — assign default
      resourceId: GoogleEventMapper.DEFAULT_RESOURCE_ID,
      resourceIds: [GoogleEventMapper.DEFAULT_RESOURCE_ID],
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
