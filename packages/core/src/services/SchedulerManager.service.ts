import { Event } from "../models/events/event";
import { Resource, ResourceData } from "../models/resources/resources";
import { Assignment, AssignmentData } from "../models/assignments/assignments";
import { EventData } from "../types/event.types";

/**
 * Main scheduler manager class
 * Handles all CRUD operations for events, resources, and assignments
 */
export class SchedulerManager {
  private events: Map<string, Event> = new Map();
  private resources: Map<string, Resource> = new Map();
  private assignments: Map<string, Assignment> = new Map();

  // ============ EVENT FUNCTIONS ============

  /**
   * Add a new event
   * @param data - Event data
   * @returns Created event
   * @throws Error if event data is invalid
   * @example
   * manager.addEvent({
   *   id: 'evt_001',
   *   title: 'Team Meeting',
   *   startTime: '2025-02-18T14:00:00Z',
   *   endTime: '2025-02-18T15:00:00Z',
   *   resourceId: 'res_001'
   * });
   */
  addEvent(data: EventData): Event {
    const event = new Event(data);
    if (!event.isValid()) {
      throw new Error("Invalid event data");
    }

    this.events.set(event.id, event);
    console.log(`Event added: ${event.title}`);
    return event;
  }

  /**
   * Get an event by ID
   * @param id - Event ID
   * @returns Event if found, undefined otherwise
   */
  getEvent(id: string): Event | undefined {
    return this.events.get(id);
  }

  /**
   * Get all events
   * @returns Array of all events
   */
  getAllEvents(): Event[] {
    return Array.from(this.events.values());
  }

  /**
   * Update an event
   * @param id - Event ID
   * @param updates - Partial event data to update
   * @returns Updated event
   * @throws Error if event not found
   * @example
   * manager.updateEvent('evt_001', { title: 'Updated Meeting' });
   */
  updateEvent(id: string, updates: Partial<EventData>): Event {
    const event = this.events.get(id);
    if (!event) {
      throw new Error(`Event ${id} not found`);
    }

    // Update only provided fields
    if (updates.title) {
      event.title = updates.title;
    }
    if (updates.startTime) {
      event.startTime = updates.startTime;
    }
    if (updates.endTime) {
      event.endTime = updates.endTime;
    }
    if (updates.status) {
      event.status = updates.status;
    }
    if (updates.description !== undefined) {
      event.description = updates.description;
    }

    console.log(`✅ Event updated: ${event.title}`);
    return event;
  }

  /**
   * Delete an event
   * @param id - Event ID
   * @returns true if deleted, false if not found
   */
  deleteEvent(id: string): boolean {
    const deleted = this.events.delete(id);
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
   * @throws Error if resource data is invalid
   * @example
   * manager.addResource({
   *   id: 'res_001',
   *   name: 'Dr. Alice Smith',
   *   type: 'person',
   *   email: 'alice@example.com'
   * });
   */
  addResource(data: ResourceData): Resource {
    const resource = new Resource(data);
    if (!resource.isValid()) {
      throw new Error("Invalid resource data");
    }

    this.resources.set(resource.id, resource);
    console.log(`Resource added: ${resource.name}`);
    return resource;
  }

  /**
   * Get a resource by ID
   * @param id - Resource ID
   * @returns Resource if found, undefined otherwise
   */
  getResource(id: string): Resource | undefined {
    return this.resources.get(id);
  }

  /**
   * Get all resources
   * @returns Array of all resources
   */
  getAllResources(): Resource[] {
    return Array.from(this.resources.values());
  }

  /**
   * Update a resource
   * @param id - Resource ID
   * @param updates - Partial resource data to update
   * @returns Updated resource
   * @throws Error if resource not found
   */
  updateResource(id: string, updates: Partial<ResourceData>): Resource {
    const resource = this.resources.get(id);
    if (!resource) {
      throw new Error(`Resource ${id} not found`);
    }

    if (updates.name) {
      resource.name = updates.name;
    }
    if (updates.type) {
      resource.type = updates.type;
    }
    if (updates.email !== undefined) {
      resource.email = updates.email;
    }

    console.log(`Resource updated: ${resource.name}`);
    return resource;
  }

  /**
   * Delete a resource
   * @param id - Resource ID
   * @returns true if deleted
   * @throws Error if resource has assigned events
   */
  deleteResource(id: string): boolean {
    // Check if resource has events
    const hasEvents = this.getEventsByResource(id).length > 0;
    if (hasEvents) {
      throw new Error(`Cannot delete resource ${id} - has assigned events`);
    }

    const deleted = this.resources.delete(id);
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
   * @throws Error if assignment data is invalid or references don't exist
   */
  addAssignment(data: AssignmentData): Assignment {
    const assignment = new Assignment(data);
    if (!assignment.isValid()) {
      throw new Error("Invalid assignment data");
    }

    // Check if event exists
    if (!this.events.has(assignment.eventId)) {
      throw new Error(`Event ${assignment.eventId} not found`);
    }

    // Check if resource exists
    if (!this.resources.has(assignment.resourceId)) {
      throw new Error(`Resource ${assignment.resourceId} not found`);
    }

    this.assignments.set(assignment.id, assignment);
    console.log(`Assignment created: ${assignment.id}`);
    return assignment;
  }

  /**
   * Get all assignments for an event
   * @param eventId - Event ID
   * @returns Array of assignments
   */
  getAssignmentsByEvent(eventId: string): Assignment[] {
    return Array.from(this.assignments.values()).filter(
      (a) => a.eventId === eventId,
    );
  }

  /**
   * Get all assignments for a resource
   * @param resourceId - Resource ID
   * @returns Array of assignments
   */
  getAssignmentsByResource(resourceId: string): Assignment[] {
    return Array.from(this.assignments.values()).filter(
      (a) => a.resourceId === resourceId,
    );
  }

  /**
   * Delete an assignment
   * @param id - Assignment ID
   * @returns true if deleted, false if not found
   */
  deleteAssignment(id: string): boolean {
    const deleted = this.assignments.delete(id);
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
    return this.events.size;
  }

  /**
   * Get total count of resources
   * @returns Number of resources
   */
  getResourceCount(): number {
    return this.resources.size;
  }

  /**
   * Clear all data
   */
  clearAll(): void {
    this.events.clear();
    this.resources.clear();
    this.assignments.clear();
    console.log("All data cleared");
  }

  /**
   * Summary
   */
  printSummary(): void {
    console.log("\n=== SCHEDULER SUMMARY ===");
    console.log(`Events: ${this.events.size}`);
    console.log(`Resources: ${this.resources.size}`);
    console.log(`Assignments: ${this.assignments.size}`);
    console.log("========================\n");
  }
}

// ========================================
// Example Usage
// ========================================

// Create manager
const manager = new SchedulerManager();

// Add resources
manager.addResource({
  id: "res_001",
  name: "Dr. Alice Smith",
  type: "person",
  email: "alice@example.com",
});

manager.addResource({
  id: "res_002",
  name: "Conference Room A",
  type: "room",
});

// Add events
manager.addEvent({
  id: "evt_001",
  title: "Team Meeting",
  startTime: "2025-02-18T14:00:00Z",
  endTime: "2025-02-18T15:00:00Z",
  resourceId: "res_001",
  description: "Weekly team sync",
});

manager.addEvent({
  id: "evt_002",
  title: "Client Presentation",
  startTime: "2025-02-18T16:00:00Z",
  endTime: "2025-02-18T17:00:00Z",
  resourceId: "res_002",
  status: "confirmed",
});

// View event
const event = manager.getEvent("evt_001");
console.log(`
  Event details: ${event?.title} - Duration: ${event?.getDuration()} minutes
  `);

// Update event
manager.updateEvent("evt_001", {
  title: "Updated Team Meeting",
  status: "confirmed",
});

// Get all events
console.log("\nAll events:");
manager.getAllEvents().forEach((e) => {
  console.log(`- ${e.title} (${e.status})`);
});

// Get events by resource
console.log("\nEvents for Dr. Alice:");
manager.getEventsByResource("res_001").forEach((e) => {
  console.log(`- ${e.title}`);
});

// Print summary
manager.printSummary();

// Export for use in other files
export default SchedulerManager;
