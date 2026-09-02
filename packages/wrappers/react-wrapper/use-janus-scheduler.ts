import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  SchedulerManager,
  schedulerStore,
  isoToZonedDisplay,
  zonedInputToISO,
  type EventData,
  type ResourceData,
  type ResourceTypeConfig,
  type SchedulerHooks,
  type SchedulerSaveData,
  type ViewType,
  type EventMoveDetail,
  type EventResizeDetail,
  type EventCreateDetail,
  type SlotSelectDetail,
  type TimeGridEventMoveDetail,
  type TimeGridEventResizeDetail,
} from "@janus-scheduler/core";
import type {
  JanusTimeline,
  JanusMonthGrid,
  JanusDayGrid,
  JanusWeekGrid,
  JanusYearGrid,
} from "@janus-scheduler/ui";

/**
 * `useJanusScheduler` — every piece of wiring a scheduler needs, with none of
 * the layout.
 *
 * The components in this package render from the store but never write to it,
 * so historically each consumer had to translate ~44 drag/resize/create/save
 * callbacks into `SchedulerManager` calls, own five imperative refs for
 * navigation, and hand-roll the editor-modal state machine. That is ~600 lines
 * before anything appears on screen, and every app wrote the same ~600 lines.
 *
 * This hook owns all of it and hands back prop bundles you spread onto the
 * components — so you keep full control of layout, and can still override any
 * individual prop because spread order wins:
 *
 * ```tsx
 * const janus = useJanusScheduler({ resources, events });
 *
 * <Topbar {...janus.topbarProps} />
 * <Timeline {...janus.timelineProps} onEventClick={myOwnHandler} />
 * {janus.editor.isOpen && <Scheduler {...janus.editor.props} />}
 * ```
 *
 * If you do not need custom layout at all, `@janus-scheduler/app` renders the
 * same thing as a single element.
 */

/** A view element's imperative navigation surface. */
interface NavHandle extends HTMLElement {
  goToPrev(): void;
  goToNext(): void;
  goToToday(): void;
  goToDate?(date: string | number | Date): void;
  toggleCreate?(): void;
}

/** Values seeded into the editor when creating (rather than editing) an event. */
interface DraftSeed {
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  participants?: string[];
  showConfirmOnCreate?: boolean;
}

export type JanusChangeType = "add" | "update" | "delete";

export interface JanusChangeDetail {
  type: JanusChangeType;
  id: string;
}

export interface UseJanusSchedulerOptions {
  /** Seeded into the store once, on mount. Use `load()` to replace later. */
  events?: EventData[];
  /** Seeded once, on mount. A resource of type `"person"` needs a non-empty `email`. */
  resources?: ResourceData[];
  /** View shown initially. Default `"Timeline"`. */
  defaultView?: ViewType;
  /** Views the topbar offers. Defaults to all five. */
  views?: ViewType[];
  /** IANA timezone for display. Defaults to the store's. */
  timezone?: string;
  /** `true` hard-blocks conflicting actions instead of warning. Default `false`. */
  preventConflicts?: boolean;
  /** Groups and labels resource rows on the timeline. */
  resourceTypeConfig?: ResourceTypeConfig;
  /** Show the floating "add event" button. Default `true`. */
  showFab?: boolean;
  /** Whether drag-to-create starts enabled. Default `true`. */
  defaultAllowCreate?: boolean;
  /** Render the Google Calendar button as connected. */
  googleConnected?: boolean;
  /**
   * Lifecycle hooks forwarded to the manager — where you persist. A hook that
   * throws or rejects rolls the store change back.
   */
  hooks?: SchedulerHooks;
  /** Bring your own manager instead of letting the hook create one. */
  manager?: SchedulerManager;
  /** Called after any event is added, updated or deleted. */
  onChange?: (detail: JanusChangeDetail) => void;
  /** Called when the topbar's Google Calendar button is clicked. */
  onConnectCalendar?: () => void;
}

const ALL_VIEWS: ViewType[] = ["Timeline", "Day", "Week", "Month", "Year"];

export function useJanusScheduler(options: UseJanusSchedulerOptions = {}) {
  const {
    events,
    resources,
    defaultView = "Timeline",
    views = ALL_VIEWS,
    timezone,
    preventConflicts = false,
    resourceTypeConfig,
    showFab = true,
    defaultAllowCreate = true,
    googleConnected = false,
    hooks,
    manager: providedManager,
    onChange,
    onConnectCalendar,
  } = options;

  // Keep the latest callbacks in refs so the manager, created once, always
  // calls the current ones without being recreated on every render.
  const hooksRef = useRef(hooks);
  hooksRef.current = hooks;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // ── The manager ────────────────────────────────────────────────────────────
  const managerRef = useRef<SchedulerManager | null>(null);
  if (!managerRef.current) {
    managerRef.current =
      providedManager ??
      new SchedulerManager({
        onEventAdd: (event) => {
          onChangeRef.current?.({ type: "add", id: event.id });
          return hooksRef.current?.onEventAdd?.(event);
        },
        onEventUpdate: (event) => {
          onChangeRef.current?.({ type: "update", id: event.id });
          return hooksRef.current?.onEventUpdate?.(event);
        },
        onEventDelete: (id) => {
          onChangeRef.current?.({ type: "delete", id });
          return hooksRef.current?.onEventDelete?.(id);
        },
        onError: (ctx) => {
          setEditorError(
            ctx.error instanceof Error ? ctx.error.message : String(ctx.error),
          );
          hooksRef.current?.onError?.(ctx);
        },
      });
  }
  const manager = managerRef.current;

  // ── State ──────────────────────────────────────────────────────────────────
  const [view, setViewState] = useState<ViewType>(defaultView);
  const [allowCreate, setAllowCreate] = useState(defaultAllowCreate);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftSeed | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [nav, setNav] = useState({
    navLabel: "",
    dayName: "",
    shortDate: "",
    zoomPercent: 100,
    zoomUnit: "",
  });

  // Re-render when the store changes so the editor reflects external edits.
  const storeEvents = useSyncExternalStore(
    schedulerStore.subscribe,
    () => schedulerStore.getState().events,
    () => schedulerStore.getState().events,
  );

  // Undo availability is published by the manager, not the store.
  const canUndo = useSyncExternalStore(
    useCallback((cb) => manager.subscribeUndo(cb), [manager]),
    () => manager.canUndo(),
    () => false,
  );

  // ── One-shot seeding ───────────────────────────────────────────────────────
  const seededRef = useRef(false);
  const seed = useCallback(
    (nextEvents?: EventData[], nextResources?: ResourceData[]) => {
      for (const r of nextResources ?? []) {
        try {
          manager.addResource(r);
        } catch {
          /* one malformed row must not take down the whole view */
        }
      }
      if (nextEvents?.length) {
        try {
          manager.batchAddEvents(nextEvents);
        } catch {
          /* same */
        }
      }
    },
    [manager],
  );

  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    seed(events, resources);
    // Seeding is deliberately one-shot; `load()` replaces data afterwards.
  }, []);

  /** Replace the store's contents. Use instead of reassigning `events`. */
  const load = useCallback(
    (data: { events?: EventData[]; resources?: ResourceData[] }) => {
      manager.clearAll();
      seed(data.events, data.resources);
    },
    [manager, seed],
  );

  // ── Navigation ─────────────────────────────────────────────────────────────
  const timelineRef = useRef<(JanusTimeline & NavHandle) | null>(null);
  const monthRef = useRef<(JanusMonthGrid & NavHandle) | null>(null);
  const dayRef = useRef<(JanusDayGrid & NavHandle) | null>(null);
  const weekRef = useRef<(JanusWeekGrid & NavHandle) | null>(null);
  const yearRef = useRef<(JanusYearGrid & NavHandle) | null>(null);
  const pendingDate = useRef<string | null>(null);

  const activeNav = useCallback((): NavHandle | null => {
    if (view === "Timeline") return timelineRef.current;
    if (view === "Month") return monthRef.current;
    if (view === "Day") return dayRef.current;
    if (view === "Week") return weekRef.current;
    return yearRef.current;
  }, [view]);

  // After a view switch, send the freshly mounted view to the date the user
  // clicked in the previous one. Timeline does not open on today the way the
  // calendar views do, so it gets an explicit reset when there is no target.
  useEffect(() => {
    const target = pendingDate.current;
    pendingDate.current = null;
    if (!target && view !== "Timeline") return;

    // The new view mounts on the next tick, so resolve the ref inside the
    // timeout rather than capturing one that is still null.
    const timer = setTimeout(() => {
      const el = activeNav();
      if (!el) return;
      if (target) el.goToDate?.(target);
      else el.goToToday();
    }, 50);
    return () => clearTimeout(timer);
  }, [view]);

  const setView = useCallback((next: ViewType) => setViewState(next), []);

  const goToDateIn = useCallback((nextView: ViewType, date: string) => {
    pendingDate.current = date;
    setViewState(nextView);
  }, []);

  // ── Editor ─────────────────────────────────────────────────────────────────
  const openEditor = useCallback(
    (eventId?: string, seedDraft: DraftSeed | null = null) => {
      setSelectedEventId(eventId ?? null);
      setDraft(seedDraft);
      setEditorError(null);
      setEditorOpen(true);
    },
    [],
  );

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setSelectedEventId(null);
    setDraft(null);
    setEditorError(null);
  }, []);

  const tz = useCallback(
    () => timezone ?? schedulerStore.getState().timezone,
    [timezone],
  );

  // ── Ctrl+Z ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        !(e.ctrlKey || e.metaKey) ||
        e.key.toLowerCase() !== "z" ||
        e.shiftKey
      )
        return;
      if (!manager.canUndo()) return;
      e.preventDefault();
      manager.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [manager]);

  // ── Store writes ───────────────────────────────────────────────────────────
  const handleSave = useCallback(
    (data: SchedulerSaveData) => {
      const today = new Date().toISOString().split("T")[0];
      const zone = data.timezone || tz();
      const payload = {
        title: data.title || "New Event",
        startTime: zonedInputToISO(
          data.startDate || today,
          data.startTime,
          zone,
        ),
        endTime: zonedInputToISO(data.endDate || today, data.endTime, zone),
        resourceIds: data.participants ?? [],
        description: data.description,
        status: "confirmed" as const,
        color: data.activeColor,
        allDay: data.allDay,
        recurrenceRule: data.recurrenceRule,
      };
      try {
        if (data.id) manager.updateEvent(data.id, payload);
        else manager.addEvent({ id: `evt_${Date.now()}`, ...payload });
        closeEditor();
      } catch (err) {
        // Synchronous validation/conflict failure — keep the modal open.
        setEditorError(err instanceof Error ? err.message : String(err));
      }
    },
    [manager, tz, closeEditor],
  );

  const handleDelete = useCallback(
    (id: string) => {
      try {
        manager.deleteEvent(id);
        closeEditor();
      } catch (err) {
        setEditorError(err instanceof Error ? err.message : String(err));
      }
    },
    [manager, closeEditor],
  );

  // ── Editor field values ────────────────────────────────────────────────────
  const editorValues = useMemo(() => {
    const stored = selectedEventId ? manager.getEvent(selectedEventId) : null;
    if (!stored) {
      return {
        title: draft ? "New Event" : "",
        startDate: draft?.startDate ?? "",
        startTime: draft?.startTime ?? "",
        endDate: draft?.endDate ?? "",
        endTime: draft?.endTime ?? "",
        participants: draft?.participants ?? [],
        description: "",
        activeColor: "primary",
        allDay: false,
        recurrenceRule: "",
      };
    }
    const zone = stored.timezone || tz();
    const s = isoToZonedDisplay(stored.startTime, zone);
    const e = isoToZonedDisplay(stored.endTime, zone);
    return {
      title: stored.title,
      startDate: s.date,
      startTime: s.time,
      endDate: e.date,
      endTime: e.time,
      participants: stored.resourceIds ?? [],
      description: stored.description ?? "",
      activeColor: stored.color ?? "primary",
      allDay: stored.allDay ?? false,
      recurrenceRule: stored.recurrenceRule ?? "",
    };
    // storeEvents is the reactivity trigger — the values are read via `manager`.
  }, [selectedEventId, draft, manager, tz, storeEvents]);

  // ── Shared handlers ────────────────────────────────────────────────────────
  const onNavChange = useCallback((detail: Record<string, unknown>) => {
    setNav({
      navLabel: (detail.navLabel as string) ?? "",
      dayName: (detail.dayName as string) ?? "",
      shortDate: (detail.shortDate as string) ?? "",
      zoomPercent: (detail.zoomPercent as number) ?? 100,
      zoomUnit: (detail.zoomUnit as string) ?? "",
    });
  }, []);

  const onEventClick = useCallback(
    (ev: { id?: string } | undefined) => openEditor(ev?.id),
    [openEditor],
  );

  /**
   * Day/Week grids report drags as wall-clock date + time, not the ISO instants
   * the Timeline reports — so these convert before writing.
   */
  const onTimeGridMove = useCallback(
    ({ event, newDate, newStartTime, newEndTime }: TimeGridEventMoveDetail) => {
      const zone = tz();
      manager.updateEvent(event.id, {
        startTime: zonedInputToISO(newDate, newStartTime, zone),
        endTime: zonedInputToISO(newDate, newEndTime, zone),
      });
    },
    [manager, tz],
  );

  const onTimeGridResize = useCallback(
    ({ event, date, newStartTime, newEndTime }: TimeGridEventResizeDetail) => {
      const zone = tz();
      manager.updateEvent(event.id, {
        startTime: zonedInputToISO(date, newStartTime, zone),
        endTime: zonedInputToISO(date, newEndTime, zone),
      });
    },
    [manager, tz],
  );

  const onSlotSelect = useCallback(
    ({ date, startTime, endTime }: SlotSelectDetail) =>
      openEditor(undefined, {
        startDate: date,
        startTime,
        endDate: date,
        endTime,
        showConfirmOnCreate: true,
      }),
    [openEditor],
  );

  const onResize = useCallback(
    ({ event, newStartTime, newEndTime }: EventResizeDetail) =>
      manager.updateEvent(event.id, {
        startTime: newStartTime,
        endTime: newEndTime,
      }),
    [manager],
  );

  // ── Prop bundles ───────────────────────────────────────────────────────────
  const common = {
    timezone,
    onViewChange: (d: { view: ViewType }) => setView(d.view),
  };

  const timelineProps = {
    ref: timelineRef,
    allowCreate,
    showFab,
    preventConflicts,
    resourceTypeConfig,
    ...common,
    onAddEvent: () => openEditor(),
    onEventClick,
    onEventResize: onResize,
    onEventMove: ({
      event,
      oldResourceId,
      newResourceId,
      newStartTime,
      newEndTime,
    }: EventMoveDetail) => {
      const current = manager.getEvent(event.id);
      if (!current) return;
      manager.updateEvent(event.id, {
        resourceIds: current.resourceIds.map((id: string) =>
          id === oldResourceId ? newResourceId : id,
        ),
        startTime: newStartTime,
        endTime: newEndTime,
      });
    },
    onEventCreate: ({ resourceId, startTime, endTime }: EventCreateDetail) => {
      const s = isoToZonedDisplay(startTime, tz());
      const e = isoToZonedDisplay(endTime, tz());
      openEditor(undefined, {
        startDate: s.date,
        startTime: s.time,
        endDate: e.date,
        endTime: e.time,
        participants: [resourceId],
        showConfirmOnCreate: true,
      });
    },
    onHeaderDateClick: (d: { date: string }) => goToDateIn("Day", d.date),
    onNavChange: (d: Record<string, unknown>) =>
      view === "Timeline" && onNavChange(d),
  };

  const monthGridProps = {
    ref: monthRef,
    showFab,
    navLinks: true,
    ...common,
    onAddEvent: () => openEditor(),
    onEventClick,
    onDayHeaderClick: (d: { date: string }) => goToDateIn("Day", d.date),
    onSlotSelect: (d: { date: string }) =>
      openEditor(undefined, {
        startDate: d.date,
        startTime: "09:00",
        endDate: d.date,
        endTime: "10:00",
        showConfirmOnCreate: true,
      }),
    onNavChange: (d: Record<string, unknown>) =>
      view === "Month" && onNavChange(d),
  };

  const timeGridProps = {
    showFab,
    navLinks: true,
    allowCreate,
    ...common,
    onAddEvent: () => openEditor(),
    onEventClick,
    onSlotSelect,
    onEventMove: onTimeGridMove,
    onEventResize: onTimeGridResize,
    onNavChange,
  };

  const dayGridProps = { ...timeGridProps, ref: dayRef };

  const weekGridProps = {
    ...timeGridProps,
    ref: weekRef,
    onDayHeaderClick: (d: { date: string }) => goToDateIn("Day", d.date),
    onDayClick: (d: { date: string }) => goToDateIn("Day", d.date),
  };

  const yearGridProps = {
    ref: yearRef,
    navLinks: true,
    ...common,
    onNavChange,
    onDayClick: (d: { date: string }) => goToDateIn("Day", d.date),
    onMonthHeaderClick: (d: { date: string }) => goToDateIn("Month", d.date),
  };

  const topbarProps = {
    navLabel: nav.navLabel,
    dayName: nav.dayName,
    shortDate: nav.shortDate,
    view,
    views,
    allowCreate,
    canUndo,
    zoomPercent: nav.zoomPercent,
    zoomUnit: nav.zoomUnit,
    isGoogleCalendarConnected: googleConnected,
    onPrevClick: () => activeNav()?.goToPrev(),
    onNextClick: () => activeNav()?.goToNext(),
    onTodayClick: () => activeNav()?.goToToday(),
    onViewSwitch: (d: { view: ViewType }) => setView(d.view),
    onToggleCreate: () => {
      if (view === "Timeline") timelineRef.current?.toggleCreate?.();
      setAllowCreate((v) => !v);
    },
    onUndoClick: () => manager.undo(),
    onConnectCalendar: () => onConnectCalendar?.(),
  };

  const editorProps = {
    eventId: selectedEventId,
    error: editorError,
    preventConflicts,
    timezone,
    ...editorValues,
    showConfirmOnCreate: !selectedEventId && !!draft?.showConfirmOnCreate,
    onClose: closeEditor,
    onSave: handleSave,
    onDelete: (d: { id: string | null; title: string }) => {
      if (d.id) handleDelete(d.id);
    },
  };

  return {
    /** The manager driving everything. Call it directly for programmatic changes. */
    manager,
    /** The active view. */
    view,
    setView,
    /** Which views the topbar offers. */
    views,
    canUndo,
    undo: () => manager.undo(),
    allowCreate,
    setAllowCreate,
    /** Current period label and zoom, plus imperative navigation. */
    nav: {
      ...nav,
      goToPrev: () => activeNav()?.goToPrev(),
      goToNext: () => activeNav()?.goToNext(),
      goToToday: () => activeNav()?.goToToday(),
      goToDate: (date: string) => activeNav()?.goToDate?.(date),
    },
    /** Editor modal state. Spread `props` onto `<Scheduler>`. */
    editor: {
      isOpen: editorOpen,
      open: openEditor,
      close: closeEditor,
      props: editorProps,
    },
    /** Replace all events and resources. */
    load,
    timelineProps,
    monthGridProps,
    dayGridProps,
    weekGridProps,
    yearGridProps,
    topbarProps,
  };
}

export type JanusSchedulerApi = ReturnType<typeof useJanusScheduler>;
