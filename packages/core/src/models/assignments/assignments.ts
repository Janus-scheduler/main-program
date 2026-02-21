export interface AssignmentData {
  id: string;
  eventId: string;
  resourceId: string;
  role?: "organizer" | "attendee";
}

export class Assignment {
  id: string;
  eventId: string;
  resourceId: string;
  role: "organizer" | "attendee";

  constructor(data: AssignmentData) {
    this.id = data.id;
    this.eventId = data.eventId;
    this.resourceId = data.resourceId;
    this.role = data.role || "attendee";
  }

  // Check if assignment data is valid
  isValid(): boolean {
    return !!(this.id && this.eventId && this.resourceId);
  }
}

// chathura test
