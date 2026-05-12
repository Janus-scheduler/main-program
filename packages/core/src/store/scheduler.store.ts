import { createStore } from "zustand/vanilla";
import { Event } from "../models/events/event";
import { Resource, type ResourceData } from "../models/resources/resources";
import {
  Assignment,
  type AssignmentData,
} from "../models/assignments/assignments";
import type { EventData } from "../types/event.types";

export interface SchedulerState {
  events: Record<string, Event>;
  resources: Record<string, Resource>;
  assignments: Record<string, Assignment>;
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
}

export type SchedulerStore = SchedulerState & SchedulerActions;

export const schedulerStore = createStore<SchedulerStore>((set, get) => ({
  events: {},
  resources: {},
  assignments: {},

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

    if (updates.title) event.title = updates.title;
    if (updates.startTime) event.startTime = updates.startTime;
    if (updates.endTime) event.endTime = updates.endTime;
    if (updates.resourceId) event.resourceId = updates.resourceId;
    if (updates.status) event.status = updates.status;
    if (updates.description !== undefined)
      event.description = updates.description;

    // To ensure reactivity in zustand, we create a new object reference for the events record.
    set((state) => ({
      events: { ...state.events, [id]: event },
    }));
    return event;
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

    if (updates.name) resource.name = updates.name;
    if (updates.type) resource.type = updates.type;
    if (updates.email !== undefined) resource.email = updates.email;

    set((state) => ({
      resources: { ...state.resources, [id]: resource },
    }));
    return resource;
  },

  deleteResource: (id) => {
    const state = get();
    // Check if resource has events
    const hasEvents = Object.values(state.events).some(
      (e) => e.resourceId === id,
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
}));
