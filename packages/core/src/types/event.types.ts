export interface EventData {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  resourceId: string;
  status?: "draft" | "confirmed" | "cancelled";
  description?: string;
}
