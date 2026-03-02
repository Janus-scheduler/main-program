import {
  Component,
  input,
  output,
  inject,
  computed,
  OnInit,
  ChangeDetectionStrategy,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { SchedulerService } from "./scheduler.service";
import { EventCardComponent } from "./event-card.component";
import {
  JanusEventData,
  JanusResourceData,
  SchedulerConfig,
  SchedulerView,
  EventClickPayload,
  EventCreatePayload,
  EventUpdatePayload,
  EventDeletePayload,
  ResourceClickPayload,
} from "./types";

/**
 * SchedulerComponent
 *
 * The top-level standalone scheduler component. It bridges Angular template
 * bindings to the framework-agnostic SchedulerService.
 *
 * @example – with external service (recommended)
 * ```ts
 * // app.config.ts
 * providers: [SchedulerService]
 *
 * // my.component.ts
 * readonly scheduler = inject(SchedulerService);
 * ```
 * ```html
 * <janus-scheduler
 *   [config]="{ defaultView: 'week', enableDrag: true }"
 *   [events]="scheduler.events()"
 *   [resources]="scheduler.resources()"
 *   (eventClick)="onEventClick($event)"
 *   (eventCreate)="onEventCreate($event)"
 *   (eventUpdate)="onEventUpdate($event)"
 *   (eventDelete)="onEventDelete($event)" />
 * ```
 *
 * @example – self-contained (data via inputs only)
 * ```html
 * <janus-scheduler [events]="myEvents" [resources]="myResources" />
 * ```
 */
@Component({
  selector: "janus-scheduler",
  standalone: true,
  imports: [CommonModule, EventCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="janus-scheduler" [attr.data-view]="activeView()">
      <!-- ── Toolbar ── -->
      <header class="janus-scheduler__toolbar">
        <div class="janus-scheduler__nav">
          <button
            class="janus-btn janus-btn--ghost"
            (click)="prev()"
            aria-label="Previous"
          >
            ‹
          </button>
          <button
            class="janus-btn janus-btn--ghost"
            (click)="today()"
            aria-label="Today"
          >
            Today
          </button>
          <button
            class="janus-btn janus-btn--ghost"
            (click)="next()"
            aria-label="Next"
          >
            ›
          </button>
        </div>

        <h2 class="janus-scheduler__title">{{ dateLabel() }}</h2>

        <div class="janus-scheduler__view-switcher">
          @for (v of views; track v) {
            <button
              class="janus-btn janus-btn--view"
              [class.janus-btn--active]="activeView() === v"
              (click)="setView(v)"
            >
              {{ v | titlecase }}
            </button>
          }
        </div>
      </header>

      <!-- ── Resource header row ── -->
      @if (resolvedResources().length > 0) {
        <div class="janus-scheduler__resource-row">
          <div class="janus-scheduler__time-gutter"></div>
          @for (resource of resolvedResources(); track resource.id) {
            <div
              class="janus-scheduler__resource-header"
              (click)="onResourceClick(resource, $event)"
            >
              <span
                class="janus-scheduler__resource-type janus-scheduler__resource-type--{{
                  resource.type
                }}"
              >
                {{ resourceIcon(resource.type) }}
              </span>
              <span class="janus-scheduler__resource-name">{{
                resource.name
              }}</span>
            </div>
          }
        </div>
      }

      <!-- ── Main grid ── -->
      <main class="janus-scheduler__body">
        @if (activeView() === "day") {
          <ng-container *ngTemplateOutlet="dayView" />
        }
        @if (activeView() === "week") {
          <ng-container *ngTemplateOutlet="weekView" />
        }
        @if (activeView() === "month") {
          <ng-container *ngTemplateOutlet="monthView" />
        }
      </main>

      <!-- ── Status bar ── -->
      <footer class="janus-scheduler__statusbar">
        <span
          >{{ resolvedEvents().length }} event{{
            resolvedEvents().length !== 1 ? "s" : ""
          }}</span
        >
        @if (selectedEvent()) {
          <span class="janus-scheduler__statusbar-selected">
            Selected: <strong>{{ selectedEvent()!.title }}</strong>
          </span>
        }
      </footer>
    </div>

    <!-- ======== VIEW TEMPLATES ======== -->

    <!-- Day view -->
    <ng-template #dayView>
      <div class="janus-view janus-view--day">
        @for (slot of timeSlots(); track slot.label) {
          <div class="janus-view__slot">
            <span class="janus-view__slot-label">{{ slot.label }}</span>
            <div class="janus-view__slot-cells">
              @for (event of eventsInSlot(slot.hour); track event.id) {
                <janus-event-card
                  [event]="event"
                  [selected]="selectedEventId() === event.id"
                  [showDelete]="true"
                  (eventClick)="onEventCardClick($event)"
                  (eventDelete)="onEventCardDelete($event)"
                />
              }
            </div>
          </div>
        }
      </div>
    </ng-template>

    <!-- Week view -->
    <ng-template #weekView>
      <div class="janus-view janus-view--week">
        <!-- Day column headers -->
        <div class="janus-view__week-header">
          <div class="janus-view__time-col-placeholder"></div>
          @for (day of weekDays(); track day.iso) {
            <div
              class="janus-view__week-day-header"
              [class.janus-view__week-day-header--today]="day.isToday"
            >
              <span class="janus-view__week-day-name">{{ day.dayName }}</span>
              <span
                class="janus-view__week-day-num"
                [class.janus-view__week-day-num--today]="day.isToday"
              >
                {{ day.dayNum }}
              </span>
            </div>
          }
        </div>

        <!-- Time grid -->
        <div class="janus-view__week-grid">
          @for (slot of timeSlots(); track slot.label) {
            <div class="janus-view__week-row">
              <span class="janus-view__time-label">{{ slot.label }}</span>
              @for (day of weekDays(); track day.iso) {
                <div class="janus-view__week-cell">
                  @for (
                    event of eventsInSlotForDay(slot.hour, day.iso);
                    track event.id
                  ) {
                    <janus-event-card
                      [event]="event"
                      [selected]="selectedEventId() === event.id"
                      [showDelete]="true"
                      (eventClick)="onEventCardClick($event)"
                      (eventDelete)="onEventCardDelete($event)"
                    />
                  }
                </div>
              }
            </div>
          }
        </div>
      </div>
    </ng-template>

    <!-- Month view -->
    <ng-template #monthView>
      <div class="janus-view janus-view--month">
        <div class="janus-view__month-weekdays">
          @for (name of dayNames; track name) {
            <div class="janus-view__month-weekday">{{ name }}</div>
          }
        </div>
        <div class="janus-view__month-grid">
          @for (cell of monthCells(); track cell.iso) {
            <div
              class="janus-view__month-cell"
              [class.janus-view__month-cell--today]="cell.isToday"
              [class.janus-view__month-cell--other-month]="!cell.isCurrentMonth"
            >
              <span class="janus-view__month-date">{{ cell.dayNum }}</span>
              @for (event of eventsOnDay(cell.iso); track event.id) {
                <janus-event-card
                  [event]="event"
                  [selected]="selectedEventId() === event.id"
                  (eventClick)="onEventCardClick($event)"
                  (eventDelete)="onEventCardDelete($event)"
                />
              }
            </div>
          }
        </div>
      </div>
    </ng-template>
  `,
  styles: [
    `
      /* ── Layout ────────────────────────────────────────────────────────── */
      .janus-scheduler {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 400px;
        font-family: var(--janus-font, system-ui, sans-serif);
        font-size: 14px;
        color: var(--janus-color-text, #202124);
        background: var(--janus-color-bg, #fff);
        border: 1px solid var(--janus-color-border, #dadce0);
        border-radius: 8px;
        overflow: hidden;
      }

      /* ── Toolbar ────────────────────────────────────────────────────────── */
      .janus-scheduler__toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 16px;
        border-bottom: 1px solid var(--janus-color-border, #dadce0);
        gap: 12px;
        flex-wrap: wrap;
      }
      .janus-scheduler__nav {
        display: flex;
        gap: 4px;
        align-items: center;
      }
      .janus-scheduler__title {
        font-size: 1rem;
        font-weight: 600;
        flex: 1;
        text-align: center;
        margin: 0;
      }
      .janus-scheduler__view-switcher {
        display: flex;
        gap: 4px;
      }
      .janus-btn {
        padding: 5px 12px;
        border: 1px solid var(--janus-color-border, #dadce0);
        border-radius: 4px;
        cursor: pointer;
        background: transparent;
        font-size: 0.85rem;
        transition: background 0.12s;
        color: inherit;
      }
      .janus-btn:hover {
        background: var(--janus-color-hover, #f1f3f4);
      }
      .janus-btn--ghost {
        border-color: transparent;
      }
      .janus-btn--active {
        background: var(--janus-color-accent, #1a73e8);
        color: #fff;
        border-color: var(--janus-color-accent, #1a73e8);
      }

      /* ── Resource Row ───────────────────────────────────────────────────── */
      .janus-scheduler__resource-row {
        display: flex;
        border-bottom: 1px solid var(--janus-color-border, #dadce0);
      }
      .janus-scheduler__time-gutter {
        width: 56px;
        flex-shrink: 0;
      }
      .janus-scheduler__resource-header {
        flex: 1;
        padding: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        border-left: 1px solid var(--janus-color-border, #dadce0);
        overflow: hidden;
      }
      .janus-scheduler__resource-name {
        font-size: 0.8rem;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* ── Body ───────────────────────────────────────────────────────────── */
      .janus-scheduler__body {
        flex: 1;
        overflow: auto;
      }

      /* ── Status bar ─────────────────────────────────────────────────────── */
      .janus-scheduler__statusbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 4px 16px;
        font-size: 0.75rem;
        color: #888;
        border-top: 1px solid var(--janus-color-border, #dadce0);
      }
      .janus-scheduler__statusbar-selected {
        color: var(--janus-color-accent, #1a73e8);
      }

      /* ── Day / Week shared ──────────────────────────────────────────────── */
      .janus-view__slot,
      .janus-view__week-row {
        display: flex;
        min-height: 48px;
        border-bottom: 1px solid var(--janus-color-border, #dadce0);
      }
      .janus-view__slot-label,
      .janus-view__time-label {
        width: 56px;
        flex-shrink: 0;
        font-size: 0.7rem;
        color: #888;
        padding: 2px 4px;
        text-align: right;
        padding-top: 4px;
      }
      .janus-view__slot-cells,
      .janus-view__week-cell {
        flex: 1;
        padding: 2px 4px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .janus-view__week-cell {
        border-left: 1px solid var(--janus-color-border, #dadce0);
      }

      /* ── Week header ────────────────────────────────────────────────────── */
      .janus-view__week-header {
        display: flex;
        border-bottom: 2px solid var(--janus-color-border, #dadce0);
        position: sticky;
        top: 0;
        background: #fff;
        z-index: 1;
      }
      .janus-view__time-col-placeholder {
        width: 56px;
        flex-shrink: 0;
      }
      .janus-view__week-day-header {
        flex: 1;
        text-align: center;
        padding: 8px 4px;
        border-left: 1px solid var(--janus-color-border, #dadce0);
      }
      .janus-view__week-day-header--today {
        background: var(--janus-color-today-bg, #e8f0fe);
      }
      .janus-view__week-day-name {
        font-size: 0.7rem;
        display: block;
        color: #888;
      }
      .janus-view__week-day-num {
        font-size: 1rem;
        font-weight: 600;
        color: #444;
        display: block;
      }
      .janus-view__week-day-num--today {
        background: var(--janus-color-accent, #1a73e8);
        color: #fff;
        border-radius: 50%;
        width: 26px;
        height: 26px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      /* ── Month view ─────────────────────────────────────────────────────── */
      .janus-view--month {
        padding: 8px;
      }
      .janus-view__month-weekdays {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        margin-bottom: 4px;
      }
      .janus-view__month-weekday {
        text-align: center;
        font-size: 0.7rem;
        font-weight: 600;
        color: #888;
        padding: 4px;
      }
      .janus-view__month-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
      }
      .janus-view__month-cell {
        min-height: 80px;
        border: 1px solid var(--janus-color-border, #dadce0);
        border-radius: 4px;
        padding: 4px;
        overflow: hidden;
      }
      .janus-view__month-cell--today {
        border-color: var(--janus-color-accent, #1a73e8);
      }
      .janus-view__month-cell--other-month {
        opacity: 0.45;
      }
      .janus-view__month-date {
        font-size: 0.75rem;
        font-weight: 600;
        display: block;
        margin-bottom: 4px;
      }
    `,
  ],
})
export class SchedulerComponent implements OnInit {
  // ── Injected service ─────────────────────────────────────────────────────
  private readonly _svc = inject(SchedulerService);

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Pass events directly (alternative to using SchedulerService) */
  readonly events = input<JanusEventData[]>([]);

  /** Pass resources directly */
  readonly resources = input<JanusResourceData[]>([]);

  /** Optional config override */
  readonly config = input<SchedulerConfig>({});

  /** Override the current view from outside */
  readonly view = input<SchedulerView | undefined>(undefined);

  // ── Outputs ───────────────────────────────────────────────────────────────

  readonly eventClick = output<EventClickPayload>();
  readonly eventCreate = output<EventCreatePayload>();
  readonly eventUpdate = output<EventUpdatePayload>();
  readonly eventDelete = output<EventDeletePayload>();
  readonly resourceClick = output<ResourceClickPayload>();

  // ── Constants ─────────────────────────────────────────────────────────────

  readonly views: SchedulerView[] = ["day", "week", "month"];
  readonly dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    // Sync input config to service
    const cfg = this.config();
    if (Object.keys(cfg).length) this._svc.setConfig(cfg);

    // Seed service if events/resources were passed as inputs
    if (this.events().length || this.resources().length) {
      this._svc.init({ events: this.events(), resources: this.resources() });
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  /** Events: prefer service state over direct inputs */
  readonly resolvedEvents = computed(() =>
    this._svc.eventCount() > 0 ? this._svc.events() : this.events(),
  );

  readonly resolvedResources = computed(() =>
    this._svc.resourceCount() > 0 ? this._svc.resources() : this.resources(),
  );

  readonly activeView = computed(() => this.view() ?? this._svc.currentView());
  readonly selectedEventId = computed(() => this._svc.selectedEventId());
  readonly selectedEvent = computed(() => this._svc.selectedEvent());

  readonly dateLabel = computed(() => {
    const d = this._svc.currentDate();
    const view = this.activeView();
    if (view === "day") {
      return d.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
    if (view === "week") {
      const start = this._startOfWeek(d);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  });

  readonly timeSlots = computed(() => {
    const cfg = this._svc.config();
    const slots: Array<{ hour: number; label: string }> = [];
    for (let h = cfg.startHour; h < cfg.endHour; h++) {
      slots.push({ hour: h, label: this._formatHour(h) });
    }
    return slots;
  });

  readonly weekDays = computed(() => {
    const monday = this._startOfWeek(this._svc.currentDate());
    const today = new Date().toISOString().split("T")[0];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().split("T")[0];
      return {
        iso,
        isToday: iso === today,
        dayName: d.toLocaleDateString(undefined, { weekday: "short" }),
        dayNum: d.getDate(),
      };
    });
  });

  readonly monthCells = computed(() => {
    const d = this._svc.currentDate();
    const year = d.getFullYear();
    const month = d.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const today = new Date().toISOString().split("T")[0];

    const cells: Array<{
      iso: string;
      dayNum: number;
      isToday: boolean;
      isCurrentMonth: boolean;
    }> = [];

    // Pad start
    for (let i = startOffset - 1; i >= 0; i--) {
      const pd = new Date(year, month, -i);
      cells.push({
        iso: pd.toISOString().split("T")[0],
        dayNum: pd.getDate(),
        isToday: false,
        isCurrentMonth: false,
      });
    }

    // Current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const cd = new Date(year, month, day);
      const iso = cd.toISOString().split("T")[0];
      cells.push({
        iso,
        dayNum: day,
        isToday: iso === today,
        isCurrentMonth: true,
      });
    }

    // Pad end to 42 cells (6 rows × 7)
    while (cells.length < 42) {
      const nd = new Date(
        year,
        month + 1,
        cells.length - lastDay.getDate() - startOffset + 1,
      );
      cells.push({
        iso: nd.toISOString().split("T")[0],
        dayNum: nd.getDate(),
        isToday: false,
        isCurrentMonth: false,
      });
    }

    return cells;
  });

  // ── View helpers ──────────────────────────────────────────────────────────

  eventsInSlot(hour: number): JanusEventData[] {
    const d = this._svc.currentDate().toISOString().split("T")[0];
    return this.resolvedEvents().filter((e) => {
      const eDate = new Date(e.startTime);
      return (
        eDate.toISOString().split("T")[0] === d && eDate.getHours() === hour
      );
    });
  }

  eventsInSlotForDay(hour: number, dayIso: string): JanusEventData[] {
    return this.resolvedEvents().filter((e) => {
      const eDate = new Date(e.startTime);
      return (
        eDate.toISOString().split("T")[0] === dayIso &&
        eDate.getHours() === hour
      );
    });
  }

  eventsOnDay(dayIso: string): JanusEventData[] {
    return this.resolvedEvents().filter(
      (e) => new Date(e.startTime).toISOString().split("T")[0] === dayIso,
    );
  }

  resourceIcon(type: string): string {
    const icons: Record<string, string> = {
      person: "👤",
      room: "🏠",
      equipment: "🔧",
    };
    return icons[type] ?? "📋";
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  prev(): void {
    this._svc.navigatePrev();
  }
  next(): void {
    this._svc.navigateNext();
  }
  today(): void {
    this._svc.navigateToday();
  }
  setView(v: SchedulerView): void {
    this._svc.setView(v);
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  onEventCardClick(payload: EventClickPayload): void {
    this._svc.selectEvent(payload.event.id);
    this.eventClick.emit(payload);
  }

  onEventCardDelete(payload: EventDeletePayload): void {
    this._svc.deleteEvent(payload.id);
    this.eventDelete.emit(payload);
  }

  onResourceClick(resource: JanusResourceData, sourceEvent: MouseEvent): void {
    this.resourceClick.emit({ resource, sourceEvent });
  }

  // ── Private utils ─────────────────────────────────────────────────────────

  private _formatHour(h: number): string {
    if (h === 0) return "12 AM";
    if (h < 12) return `${h} AM`;
    if (h === 12) return "12 PM";
    return `${h - 12} PM`;
  }

  private _startOfWeek(d: Date): Date {
    const result = new Date(d);
    const day = result.getDay(); // 0 = Sun
    result.setDate(result.getDate() - day);
    result.setHours(0, 0, 0, 0);
    return result;
  }
}
