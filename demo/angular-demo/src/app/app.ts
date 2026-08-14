import {
  Component,
  ViewEncapsulation,
  CUSTOM_ELEMENTS_SCHEMA,
  signal,
  computed,
  viewChild,
  inject,
  effect,
} from '@angular/core';
import { NlpEngineService } from './chat/nlp-engine.service';
import { JanusChatService } from './chat/janus-chat.service';
import { catalogFromResources, commitSession } from './chat/commit-to-scheduler';
import type { SessionRequirements, SessionState, PresentMessage } from '@janus-scheduler/nlp';
import {
  SchedulerComponent,
  TimelineComponent,
  MonthGridComponent,
  TopbarComponent,
  ChatComponent,
  type TimelineEvent,
  type SchedulerSaveData,
  type EventMoveDetail,
  type EventResizeDetail,
  type EventCreateDetail,
  type ViewType,
  SchedulerManager,
  getBrowserTimezone,
  zonedInputToISO,
  isoToZonedDisplay,
  schedulerStore,
} from '@janus-scheduler/angular';

const INTRO: PresentMessage = {
  id: 'intro',
  role: 'assistant',
  kind: 'text',
  text: "Tell me what to schedule. I'll show you what I understood before anything is added.",
};

const REQUIRES: SessionRequirements = {
  add_event: ['when', 'resource'],
  modify_event: ['when'],
};

export interface NavData {
  navLabel: string;
  dayName: string;
  shortDate: string;
  zoomPercent: number;
  zoomUnit: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    SchedulerComponent,
    TimelineComponent,
    MonthGridComponent,
    TopbarComponent,
    ChatComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './app.html',
  styleUrl: './app.css',
  encapsulation: ViewEncapsulation.None,
})
export class App {
  currentView: ViewType = 'Month';
  showScheduler = false;
  selectedEventId = signal<string | null>(null);

  navData = signal<NavData>({
    navLabel: '',
    dayName: '',
    shortDate: '',
    zoomPercent: 100,
    zoomUnit: '',
  });

  timelineEl = viewChild<TimelineComponent>('timelineEl');
  monthGridEl = viewChild(MonthGridComponent);

  engineService = inject(NlpEngineService);
  chatService = inject(JanusChatService);

  storeEvent = computed(() => {
    const id = this.selectedEventId();
    return id ? this.manager.getEvent(id) : null;
  });

  // Convert a UTC ISO string → local { date, time } using the store's selected timezone.
  private splitISO(iso: string | undefined) {
    if (!iso) return { date: undefined, time: undefined };
    const { date, time } = isoToZonedDisplay(iso, schedulerStore.getState().timezone);
    return { date, time };
  }

  startParts = computed(() => this.splitISO(this.storeEvent()?.startTime));
  endParts = computed(() => this.splitISO(this.storeEvent()?.endTime));

  participants = computed(() => {
    return this.storeEvent()?.resourceIds;
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
    effect(() => {
      const state = this.engineService.state();
      const catalog = catalogFromResources(this.manager.getAllResources());
      const resources = this.manager.getAllResources();
      this.chatService.initialize({
        engine: state.status === 'ready' ? state.engine : null,
        catalog,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        intro: INTRO,
        requires: REQUIRES,
        fallbackResourceName: resources[0]?.name,
        onConfirm: (sessionState: SessionState) => {
          const res = this.manager.getAllResources();
          const result = commitSession(this.manager, sessionState, res[0]?.id);
          return result.ok
            ? { ok: true, message: result.summary, undo: result.undo }
            : { ok: false, message: result.message };
        },
      });
    });
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
    const tz = getBrowserTimezone();

    this.manager.addEvent({
      id: 'e1',
      title: 'Appendectomy',
      startTime: zonedInputToISO(today, '09:00', tz),
      endTime: zonedInputToISO(today, '11:30', tz),
      resourceIds: ['r1', 'r3'],
      status: 'confirmed',
    });

    this.manager.addEvent({
      id: 'e2',
      title: 'Pre-op Assessment',
      startTime: zonedInputToISO(today, '13:00', tz),
      endTime: zonedInputToISO(today, '14:00', tz),
      resourceIds: ['r2'],
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
        startTime: zonedInputToISO(data.startDate, data.startTime, data.timezone),
        endTime: zonedInputToISO(data.endDate, data.endTime, data.timezone),
        resourceIds: data.participants || ['r1'],
        description: data.description,
        status: 'confirmed' as const,
        color: data.activeColor,
        allDay: data.allDay,
        recurrenceRule: data.recurrenceRule,
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

  handleNavChange(detail: Partial<NavData>): void {
    this.navData.set({
      navLabel: detail.navLabel || '',
      dayName: detail.dayName || '',
      shortDate: detail.shortDate || '',
      zoomPercent: detail.zoomPercent || 100,
      zoomUnit: detail.zoomUnit || '',
    });
  }

  handlePrevClick(): void {
    if (this.currentView === 'Timeline') {
      this.timelineEl()?.goToPrev();
    } else {
      this.monthGridEl()?.goToPrev();
    }
  }

  handleNextClick(): void {
    if (this.currentView === 'Timeline') {
      this.timelineEl()?.goToNext();
    } else {
      this.monthGridEl()?.goToNext();
    }
  }

  handleTodayClick(): void {
    if (this.currentView === 'Timeline') {
      this.timelineEl()?.goToToday();
    } else {
      this.monthGridEl()?.goToToday();
    }
  }

  handleToggleCreate(): void {
    if (this.currentView === 'Timeline') {
      this.timelineEl()?.toggleCreate();
    }
  }

  toggleCreate(): void {
    this.allowCreate.set(!this.allowCreate());
  }

  handleEventMove(data: EventMoveDetail): void {
    console.log('📦 Moving event:', data);
    const currentEvent = this.manager.getEvent(data.event.id);
    if (!currentEvent) return;
    const updatedResourceIds = currentEvent.resourceIds.map((id) =>
      id === data.oldResourceId ? data.newResourceId : id,
    );
    this.manager.updateEvent(data.event.id, {
      resourceIds: updatedResourceIds,
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
      resourceIds: [data.resourceId],
      status: 'confirmed',
    });
  }

  handleAiSubmit(detail: { prompt: string }): void {
    console.log('AI prompt submitted:', detail.prompt);
    // TODO: NLP integration
  }
}
