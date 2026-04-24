import { Component, ViewEncapsulation, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { SchedulerComponent, TimelineComponent } from '@janus-scheduler/angular';
import type { TimelineEvent, SchedulerSaveData } from '@janus-scheduler/angular';
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
}
