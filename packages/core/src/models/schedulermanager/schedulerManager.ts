import { EventData } from "../events/event";

export class SchedulerManager {
  private events: Map<string, Event> = new Map();
  private resources: Map<string, Resource> = new Map();
  private assignments: Map<string, Assignment> = new Map();

  // ============ EVENT FUNCTIONS ============

  /**
   * Add a new event
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
      throw new Error('Invalid event data');
    }

    this.events.set(event.id, event);
    console.log(`✅ Event added: ${event.title}`);
    return event;
  }

  /**
   * Get an event by ID
   */
  getEvent(id: string): Event | undefined {
    return this.events.get(id);
  }

  /**
   * Get all events
   */
  getAllEvents(): Event[] {
    return Array.from(this.events.values());
  }

  /**
   * Update an event
   * @example
   * manager.updateEvent('evt_001', { title: 'Updated Meeting' });
   */
  updateEvent(id: string, updates: Partial<EventData>): Event {
    const event = this.events.get(id);
    
    if (!event) {
      throw new Error(`Event ${id} not found`);
    }

    // Update only provided fields
    if (updates.title) event.title = updates.title;
    if (updates.startTime) event.startTime = updates.startTime;
    if (updates.endTime) event.endTime = updates.endTime;
    if (updates.status) event.status = updates.status;
    if (updates.description !== undefined) event.description = updates.description;

    console.log(`✅ Event updated: ${event.title}`);
    return event;
  }

  /**
   * Delete an event
   */
  deleteEvent(id: string): boolean {
    const deleted = this.events.delete(id);
    
    if (deleted) {
      console.log(`✅ Event deleted: ${id}`);
    } else {
      console.log(`❌ Event not found: ${id}`);
    }
    
    return deleted;
  }

  /**
   * Get events for a specific resource
   */
  getEventsByResource(resourceId: string): Event[] {
    return this.getAllEvents().filter(e => e.resourceId === resourceId);
  }

  /**
   * Get events for a specific date
   */
  getEventsByDate(date: string): Event[] {
    const targetDate = new Date(date).toISOString().split('T')[0];
    
    return this.getAllEvents().filter(event => {
      const eventDate = new Date(event.startTime).toISOString().split('T')[0];
      return eventDate === targetDate;
    });
  }

  // ============ RESOURCE FUNCTIONS ============

  /**
   * Add a new resource
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
      throw new Error('Invalid resource data');
    }

    this.resources.set(resource.id, resource);
    console.log(`✅ Resource added: ${resource.name}`);
    return resource;
  }

  /**
   * Get a resource by ID
   */
  getResource(id: string): Resource | undefined {
    return this.resources.get(id);
  }

  /**
   * Get all resources
   */
  getAllResources(): Resource[] {
    return Array.from(this.resources.values());
  }

  /**
   * Update a resource
   */
  updateResource(id: string, updates: Partial<ResourceData>): Resource {
    const resource = this.resources.get(id);
    
    if (!resource) {
      throw new Error(`Resource ${id} not found`);
    }

    if (updates.name) resource.name = updates.name;
    if (updates.type) resource.type = updates.type;
    if (updates.email !== undefined) resource.email = updates.email;

    console.log(`✅ Resource updated: ${resource.name}`);
    return resource;
  }

  /**
   * Delete a resource
   */
  deleteResource(id: string): boolean {
    // Check if resource has events
    const hasEvents = this.getEventsByResource(id).length > 0;
    
    if (hasEvents) {
      throw new Error(`Cannot delete resource ${id} - has assigned events`);
    }

    const deleted = this.resources.delete(id);
    
    if (deleted) {
      console.log(`✅ Resource deleted: ${id}`);
    }
    
    return deleted;
  }

  // ============ ASSIGNMENT FUNCTIONS ============

  /**
   * Add a new assignment (link event to resource)
   */
  addAssignment(data: AssignmentData): Assignment {
    const assignment = new Assignment(data);
    
    if (!assignment.isValid()) {
      throw new Error('Invalid assignment data');
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
    console.log(`✅ Assignment created`);
    return assignment;
  }

  /**
   * Get all assignments for an event
   */
  getAssignmentsByEvent(eventId: string): Assignment[] {
    return Array.from(this.assignments.values()).filter(a => a.eventId === eventId);
  }

  /**
   * Get all assignments for a resource
   */
  getAssignmentsByResource(resourceId: string): Assignment[] {
    return Array.from(this.assignments.values()).filter(a => a.resourceId === resourceId);
  }

  /**
   * Delete an assignment
   */
  deleteAssignment(id: string): boolean {
    return this.assignments.delete(id);
  }

  // ============ UTILITY FUNCTIONS ============

  /**
   * Get total count of events
   */
  getEventCount(): number {
    return this.events.size;
  }

  /**
   * Get total count of resources
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
    console.log('✅ All data cleared');
  }

  /**
   * Print summary
   */
  printSummary(): void {
    console.log('\n=== SCHEDULER SUMMARY ===');
    console.log(`Events: ${this.events.size}`);
    console.log(`Resources: ${this.resources.size}`);
    console.log(`Assignments: ${this.assignments.size}`);
    console.log('========================\n');
  }
}

// ========================================
// Example Usage
// ========================================

// Create manager
const manager = new SchedulerManager();

// Add resources
manager.addResource({
  id: 'res_001',
  name: 'Dr. Alice Smith',
  type: 'person',
  email: 'alice@example.com'
});

manager.addResource({
  id: 'res_002',
  name: 'Conference Room A',
  type: 'room'
});

// Add events
manager.addEvent({
  id: 'evt_001',
  title: 'Team Meeting',
  startTime: '2025-02-18T14:00:00Z',
  endTime: '2025-02-18T15:00:00Z',
  resourceId: 'res_001',
  description: 'Weekly team sync'
});

manager.addEvent({
  id: 'evt_002',
  title: 'Client Presentation',
  startTime: '2025-02-18T16:00:00Z',
  endTime: '2025-02-18T17:00:00Z',
  resourceId: 'res_002',
  status: 'confirmed'
});

// View event
const event = manager.getEvent('evt_001');
console.log('Event details:', event?.title, '- Duration:', event?.getDuration(), 'minutes');

// Update event
manager.updateEvent('evt_001', {
  title: 'Updated Team Meeting',
  status: 'confirmed'
});

// Get all events
console.log('\nAll events:');
manager.getAllEvents().forEach(e => {
  console.log(`- ${e.title} (${e.status})`);
});

// Get events by resource
console.log('\nEvents for Dr. Alice:');
manager.getEventsByResource('res_001').forEach(e => {
  console.log(`- ${e.title}`);
});

// Print summary
manager.printSummary();

// Export for use in other files
export { SchedulerManager };