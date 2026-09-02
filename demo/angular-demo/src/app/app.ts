import {
  Component,
  ViewEncapsulation,
  CUSTOM_ELEMENTS_SCHEMA,
  signal,
  computed,
  viewChild,
  effect,
  OnDestroy,
  inject,
} from '@angular/core';
import { NlpEngineService } from './chat/nlp-engine.service';
import { JanusChatService } from './chat/janus-chat.service';
import {
  catalogFromResources,
  commitSession,
  type SessionRequirements,
  type SessionState,
  type PresentMessage,
} from '@janus-scheduler/nlp';
import {
  SchedulerComponent,
  TimelineComponent,
  MonthGridComponent,
  DayGridComponent,
  WeekGridComponent,
  YearGridComponent,
  TopbarComponent,
  ChatComponent,
  type TimelineEvent,
  type MonthEvent,
  type DayHeaderClickDetail,
  type MonthSlotSelectDetail,
  type YearMonthHeaderClickDetail,
  type YearDayClickDetail,
  type TimelineHeaderDateClickDetail,
  type SchedulerSaveData,
  type EventMoveDetail,
  type EventResizeDetail,
  type EventCreateDetail,
  type SlotSelectDetail,
  type TimeGridEvent,
  type TimeGridEventMoveDetail,
  type TimeGridEventResizeDetail,
  type ViewType,
  SchedulerManager,
  getBrowserTimezone,
  zonedInputToISO,
  isoToZonedDisplay,
  schedulerStore,
} from '@janus-scheduler/angular';
import {
  GoogleSyncManager,
  GoogleCalendarClient,
  GoogleEventMapper,
} from '@janus-scheduler/integrations';

const BACKEND_URL = 'http://localhost:3001';

const INTRO: PresentMessage = {
  id: 'intro',
  role: 'assistant',
  kind: 'text',
  text: "Tell me what to schedule. I'll show you what I understood before anything is added.",
};

const REQUIRES: SessionRequirements = {
  add_event: ['when', 'duration', 'resource', 'title'],
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
    DayGridComponent,
    WeekGridComponent,
    YearGridComponent,
    TopbarComponent,
    ChatComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './app.html',
  styleUrl: './app.css',
  encapsulation: ViewEncapsulation.None,
})
export class App implements OnDestroy {
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

  TIMELINE_RESOURCE_CONFIG = {
    person: { label: 'STAFF', subtitle: 'Staff', order: 1 },
    room: { label: 'ROOMS', subtitle: 'Facility', order: 2 },
    equipment: { label: 'EQUIPMENT', subtitle: 'Equipment', order: 3 },
    vehicle: {
      label: 'VEHICLES',
      subtitle: 'Fleet',
      order: 4,
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11h12Zm0 0h2.5a2.5 2.5 0 0 0 2.5-2.5V11l-4-3v10Z"/><circle cx="6" cy="18" r="2"/><circle cx="16" cy="18" r="2"/></svg>`,
    },
  };

  readonly timelineEl = viewChild<TimelineComponent>('timelineEl');
  readonly monthGridEl = viewChild<MonthGridComponent>('monthGridEl');
  readonly dayGridEl = viewChild<DayGridComponent>('dayGridEl');
  readonly weekGridEl = viewChild<WeekGridComponent>('weekGridEl');
  readonly yearGridEl = viewChild<YearGridComponent>('yearGridEl');

  engineService = inject(NlpEngineService);
  chatService = inject(JanusChatService);

  tempEventData = signal<{
    startDate?: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
    participants?: string[];
    showConfirmOnCreate?: boolean;
    activeColor?: string;
  } | null>(null);

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

  startParts = computed(() => {
    if (this.storeEvent()) return this.splitISO(this.storeEvent()?.startTime);
    return { date: this.tempEventData()?.startDate, time: this.tempEventData()?.startTime };
  });

  endParts = computed(() => {
    if (this.storeEvent()) return this.splitISO(this.storeEvent()?.endTime);
    return { date: this.tempEventData()?.endDate, time: this.tempEventData()?.endTime };
  });

  participants = computed(() => {
    if (this.storeEvent()) return this.storeEvent()?.resourceIds;
    return this.tempEventData()?.participants;
  });

  modalTitle = computed(() => {
    if (this.storeEvent()) return this.storeEvent()?.title;
    if (this.tempEventData()) return 'New Event';
    return undefined;
  });

  activeColor = computed(() => {
    if (this.storeEvent()) return this.storeEvent()?.color;
    return this.tempEventData()?.activeColor || 'primary';
  });

  allowCreate = signal(false);
  schedulerError = signal<string | null>(null);
  // ── Google Calendar sync ────────────────────────────────────────────────
  googleConnected = signal(false);
  private readonly googleClient = new GoogleCalendarClient({ backendUrl: BACKEND_URL });
  private readonly googleMapper = new GoogleEventMapper();
  private readonly syncManager = new GoogleSyncManager(this.googleClient, this.googleMapper);
  private unsubscribeGoogleStatus: (() => void) | undefined;
  private stopRealtimeSync: (() => void) | undefined;

  private readonly manager = new SchedulerManager({
    ...this.syncManager.getHooks(),
    onError: ({ operation, error }) => {
      console.error(`❌ Manager error [${operation}]:`, error);
      this.schedulerError.set((error as Error).message || 'An unexpected error occurred');
    },
  });

  constructor() {
    this.seedInitialData();

    // Detect OAuth redirect / pick up an already-connected backend, same as
    // the React demo: handleOAuthRedirect() consumes `?google_connected=`
    // and cleans the URL, onStatusChange fires immediately with the current
    // status then on every future change, refreshStatus() covers a plain
    // reload with an already-connected backend from an earlier session.
    this.syncManager.handleOAuthRedirect();
    this.unsubscribeGoogleStatus = this.syncManager.onStatusChange((connected) =>
      this.googleConnected.set(connected),
    );
    this.syncManager.refreshStatus();

    // Start real-time sync after connecting; tear it down on disconnect.
    effect((onCleanup) => {
      if (!this.googleConnected()) return;

      let cancelled = false;
      this.syncManager.startRealtimeSync().then((stop) => {
        if (cancelled) {
          stop();
        } else {
          this.stopRealtimeSync = stop;
        }
      });

      onCleanup(() => {
        cancelled = true;
        this.stopRealtimeSync?.();
        this.stopRealtimeSync = undefined;
      });
    });

    effect(() => {
      const state = this.engineService.state();
      const catalog = catalogFromResources(this.manager.getAllResources());
      const resources = this.manager.getAllResources();
      this.chatService.initialize({
        engine: state.status === 'ready' ? state.engine : null,
        catalog,
        // Resolved per turn, from the zone the timeline actually renders in.
        timezone: () => schedulerStore.getState().timezone,
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

  ngOnDestroy(): void {
    this.unsubscribeGoogleStatus?.();
    this.stopRealtimeSync?.();
  }

  handleConnectCalendar(): void {
    if (this.googleConnected()) {
      // disconnect() calls setConnected(false) internally, which broadcasts
      // to the onStatusChange subscription above — no need to set it here too.
      this.syncManager.disconnect();
    } else {
      this.syncManager.connect();
    }
  }

  private seedInitialData() {
    // Only seed if the store is empty to avoid duplicates on re-renders
    if (this.manager.getResourceCount() > 0) return;

    console.log('🌱 Seeding initial data to core manager...');

    // Same resources as React demo
    this.manager.addResource({
      id: 'r1',
      name: 'Dr. Sarah Chen',
      type: 'person',
      email: 'sarah.chen@example.com',
      subtitle: 'Specialist',
      avatar:
        'https://tse4.mm.bing.net/th/id/OIP.Fg0RUhBQm2fns8AIOTXtJwHaHa?r=0&rs=1&pid=ImgDetMain&o=7&rm=3',
    });
    this.manager.addResource({
      id: 'r2',
      name: 'Dr. Michael Ross',
      type: 'person',
      email: 'michael.ross@example.com',
      subtitle: 'Medical Officer',
      avatar:
        'https://img.magnific.com/premium-photo/handsome-young-male-medical-doctor-portrait-with-stethoscope-hospital_744655-345.jpg?w=2000',
    });
    this.manager.addResource({
      id: 'r3',
      name: 'Dr. Ann sherin',
      type: 'person',
      email: 'ann.sherin@example.com',
      avatar: 'https://westernsydneydiabetes.com.au/uploads/2021/06/Rona-scaled.jpg',
    });
    this.manager.addResource({
      id: 'r4',
      name: 'Operating Room 1',
      type: 'room',
      avatar:
        'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=120&h=120',
    });
    this.manager.addResource({
      id: 'r5',
      name: 'MRI Scanner A',
      type: 'equipment',
      avatar:
        'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=120&h=120',
    });
    this.manager.addResource({
      id: 'r6',
      name: 'MRI Scanner B',
      type: 'equipment',
      avatar:
        'https://tse3.mm.bing.net/th/id/OIP.gB5vMFJ88MAKfv9CPhYJ9QHaE7?r=0&rs=1&pid=ImgDetMain&o=7&rm=3',
    });
    this.manager.addResource({
      id: 'r7',
      name: 'Dr. Alan Turing',
      type: 'person',
      email: 'alan.turing@example.com',
      avatar:
        'https://tse4.mm.bing.net/th/id/OIP.kqx_nQhmMAt1EtXnbBhOBwHaK0?r=0&w=832&h=1216&rs=1&pid=ImgDetMain&o=7&rm=3',
    });

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
      color: 'primary',
    });

    this.manager.addEvent({
      id: 'e2',
      title: 'Pre-op Assessment',
      startTime: zonedInputToISO(today, '13:00', tz),
      endTime: zonedInputToISO(today, '14:00', tz),
      resourceIds: ['r2'],
      status: 'confirmed',
      color: 'primary',
    });

    console.log('✅ Seeding complete');
  }

  handleAddEvent(): void {
    this.selectedEventId.set(null);
    this.schedulerError.set(null);
    this.tempEventData.set({
      activeColor: 'primary',
    });
    this.showScheduler = true;
  }

  handleEventClick(event: TimelineEvent | TimeGridEvent | MonthEvent): void {
    console.log('Clicked event:', event);
    this.selectedEventId.set(event.id);
    this.schedulerError.set(null);
    this.showScheduler = true;
  }

  handleDayHeaderClick(detail: DayHeaderClickDetail): void {
    console.log('Day header clicked, navigating to Day view:', detail.date);
    this.currentView = 'Day';
    setTimeout(() => {
      this.dayGridEl()?.goToDate(detail.date);
    }, 50);
  }

  handleMonthHeaderClick(detail: YearMonthHeaderClickDetail): void {
    console.log('Month header clicked, navigating to Month view:', detail.date);
    this.currentView = 'Month';
    setTimeout(() => {
      this.monthGridEl()?.goToDate(detail.date);
    }, 50);
  }

  handleTimelineHeaderDateClick(detail: TimelineHeaderDateClickDetail): void {
    console.log('Timeline header date clicked, navigating to Day view:', detail.date);
    this.currentView = 'Day';
    setTimeout(() => {
      this.dayGridEl()?.goToDate(detail.date);
    }, 50);
  }

  handleYearDayClick(detail: YearDayClickDetail): void {
    console.log('Year day clicked, navigating to Day view:', detail.date);
    this.currentView = 'Day';
    setTimeout(() => {
      this.dayGridEl()?.goToDate(detail.date);
    }, 50);
  }

  handleMonthSlotSelect(detail: MonthSlotSelectDetail): void {
    console.log('Month slot selected for event creation:', detail.date);
    this.selectedEventId.set(null);
    this.schedulerError.set(null);
    this.tempEventData.set({
      startDate: detail.date,
      startTime: '09:00',
      endDate: detail.date,
      endTime: '10:00',
      activeColor: 'primary',
      showConfirmOnCreate: true,
    });
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
      this.tempEventData.set(null);
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
    this.tempEventData.set(null);
  }

  closeScheduler(): void {
    this.showScheduler = false;
    this.selectedEventId.set(null);
    this.tempEventData.set(null);
  }

  handleViewChange(data: { view: ViewType }): void {
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
    } else if (this.currentView === 'Month') {
      this.monthGridEl()?.goToPrev();
    } else if (this.currentView === 'Day') {
      this.dayGridEl()?.goToPrev();
    } else if (this.currentView === 'Week') {
      this.weekGridEl()?.goToPrev();
    } else if (this.currentView === 'Year') {
      this.yearGridEl()?.goToPrev();
    }
  }

  handleNextClick(): void {
    if (this.currentView === 'Timeline') {
      this.timelineEl()?.goToNext();
    } else if (this.currentView === 'Month') {
      this.monthGridEl()?.goToNext();
    } else if (this.currentView === 'Day') {
      this.dayGridEl()?.goToNext();
    } else if (this.currentView === 'Week') {
      this.weekGridEl()?.goToNext();
    } else if (this.currentView === 'Year') {
      this.yearGridEl()?.goToNext();
    }
  }

  handleTodayClick(): void {
    if (this.currentView === 'Timeline') {
      this.timelineEl()?.goToToday();
    } else if (this.currentView === 'Month') {
      this.monthGridEl()?.goToToday();
    } else if (this.currentView === 'Day') {
      this.dayGridEl()?.goToToday();
    } else if (this.currentView === 'Week') {
      this.weekGridEl()?.goToToday();
    } else if (this.currentView === 'Year') {
      this.yearGridEl()?.goToToday();
    }
  }

  handleDayClick(detail: { date: string }): void {
    this.currentView = 'Timeline';
    setTimeout(() => {
      this.timelineEl()?.goToDate(detail.date);
    }, 100);
  }

  handleToggleCreate(): void {
    if (this.currentView === 'Timeline') {
      this.timelineEl()?.toggleCreate();
    }
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
    const startStr = this.splitISO(data.startTime);
    const endStr = this.splitISO(data.endTime);
    this.tempEventData.set({
      startDate: startStr.date,
      startTime: startStr.time,
      endDate: endStr.date,
      endTime: endStr.time,
      participants: [data.resourceId],
      showConfirmOnCreate: true,
      activeColor: 'primary',
    });
    this.showScheduler = true;
  }

  handleSlotSelect(detail: SlotSelectDetail): void {
    this.tempEventData.set({
      startDate: detail.date,
      startTime: detail.startTime,
      endDate: detail.date,
      endTime: detail.endTime,
      showConfirmOnCreate: true,
      activeColor: 'primary',
    });
    this.showScheduler = true;
  }

  handleTimeGridMove(detail: TimeGridEventMoveDetail): void {
    console.log('📦 Moving time grid event:', detail);
    const tz = schedulerStore.getState().timezone;
    this.manager.updateEvent(detail.event.id, {
      startTime: zonedInputToISO(detail.newDate, detail.newStartTime, tz),
      endTime: zonedInputToISO(detail.newDate, detail.newEndTime, tz),
    });
  }

  handleTimeGridResize(detail: TimeGridEventResizeDetail): void {
    console.log('↔️ Resizing time grid event:', detail);
    const tz = schedulerStore.getState().timezone;
    this.manager.updateEvent(detail.event.id, {
      startTime: zonedInputToISO(detail.date, detail.newStartTime, tz),
      endTime: zonedInputToISO(detail.date, detail.newEndTime, tz),
    });
  }

  handleAiSubmit(detail: { prompt: string }): void {
    console.log('AI prompt submitted:', detail.prompt);
    // NLP integration to be implemented
  }

  async syncBulkEvents(): Promise<void> {
    try {
      console.log('Fetching from LMS...');
      await new Promise((r) => setTimeout(r, 800));

      const lmsData = {
        courses: [
          {
            id: 'course_101',
            courseName: 'Advanced Physiology',
            teacherId: 'lms_t1',
            teacherName: 'Dr. Gregory House',
            startDate: new Date(new Date().setHours(9, 0, 0, 0)).toISOString(),
            endDate: new Date(new Date().setHours(12, 0, 0, 0)).toISOString(),
          },
          {
            id: 'course_102',
            courseName: 'Neurology Seminar',
            teacherId: 'lms_t2',
            teacherName: 'Dr. Eric Foreman',
            startDate: new Date(new Date().setHours(14, 0, 0, 0)).toISOString(),
            endDate: new Date(new Date().setHours(16, 30, 0, 0)).toISOString(),
          },
        ],
      };

      const eventsToAdd: {
        id: string;
        title: string;
        startTime: string;
        endTime: string;
        resourceIds: string[];
        status: 'confirmed';
      }[] = [];

      lmsData.courses.forEach((course) => {
        if (!this.manager.getResource(course.teacherId)) {
          this.manager.addResource({
            id: course.teacherId,
            name: course.teacherName,
            type: 'person',
          });
        }

        if (!this.manager.getEvent(course.id)) {
          eventsToAdd.push({
            id: course.id,
            title: course.courseName,
            startTime: course.startDate,
            endTime: course.endDate,
            resourceIds: [course.teacherId],
            status: 'confirmed' as const,
          });
        }
      });

      if (eventsToAdd.length > 0) {
        this.manager.batchAddEvents(eventsToAdd);
      }

      console.log(`Successfully synced ${eventsToAdd.length} events from LMS!`);
    } catch (error) {
      console.error('Failed to sync from LMS:', error);
      alert('Synchronization failed. Please check the logs.');
    }
  }
}
