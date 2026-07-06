import { createStore } from "zustand/vanilla";
import { Event } from "../models/events/event";
import { Resource, type ResourceData } from "../models/resources/resources";
import {
  Assignment,
  type AssignmentData,
} from "../models/assignments/assignments";
import type { EventData } from "../types/event.types";
import { getBrowserTimezone } from "../utils/time";

export interface EventDraft {
  id: string | null;
  title: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  participants: string[];
  description: string;
  activeColor: string;
  timezone: string;
}

export interface SchedulerState {
  events: Record<string, Event>;
  resources: Record<string, Resource>;
  assignments: Record<string, Assignment>;
  /** IANA timezone string used for all display conversions. Defaults to the browser's local timezone. */
  timezone: string;
  eventDraft: EventDraft | null;
}

export interface SchedulerActions {
  addEvent: (data: EventData) => Event;
  updateEvent: (id: string, updates: Partial<EventData>) => Event;
  deleteEvent: (id: string) => boolean;
  addResource: (data: ResourceData) => Resource;
  updateResource: (id: string, updates: Partial<ResourceData>) => Resource;
  deleteResource: (id: string) => boolean;
  addAssignment: (data: AssignmentData) => Assignment;
  deleteAssignment: (id: string) => boolean;
  clearAll: () => void;
  /** Change the display timezone for all scheduler components. */
  setTimezone: (timezone: string) => void;
  startDraft: (id: string | null, defaults: Partial<EventDraft>) => void;
  updateDraft: (updates: Partial<EventDraft>) => void;
  clearDraft: (clearLocalStorage?: boolean) => void;
}

export type SchedulerStore = SchedulerState & SchedulerActions;

const DRAFT_KEY = "janus-scheduler:new-event-draft";

const isBrowser =
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const loadDraftFromLocalStorage = (): Partial<EventDraft> | null => {
  if (!isBrowser) return null;
  try {
    const val = localStorage.getItem(DRAFT_KEY);
    return val ? JSON.parse(val) : null;
  } catch (e) {
    console.error("Failed to load draft from local storage", e);
    return null;
  }
};

const saveDraftToLocalStorage = (draft: EventDraft) => {
  if (!isBrowser) return;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (e) {
    console.error(e);
  }
};

const clearDraftFromLocalStorage = () => {
  if (!isBrowser) return;
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (e) {
    console.error(e);
  }
};

export const schedulerStore = createStore<SchedulerStore>((set, get) => ({
  events: {},
  resources: {},
  assignments: {},
  timezone: getBrowserTimezone(),
  eventDraft: null,

  addEvent: (data) => {
    const event = new Event(data);
    if (!event.isValid()) throw new Error("Invalid event data");

    set((state) => ({
      events: { ...state.events, [event.id]: event },
    }));
    return event;
  },

  updateEvent: (id, updates) => {
    const state = get();
    const event = state.events[id];
    if (!event) throw new Error(`Event ${id} not found`);

    let resourceIds = event.resourceIds;
    let resourceId = event.resourceId;

    if (updates.resourceIds) {
      resourceIds = updates.resourceIds;
      resourceId = updates.resourceIds[0] || "";
    } else if (
      updates.resourceId !== undefined &&
      updates.resourceId !== null
    ) {
      resourceId = updates.resourceId;
      resourceIds = updates.resourceId ? [updates.resourceId] : [];
    }

    const updatedEvent = new Event({
      id: event.id,
      title:
        updates.title !== undefined && updates.title.trim() !== ""
          ? updates.title
          : event.title,
      startTime:
        updates.startTime !== undefined && updates.startTime.trim() !== ""
          ? updates.startTime
          : event.startTime,
      endTime:
        updates.endTime !== undefined && updates.endTime.trim() !== ""
          ? updates.endTime
          : event.endTime,
      resourceIds,
      resourceId,
      status: updates.status !== undefined ? updates.status : event.status,
      description:
        updates.description !== undefined
          ? updates.description
          : event.description,
    });

    set((state) => ({
      events: { ...state.events, [id]: updatedEvent },
    }));
    return updatedEvent;
  },

  deleteEvent: (id) => {
    let deleted = false;
    set((state) => {
      if (state.events[id]) {
        const newEvents = { ...state.events };
        delete newEvents[id];
        deleted = true;
        return { events: newEvents };
      }
      return state;
    });
    return deleted;
  },

  addResource: (data) => {
    const resource = new Resource(data);
    if (!resource.isValid()) throw new Error("Invalid resource data");

    set((state) => ({
      resources: { ...state.resources, [resource.id]: resource },
    }));
    return resource;
  },

  updateResource: (id, updates) => {
    const state = get();
    const resource = state.resources[id];
    if (!resource) throw new Error(`Resource ${id} not found`);

    const updatedResource = new Resource({
      id: resource.id,
      name:
        updates.name !== undefined && updates.name.trim() !== ""
          ? updates.name
          : resource.name,
      type: updates.type !== undefined ? updates.type : resource.type,
      email: updates.email !== undefined ? updates.email : resource.email,
    });

    set((state) => ({
      resources: { ...state.resources, [id]: updatedResource },
    }));
    return updatedResource;
  },

  deleteResource: (id) => {
    const state = get();
    // Check if resource has events
    const hasEvents = Object.values(state.events).some(
      (e) =>
        (e.resourceIds && e.resourceIds.includes(id)) || e.resourceId === id,
    );
    if (hasEvents) {
      throw new Error(`Cannot delete resource ${id} - has assigned events`);
    }

    let deleted = false;
    set((state) => {
      if (state.resources[id]) {
        const newResources = { ...state.resources };
        delete newResources[id];
        deleted = true;
        return { resources: newResources };
      }
      return state;
    });
    return deleted;
  },

  addAssignment: (data) => {
    const state = get();
    const assignment = new Assignment(data);
    if (!assignment.isValid()) throw new Error("Invalid assignment data");

    if (!state.events[assignment.eventId]) {
      throw new Error(`Event ${assignment.eventId} not found`);
    }
    if (!state.resources[assignment.resourceId]) {
      throw new Error(`Resource ${assignment.resourceId} not found`);
    }

    set((state) => ({
      assignments: { ...state.assignments, [assignment.id]: assignment },
    }));
    return assignment;
  },

  deleteAssignment: (id) => {
    let deleted = false;
    set((state) => {
      if (state.assignments[id]) {
        const newAssignments = { ...state.assignments };
        delete newAssignments[id];
        deleted = true;
        return { assignments: newAssignments };
      }
      return state;
    });
    return deleted;
  },

  clearAll: () => {
    set({
      events: {},
      resources: {},
      assignments: {},
    });
  },

  setTimezone: (timezone) => {
    set({ timezone });
  },

  startDraft: (id, defaults) => {
    let initialDraft: EventDraft = {
      id,
      title: defaults.title ?? "",
      startDate: defaults.startDate ?? "",
      startTime: defaults.startTime ?? "",
      endDate: defaults.endDate ?? "",
      endTime: defaults.endTime ?? "",
      participants: defaults.participants ?? [],
      description: defaults.description ?? "",
      activeColor: defaults.activeColor ?? "orange",
      timezone: defaults.timezone ?? get().timezone,
    };

    if (id === null) {
      const saved = loadDraftFromLocalStorage();
      if (saved) {
        initialDraft = {
          ...initialDraft,
          ...saved,
          id: null,
        };
      }
    }

    set({ eventDraft: initialDraft });
  },

  updateDraft: (updates) => {
    const { eventDraft } = get();
    if (!eventDraft) return;

    const updated = { ...eventDraft, ...updates };
    set({ eventDraft: updated });

    if (updated.id === null) {
      saveDraftToLocalStorage(updated);
    }
  },

  clearDraft: (clearLocalStorage = false) => {
    const { eventDraft } = get();
    if (eventDraft && eventDraft.id === null && clearLocalStorage) {
      clearDraftFromLocalStorage();
    }
    set({ eventDraft: null });
  },
}));
