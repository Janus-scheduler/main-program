import { Component, ViewEncapsulation, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { SchedulerComponent, TimelineComponent } from '@janus-scheduler/angular';
import type {
  TimelineEvent,
  SchedulerSaveData,
  EventMoveDetail,
  EventResizeDetail,
  EventCreateDetail,
} from '@janus-scheduler/angular';
import { SchedulerManager } from '@janus-scheduler/core';
import { SAMPLE } from '@janus-scheduler/ui';
import type { TimelineResource } from '@janus-scheduler/ui';

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
  resources: TimelineResource[] = JSON.parse(JSON.stringify(SAMPLE));
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
        startTime: `${data.date}T${data.startTime}:00Z`,
        endTime: `${data.date}T${data.endTime}:00Z`,
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

  handleDelete(data: { title: string }): void {
    console.log('Delete requested for:', data.title);
    // Logic for deletion if we had an ID
    this.showScheduler = false;
  }

  closeScheduler(): void {
    this.showScheduler = false;
  }

  handleEventMove(data: EventMoveDetail): void {
    const { event, oldResourceId, newResourceId, newStartTime, newEndTime } = data;
    console.log('📦 Event moved:', data);

    const next = [...this.resources];

    // Remove from old resource
    const oldResIndex = next.findIndex((r) => r.id === oldResourceId);
    if (oldResIndex === -1) return;

    const oldRes = { ...next[oldResIndex], events: [...next[oldResIndex].events] };
    const eventIndex = oldRes.events.findIndex((ev) => ev.id === event.id);

    if (eventIndex === -1) return;

    const movedEvent = { ...oldRes.events[eventIndex] };
    oldRes.events.splice(eventIndex, 1);
    next[oldResIndex] = oldRes;

    // Update event times
    movedEvent.startTime = newStartTime;
    movedEvent.endTime = newEndTime;

    // Add to new resource
    const newResIndex = next.findIndex((r) => r.id === newResourceId);
    if (newResIndex !== -1) {
      const newRes = { ...next[newResIndex] };
      newRes.events = [...newRes.events, movedEvent];
      next[newResIndex] = newRes;
    }

    this.resources = next;
  }

  handleEventResize(data: EventResizeDetail): void {
    const { event, resourceId, newStartTime, newEndTime } = data;
    console.log('↔️ Event resized:', data);

    const next = [...this.resources];
    const resIndex = next.findIndex((r) => r.id === resourceId);
    if (resIndex === -1) return;

    const res = { ...next[resIndex] };
    const eventIndex = res.events.findIndex((ev) => ev.id === event.id);

    if (eventIndex !== -1) {
      res.events = [...res.events];
      res.events[eventIndex] = {
        ...res.events[eventIndex],
        startTime: newStartTime,
        endTime: newEndTime,
      };
      next[resIndex] = res;
    }

    this.resources = next;
  }

  handleEventCreate(data: EventCreateDetail): void {
    const { resourceId, startTime, endTime, date } = data;
    console.log('✨ New event created:', data);

    const next = [...this.resources];
    const resIndex = next.findIndex((r) => r.id === resourceId);
    if (resIndex === -1) return;

    const res = { ...next[resIndex] };

    const newEvent = {
      id: `evt_${Date.now()}`,
      title: 'New Event',
      startTime,
      endTime,
      color: 'blue' as const,
      date,
    };

    res.events = [...res.events, newEvent];
    next[resIndex] = res;

    this.resources = next;
  }
}
