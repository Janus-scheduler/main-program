import {
  Component,
  ViewEncapsulation,
  CUSTOM_ELEMENTS_SCHEMA,
  signal,
  computed,
} from '@angular/core';
import {
  SchedulerComponent,
  TimelineComponent,
  MonthGridComponent,
  type TimelineEvent,
  type SchedulerSaveData,
  type EventMoveDetail,
  type EventResizeDetail,
  type EventCreateDetail,
  type ViewType,
} from '@janus-scheduler/angular';
import { SchedulerManager } from '@janus-scheduler/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SchedulerComponent, TimelineComponent, MonthGridComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './app.html',
  styleUrl: './app.css',
  encapsulation: ViewEncapsulation.None,
})
export class App {
  currentView: ViewType = 'Month';
  showScheduler = false;
  selectedEventId = signal<string | null>(null);

  storeEvent = computed(() => {
    const id = this.selectedEventId();
    return id ? this.manager.getEvent(id) : null;
  });

  private splitISO(iso: string | undefined) {
    if (!iso) return { date: undefined, time: undefined };
    const clean = iso.replace('Z', '');
    const [datePart, timePart = ''] = clean.split('T');
    const time = timePart.slice(0, 5); // "HH:mm"
    return { date: datePart, time };
  }

  startParts = computed(() => this.splitISO(this.storeEvent()?.startTime));
  endParts = computed(() => this.splitISO(this.storeEvent()?.endTime));

  participants = computed(() => {
    const resId = this.storeEvent()?.resourceId;
    return resId ? [resId] : undefined;
  });

  allowCreate = signal(false);
  schedulerError = signal<string | null>(null);
  private manager = new SchedulerManager({
    onError: ({ operation, error }) => {
      console.error(`❌ Manager error [${operation}]:`, error);
      this.schedulerError.set((error as Error).message || 'An unexpected error occurred');
    },
  });

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    // Only seed if the store is empty to avoid duplicates on re-renders
    if (this.manager.getResourceCount() > 0) return;

    console.log('🌱 Seeding initial data to core manager...');

    // Same resources as React demo
    this.manager.addResource({ id: 'r1', name: 'Dr. Sarah Chen', type: 'person' });
    this.manager.addResource({ id: 'r2', name: 'Dr. Michael Ross', type: 'person' });
    this.manager.addResource({ id: 'r3', name: 'Operating Room 1', type: 'room' });
    this.manager.addResource({ id: 'r4', name: 'MRI Scanner A', type: 'equipment' });

    // Same events as React demo
    const today = new Date().toISOString().split('T')[0];

    this.manager.addEvent({
      id: 'e1',
      title: 'Appendectomy',
      startTime: `${today}T09:00:00Z`,
      endTime: `${today}T11:30:00Z`,
      resourceId: 'r1',
      status: 'confirmed',
    });

    this.manager.addEvent({
      id: 'e2',
      title: 'Pre-op Assessment',
      startTime: `${today}T13:00:00Z`,
      endTime: `${today}T14:00:00Z`,
      resourceId: 'r2',
      status: 'confirmed',
    });

    console.log('✅ Seeding complete');
  }

  handleAddEvent(): void {
    this.selectedEventId.set(null);
    this.schedulerError.set(null);
    this.showScheduler = true;
  }

  handleEventClick(event: TimelineEvent): void {
    console.log('Clicked event:', event);
    this.selectedEventId.set(event.id);
    this.schedulerError.set(null);
    this.showScheduler = true;
  }

  handleSave(data: SchedulerSaveData): void {
    console.log('Saving event with data:', data);

    try {
      const eventData = {
        id: data.id || `evt_${Date.now()}`,
        title: data.title,
        startTime: `${data.startDate}T${data.startTime}:00Z`,
        endTime: `${data.startDate}T${data.endTime}:00Z`,
        resourceId: data.participants[0] || 'unassigned',
        description: data.description,
        status: 'confirmed' as const,
      };

      if (data.id) {
        this.manager.updateEvent(data.id, eventData);
      } else {
        this.manager.addEvent(eventData);
      }

      this.showScheduler = false;
      this.selectedEventId.set(null);
      this.schedulerError.set(null);
    } catch {
      // Errors are also handled by the manager's onError hook
    }
  }

  handleDelete(data: { id?: string | null; title?: string }): void {
    if (data.id) {
      this.manager.deleteEvent(data.id);
    }
    this.showScheduler = false;
    this.selectedEventId.set(null);
  }

  closeScheduler(): void {
    this.showScheduler = false;
    this.selectedEventId.set(null);
  }

  handleViewChange(data: { view: 'Timeline' | 'Month' }): void {
    this.currentView = data.view;
  }

  toggleCreate(): void {
    this.allowCreate.set(!this.allowCreate());
  }

  handleEventMove(data: EventMoveDetail): void {
    console.log('📦 Moving event:', data);
    this.manager.updateEvent(data.event.id, {
      resourceId: data.newResourceId,
      startTime: data.newStartTime,
      endTime: data.newEndTime,
    });
  }

  handleEventResize(data: EventResizeDetail): void {
    console.log('↔️ Resizing event:', data);
    this.manager.updateEvent(data.event.id, {
      startTime: data.newStartTime,
      endTime: data.newEndTime,
    });
  }

  handleEventCreate(data: EventCreateDetail): void {
    console.log('✨ Creating new event:', data);
    this.manager.addEvent({
      id: `evt_${Date.now()}`,
      title: 'New Event',
      startTime: data.startTime,
      endTime: data.endTime,
      resourceId: data.resourceId,
      status: 'confirmed',
    });
  }
}
