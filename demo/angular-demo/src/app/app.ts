import { Component, ViewEncapsulation, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { SchedulerComponent, TimelineComponent } from '@janus-scheduler/angular';
import type { TimelineEvent } from '@janus-scheduler/angular';

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

  handleAddEvent(): void {
    this.showScheduler = true;
  }

  handleEventClick(event: TimelineEvent): void {
    console.log('Clicked event:', event);
    this.showScheduler = true;
  }

  closeScheduler(): void {
    this.showScheduler = false;
  }
}
