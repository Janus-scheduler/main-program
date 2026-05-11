import { Component, ViewEncapsulation, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import {
  SchedulerComponent,
  TimelineComponent,
  type TimelineEvent,
  type TimelineResource,
  type SchedulerSaveData,
  type EventMoveDetail,
  type EventResizeDetail,
  type EventCreateDetail,
} from '@janus-scheduler/angular';
import { SchedulerManager } from '@janus-scheduler/core';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SchedulerComponent, TimelineComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './app.html',
  styleUrl: './app.css',
  encapsulation: ViewEncapsulation.None,
})
export class App {
  showScheduler = false;
  schedulerError: string | null = null;
  resources: TimelineResource[] = [];
  private manager = new SchedulerManager();

  handleAddEvent(): void {
    this.schedulerError = null;
    this.showScheduler = true;
  }

  handleEventClick(event: TimelineEvent): void {
    console.log('Clicked event:', event);
    this.schedulerError = null;
    this.showScheduler = true;
  }

  handleSave(data: SchedulerSaveData): void {
    console.log('Saving event with data:', data);

    try {
      // Data Processing: Transform UI data into core EventData format
      const eventData = {
        id: `evt_${Date.now()}`,
        title: data.title,
        startTime: `${data.startDate}T${data.startTime}:00Z`,
        endTime: `${data.endDate}T${data.endTime}:00Z`,
        resourceId: data.participants[0] || 'unassigned',
        description: data.description,
        status: 'confirmed' as const,
      };

      // Core Processing: Use the SchedulerManager to add the event
      this.manager.addEvent(eventData);

      console.log('✅ Event successfully added to core manager');
      this.showScheduler = false;
      this.schedulerError = null;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to save event:', error);
      this.schedulerError = error.message || 'An unexpected error occurred';
    }
  }

  handleDelete(data: { id: string | null; title: string }): void {
    console.log('Delete requested for:', data.title);
    if (data.id) {
      this.manager.deleteEvent(data.id);
    }
    this.showScheduler = false;
  }

  closeScheduler(): void {
    this.showScheduler = false;
  }

  handleEventMove(data: EventMoveDetail): void {
    const { event, newResourceId, newStartTime, newEndTime } = data;
    console.log('📦 Event moved:', data);
    const today = event.date || new Date().toISOString().split('T')[0];

    this.manager.updateEvent(event.id, {
      resourceId: newResourceId,
      startTime: `${today}T${newStartTime}:00Z`,
      endTime: `${today}T${newEndTime}:00Z`,
    });
  }

  handleEventResize(data: EventResizeDetail): void {
    const { event, newStartTime, newEndTime } = data;
    console.log('↔️ Event resized:', data);
    const today = event.date || new Date().toISOString().split('T')[0];

    this.manager.updateEvent(event.id, {
      startTime: `${today}T${newStartTime}:00Z`,
      endTime: `${today}T${newEndTime}:00Z`,
    });
  }

  handleEventCreate(data: EventCreateDetail): void {
    const { resourceId, startTime, endTime, date } = data;
    console.log('✨ New event created:', data);
    const today = date || new Date().toISOString().split('T')[0];

    this.manager.addEvent({
      id: `evt_${Date.now()}`,
      title: 'New Event',
      startTime: `${today}T${startTime}:00Z`,
      endTime: `${today}T${endTime}:00Z`,
      resourceId,
      status: 'confirmed',
    });
  }
}
