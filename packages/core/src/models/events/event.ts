
export interface EventData {
  id: string;
  title: string;
  startTime: string; // "2025-02-18T14:00:00Z"
  endTime: string;
  resourceId: string;
  status?: 'draft' | 'confirmed' | 'cancelled';
  description?: string;
}

export class Event {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  resourceId: string;
  status: 'draft' | 'confirmed' | 'cancelled';
  description: string;

  constructor(data: EventData) {
    this.id = data.id;
    this.title = data.title;
    this.startTime = data.startTime;
    this.endTime = data.endTime;
    this.resourceId = data.resourceId;
    this.status = data.status || 'draft';
    this.description = data.description || '';
  }

  // Check if event data is valid
  isValid(): boolean {
    if (!this.id || !this.title || !this.resourceId) return false;
    
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
