import { Event } from "../models/events/event";
import { EventData } from "../types/event.types";
import { expandEvents } from "./recurrence";
import { isoToZonedDisplay, zonedInputToISO } from "./time";

export interface ConflictEvent {
  id: string;
  title: string;
  startMs: number;
  endMs: number;
  startTime: string;
  endTime: string;
}

export interface ConflictResource {
  id: string;
  name: string;
  events: ConflictEvent[];
}

/**
 * Perform an O(N log N) sorting sweep to find all overlapping events on each resource.
 * Returns timezone-aware overlap warning messages and the set of conflicting event IDs.
 */
export function computeTimelineConflicts(
  resources: ConflictResource[],
  timezone: string,
): {
  hasConflict: boolean;
  messages: string[];
  conflictingEventIds: Set<string>;
} {
  const conflictingEventIds = new Set<string>();
  const messages: string[] = [];

  for (const r of resources) {
    // 1. Sort events chronologically by start time
    const sorted = [...r.events].sort((a, b) => a.startMs - b.startMs);

    // 2. Single-pass linear overlap check
    for (let i = 0; i < sorted.length; i++) {
      const evA = sorted[i];
      for (let j = i + 1; j < sorted.length; j++) {
        const evB = sorted[j];

        // Since sorted, if evB starts after evA ends, no future events can overlap with evA
        if (evB.startMs >= evA.endMs) {
          break;
        }

        // Overlap detected!
        conflictingEventIds.add(evA.id);
        conflictingEventIds.add(evB.id);

        const overlapStartMs = Math.max(evA.startMs, evB.startMs);
        const overlapEndMs = Math.min(evA.endMs, evB.endMs);
        const { dateLabel, startTimeLabel, endTimeLabel } = formatZonedOverlap(
          new Date(overlapStartMs).toISOString(),
          new Date(overlapEndMs).toISOString(),
          timezone,
        );

        const msg = `Conflict: ${r.name} has overlapping events "${evA.title}" and "${evB.title}" on ${dateLabel} between ${startTimeLabel} and ${endTimeLabel}.`;
        if (!messages.includes(msg)) {
          messages.push(msg);
        }
      }
    }
  }

  return {
    hasConflict: conflictingEventIds.size > 0,
    messages,
    conflictingEventIds,
  };
}

/**
 * Checks if a single start/end time range overlaps with existing events on a resource.
 */
export function checkSlotConflict(
  events: ConflictEvent[],
  startMs: number,
  endMs: number,
  ignoreEventId?: string,
): boolean {
  const ignoreBaseId = ignoreEventId
    ? ignoreEventId.replace(/_occ_\d+$/, "")
    : null;
  for (const ev of events) {
    if (ignoreBaseId && ev.id.replace(/_occ_\d+$/, "") === ignoreBaseId)
      continue;
    if (startMs < ev.endMs && endMs > ev.startMs) {
      return true;
    }
  }
  return false;
}

/**
 * Validate conflicts for a recurring/single event draft.
 */
export function checkDraftConflict(
  draft: {
    id: string | null;
    title: string;
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    participants: string[];
    allDay?: boolean;
    recurrenceRule?: string;
  },
  existingEvents: Event[],
  timezone: string,
): { hasConflict: boolean; message: string; resourceIds: string[] } {
  if (!draft.title || draft.participants.length === 0) {
    return { hasConflict: false, message: "", resourceIds: [] };
  }

  // Parse startRange & endRange timezone-safely
  const startRange = new Date(draft.startDate + "T00:00:00").getTime();
  let endRange = new Date(draft.endDate + "T23:59:59").getTime();

  // Address PR Review 1: Extend checking window for recurring rules
  if (draft.recurrenceRule) {
    let maxRecurrenceEnd = startRange + 365 * 24 * 60 * 60 * 1000; // 1 year window default
    const untilMatch = draft.recurrenceRule.match(/UNTIL=([0-9T]+)/);
    if (untilMatch) {
      const untilStr = untilMatch[1];
      const y = untilStr.slice(0, 4);
      const m = untilStr.slice(4, 6);
      const d = untilStr.slice(6, 8);
      const untilMs = new Date(`${y}-${m}-${d}T23:59:59`).getTime();
      if (!isNaN(untilMs)) {
        maxRecurrenceEnd = untilMs;
      }
    }
    endRange = maxRecurrenceEnd;
  }

  let draftOccurrences: EventData[];
  try {
    const draftStartIso = zonedInputToISO(
      draft.startDate,
      draft.startTime,
      timezone,
    );
    const draftEndIso = zonedInputToISO(draft.endDate, draft.endTime, timezone);

    const tempEvent = new Event({
      id: "draft",
      title: draft.title,
      startTime: draftStartIso,
      endTime: draftEndIso,
      resourceIds: draft.participants,
      allDay: draft.allDay,
      recurrenceRule: draft.recurrenceRule,
    });
    draftOccurrences = expandEvents([tempEvent], startRange, endRange);
  } catch {
    return { hasConflict: false, message: "", resourceIds: [] };
  }

  if (draftOccurrences.length === 0) {
    return { hasConflict: false, message: "", resourceIds: [] };
  }

  // Safe suffix stripping for base ID
  const baseEventId = draft.id ? draft.id.replace(/_occ_\d+$/, "") : null;

  const filteredEvents = existingEvents.filter(
    (e) => e.id.replace(/_occ_\d+$/, "") !== baseEventId,
  );

  const existingOccurrences = expandEvents(
    filteredEvents,
    startRange,
    endRange,
  );

  for (const dOcc of draftOccurrences) {
    const dStart = new Date(dOcc.startTime).getTime();
    const dEnd = new Date(dOcc.endTime).getTime();

    for (const eOcc of existingOccurrences) {
      const eStart = new Date(eOcc.startTime).getTime();
      const eEnd = new Date(eOcc.endTime).getTime();

      if (dStart < eEnd && dEnd > eStart) {
        const dResources =
          dOcc.resourceIds || (dOcc.resourceId ? [dOcc.resourceId] : []);
        const eResources =
          eOcc.resourceIds || (eOcc.resourceId ? [eOcc.resourceId] : []);
        const conflictingResources = dResources.filter((resId: string) =>
          eResources.includes(resId),
        );

        if (conflictingResources.length > 0) {
          const { dateLabel, startTimeLabel, endTimeLabel } =
            formatZonedOverlap(eOcc.startTime, eOcc.endTime, timezone);

          return {
            hasConflict: true,
            message: `Conflict: [REPLACE_RESOURCES] already scheduled on ${dateLabel} between ${startTimeLabel} and ${endTimeLabel} in "${eOcc.title}".`,
            resourceIds: conflictingResources,
          };
        }
      }
    }
  }

  return { hasConflict: false, message: "", resourceIds: [] };
}

function formatZonedOverlap(
  startIso: string,
  endIso: string,
  timezone: string,
): { dateLabel: string; startTimeLabel: string; endTimeLabel: string } {
  const { date: zonedDate, time: zonedStartTime } = isoToZonedDisplay(
    startIso,
    timezone,
  );
  const { time: zonedEndTime } = isoToZonedDisplay(endIso, timezone);

  const [, monthStr, dayStr] = zonedDate.split("-");
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const monthIdx = parseInt(monthStr, 10) - 1;
  const dateLabel =
    monthIdx >= 0 && monthIdx < 12
      ? `${monthNames[monthIdx]} ${parseInt(dayStr, 10)}`
      : zonedDate;

  const formatTimeStr = (t: string) => {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  };

  return {
    dateLabel,
    startTimeLabel: formatTimeStr(zonedStartTime),
    endTimeLabel: formatTimeStr(zonedEndTime),
  };
}
