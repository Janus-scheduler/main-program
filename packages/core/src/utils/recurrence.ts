import { RRule } from "rrule";
import { Event } from "../models/events/event";
import { EventData } from "../types/event.types";

/**
 * Expands a list of events, producing virtual occurrence event records for any recurring event.
 * Non-recurring events are passed through unmodified.
 * For recurring events, the base event is omitted and replaced by occurrences within the specified range.
 */
export function expandEvents(
  events: Event[],
  startMs: number,
  endMs: number,
): EventData[] {
  const expanded: EventData[] = [];

  for (const event of events) {
    if (!event.recurrenceRule) {
      expanded.push({
        id: event.id,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        resourceId: event.resourceId,
        resourceIds: event.resourceIds,
        status: event.status,
        description: event.description,
        color: event.color,
        allDay: event.allDay,
      });
      continue;
    }

    try {
      const startRange = new Date(startMs);
      const endRange = new Date(endMs);

      // Parse base options from string
      const ruleOptions = RRule.parseString(event.recurrenceRule);
      // Force the rule's dtstart to match the base event's start time in local/UTC Date
      ruleOptions.dtstart = new Date(event.startTime);

      const rule = new RRule(ruleOptions);
      // Retrieve occurrences falling in the viewport range (inclusive)
      const occurrences = rule.between(startRange, endRange, true);

      const durationMs =
        new Date(event.endTime).getTime() - new Date(event.startTime).getTime();

      for (const occDate of occurrences) {
        const occStartMs = occDate.getTime();
        const occEndMs = occStartMs + durationMs;

        expanded.push({
          id: `${event.id}_occ_${occStartMs}`,
          title: event.title,
          startTime: new Date(occStartMs).toISOString(),
          endTime: new Date(occEndMs).toISOString(),
          resourceId: event.resourceId,
          resourceIds: event.resourceIds,
          status: event.status,
          description: event.description,
          color: event.color,
          allDay: event.allDay,
          recurrenceRule: event.recurrenceRule,
        });
      }
    } catch (e) {
      console.error(
        `Failed to expand recurrence rule for event ${event.id}:`,
        e,
      );
      // Fallback: render the original base event if rule parsing or generation fails
      expanded.push({
        id: event.id,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        resourceId: event.resourceId,
        resourceIds: event.resourceIds,
        status: event.status,
        description: event.description,
        color: event.color,
        allDay: event.allDay,
      });
    }
  }

  return expanded;
}
