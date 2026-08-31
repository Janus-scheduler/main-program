import { EventData } from "../../types/event.types";

export class Event {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  resourceId: string;
  resourceIds: string[];
  status: "draft" | "confirmed" | "cancelled";
  description: string;
  color?: string;
  allDay?: boolean;
  recurrenceRule?: string;
  timezone?: string;

  constructor(data: EventData) {
    this.id = data.id;
    this.title = data.title;
    this.startTime = data.startTime;
    this.endTime = data.endTime;
    this.resourceIds =
      data.resourceIds && data.resourceIds.length > 0
        ? data.resourceIds
        : data.resourceId
          ? [data.resourceId]
          : [];
    this.resourceId = this.resourceIds[0] || data.resourceId || "";
    this.status = data.status || "draft";
    this.description = data.description || "";
    this.color = data.color;
    this.allDay = data.allDay;
    this.recurrenceRule = data.recurrenceRule;
    this.timezone = data.timezone;
  }

  // Check if event data is valid
  isValid(): boolean {
    if (!this.id || !this.title || this.resourceIds.length === 0) return false;
    const start = new Date(this.startTime);
    const end = new Date(this.endTime);
    if (start >= end) return false;
    return true;
  }

  // Get duration in minutes
  getDuration(): number {
    const start = new Date(this.startTime).getTime();
    const end = new Date(this.endTime).getTime();
    return (end - start) / (1000 * 60);
  }
}
