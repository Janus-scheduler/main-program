import { Event } from "../models/events/event";
import { Resource, ResourceData } from "../models/resources/resources";
import { Assignment, AssignmentData } from "../models/assignments/assignments";
import { EventData } from "../types/event.types";
import { schedulerStore } from "../store/scheduler.store";

/**
 * Main scheduler manager class
 * Handles all CRUD operations for events, resources, and assignments
 * Now powered by Zustand vanilla store for reactivity!
 */
export class SchedulerManager {
  // ============ EVENT FUNCTIONS ============

  /**
   * Add a new event
   * @param data - Event data
   * @returns Created event
   */
  addEvent(data: EventData): Event {
    const event = schedulerStore.getState().addEvent(data);
    console.log(`Event added: ${event.title}`);
    return event;
  }

  /**
   * Get an event by ID
   * @param id - Event ID
   * @returns Event if found, undefined otherwise
   */
  getEvent(id: string): Event | undefined {
    return schedulerStore.getState().events[id];
  }

  /**
   * Get all events
   * @returns Array of all events
   */
  getAllEvents(): Event[] {
    return Object.values(schedulerStore.getState().events);
  }

  /**
   * Update an event
   * @param id - Event ID
   * @param updates - Partial event data to update
   * @returns Updated event
   */
  updateEvent(id: string, updates: Partial<EventData>): Event {
    const event = schedulerStore.getState().updateEvent(id, updates);
    console.log(`✅ Event updated: ${event.title}`);
    return event;
  }

  /**
   * Delete an event
   * @param id - Event ID
   * @returns true if deleted, false if not found
   */
  deleteEvent(id: string): boolean {
    const deleted = schedulerStore.getState().deleteEvent(id);
    if (deleted) {
      console.log(`Event deleted: ${id}`);
    } else {
      console.log(`Event not found: ${id}`);
    }
    return deleted;
  }

  /**
   * Get events for a specific resource
   * @param resourceId - Resource ID
   * @returns Array of events for the resource
   */
  getEventsByResource(resourceId: string): Event[] {
    return this.getAllEvents().filter((e) => e.resourceId === resourceId);
  }

  /**
   * Get events for a specific date
   * @param date - Date string (YYYY-MM-DD)
   * @returns Array of events on that date
   */
  getEventsByDate(date: string): Event[] {
    const targetDate = new Date(date).toISOString().split("T")[0];
    return this.getAllEvents().filter((event) => {
      const eventDate = new Date(event.startTime).toISOString().split("T")[0];
      return eventDate === targetDate;
    });
  }

  // ============ RESOURCE FUNCTIONS ============

  /**
   * Add a new resource
   * @param data - Resource data
   * @returns Created resource
   */
  addResource(data: ResourceData): Resource {
    const resource = schedulerStore.getState().addResource(data);
    console.log(`Resource added: ${resource.name}`);
    return resource;
  }

  /**
   * Get a resource by ID
   * @param id - Resource ID
   * @returns Resource if found, undefined otherwise
   */
  getResource(id: string): Resource | undefined {
    return schedulerStore.getState().resources[id];
  }

  /**
   * Get all resources
   * @returns Array of all resources
   */
  getAllResources(): Resource[] {
    return Object.values(schedulerStore.getState().resources);
  }

  /**
   * Update a resource
   * @param id - Resource ID
   * @param updates - Partial resource data to update
   * @returns Updated resource
   */
  updateResource(id: string, updates: Partial<ResourceData>): Resource {
    const resource = schedulerStore.getState().updateResource(id, updates);
    console.log(`Resource updated: ${resource.name}`);
    return resource;
  }

  /**
   * Delete a resource
   * @param id - Resource ID
   * @returns true if deleted
   */
  deleteResource(id: string): boolean {
    const deleted = schedulerStore.getState().deleteResource(id);
    if (deleted) {
      console.log(`Resource deleted: ${id}`);
    }
    return deleted;
  }

  // ============ ASSIGNMENT FUNCTIONS ============

  /**
   * Add a new assignment (link event to resource)
   * @param data - Assignment data
   * @returns Created assignment
   */
  addAssignment(data: AssignmentData): Assignment {
    const assignment = schedulerStore.getState().addAssignment(data);
    console.log(`Assignment created: ${assignment.id}`);
    return assignment;
  }

  /**
   * Get all assignments for an event
   * @param eventId - Event ID
   * @returns Array of assignments
   */
  getAssignmentsByEvent(eventId: string): Assignment[] {
    return Object.values(schedulerStore.getState().assignments).filter(
      (a) => a.eventId === eventId,
    );
  }

  /**
   * Get all assignments for a resource
   * @param resourceId - Resource ID
   * @returns Array of assignments
   */
  getAssignmentsByResource(resourceId: string): Assignment[] {
    return Object.values(schedulerStore.getState().assignments).filter(
      (a) => a.resourceId === resourceId,
    );
  }

  /**
   * Delete an assignment
   * @param id - Assignment ID
   * @returns true if deleted, false if not found
   */
  deleteAssignment(id: string): boolean {
    const deleted = schedulerStore.getState().deleteAssignment(id);
    if (deleted) {
      console.log(`Assignment deleted: ${id}`);
    }
    return deleted;
  }

  // ============ UTILITY FUNCTIONS ============

  /**
   * Get total count of events
   * @returns Number of events
   */
  getEventCount(): number {
    return Object.keys(schedulerStore.getState().events).length;
  }

  /**
   * Get total count of resources
   * @returns Number of resources
   */
  getResourceCount(): number {
    return Object.keys(schedulerStore.getState().resources).length;
  }

  /**
   * Clear all data
   */
  clearAll(): void {
    schedulerStore.getState().clearAll();
    console.log("All data cleared");
  }

  /**
   * Summary
   */
  printSummary(): void {
    console.log("\n=== SCHEDULER SUMMARY ===");
    console.log(`Events: ${this.getEventCount()}`);
    console.log(`Resources: ${this.getResourceCount()}`);
    console.log(
      `Assignments: ${Object.keys(schedulerStore.getState().assignments).length}`,
    );
    console.log("========================\n");
  }
}

// Export for use in other files
export default SchedulerManager;
