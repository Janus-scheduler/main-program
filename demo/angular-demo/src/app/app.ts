import {
  Component,
  ViewEncapsulation,
  CUSTOM_ELEMENTS_SCHEMA,
  signal,
  computed,
  viewChild,
} from '@angular/core';
import {
  SchedulerComponent,
  TimelineComponent,
  MonthGridComponent,
  DayGridComponent,
  WeekGridComponent,
  AiBarComponent,
  TopbarComponent,
  type TimelineEvent,
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
    AiBarComponent,
    TopbarComponent,
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
  monthGridEl = viewChild<MonthGridComponent>('monthGridEl');
  dayGridEl = viewChild<DayGridComponent>('dayGridEl');
  weekGridEl = viewChild<WeekGridComponent>('weekGridEl');

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
  private readonly manager = new SchedulerManager({
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

    this.manager.addResource({
      id: 'r1',
      name: 'Dr. Sarah Chen',
      type: 'person',
      avatar:
        'https://tse4.mm.bing.net/th/id/OIP.Fg0RUhBQm2fns8AIOTXtJwHaHa?r=0&rs=1&pid=ImgDetMain&o=7&rm=3',
    });
    this.manager.addResource({
      id: 'r2',
      name: 'Dr. Michael Ross',
      type: 'person',
      avatar:
        'https://img.magnific.com/premium-photo/handsome-young-male-medical-doctor-portrait-with-stethoscope-hospital_744655-345.jpg?w=2000',
    });
    this.manager.addResource({
      id: 'r3',
      name: 'Dr. Ann sherin',
      type: 'person',
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

  handleEventClick(event: TimelineEvent | TimeGridEvent): void {
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
    }
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
