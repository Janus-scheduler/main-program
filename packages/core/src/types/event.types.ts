export interface EventData {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  resourceId?: string;
  resourceIds?: string[];
  status?: "draft" | "confirmed" | "cancelled";
  description?: string;
  color?: string;
  allDay?: boolean;
  recurrenceRule?: string;
  timezone?: string;
}
