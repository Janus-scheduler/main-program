import { LitElement, html, nothing } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";
import { timelineStyles } from "./timeline-styles";
import {
  schedulerStore,
  isoToZonedDisplay,
  getBrowserTimezone,
  expandEvents,
  computeTimelineConflicts,
  checkSlotConflict,
  type ConflictResource,
  type SchedulerStore,
  type Event as CoreEvent,
  type EventData,
  type Resource,
  type ViewType,
} from "@janus-scheduler/core";
import "./janus-ai-bar";
import "./janus-topbar";

type ConflictState = {
  hasConflict: boolean;
  messages: string[];
  conflictingEventIds: Set<string>;
};

import {
  TimelineEvent,
  TimelineResource,
  EventMoveDetail,
  EventResizeDetail,
  EventCreateDetail,
} from "./timeline-types";
import { RoomIcon, EquipmentIcon, PlusIcon } from "./timeline-icons";
import {
  ROW_HEIGHT,
  GROUP_LABEL_HEIGHT,
  HOUR_HEADER_HEIGHT,
  SUPER_HEADER_HEIGHT,
  fmt12,
  getInitials,
  avatarColor,
} from "./timeline-utils";
import {
  DEFAULT_PX_PER_MS,
  MIN_PX_PER_MS,
  MAX_PX_PER_MS,
  ZOOM_SCALE_FACTOR,
  CONTENT_HALF_WIDTH,
  getActiveZoomLevel,
  generateColumns,
  generateSuperLabels,
  timestampToPx,
  formatNavDate,
  getNavStepMs,
  pxToTimestamp,
  snapTimestamp,
} from "./timeline-zoom";
import { TimelineDragController, ResourceLayout } from "./timeline-drag";

/** Shared empty result for the no-recurring-events fast path in _syncFromStore. */
const EMPTY_EVENT_LIST: ReturnType<typeof expandEvents> = [];

/** Nav-label formatters, hoisted so scrolling does not rebuild them per event. */
const NAV_WEEKDAY_FMT = new Intl.DateTimeFormat("en-US", { weekday: "long" });
const NAV_SHORT_DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

@customElement("janus-timeline")
export class JanusTimeline extends LitElement {
  static readonly styles = timelineStyles;

  @property({ type: Array }) resources: TimelineResource[] = [];
  /** When true, dragging on empty row space creates a new event. Default: false */
  @property({ type: Boolean, attribute: "allow-create" }) allowCreate = false;
  /** When true, renders a + Floating Action Button to add an event. Default: false */
  @property({ type: Boolean, attribute: "show-fab" }) showFab = false;
  @property({ type: Boolean, attribute: "prevent-conflicts" })
  preventConflicts = true;

  @state() private _showBlockedConflictDialog = false;
  @state() private _blockedConflictMessage = "";

  @state() view: ViewType = "Timeline";
  @state() private _dragVersion = 0; // bumped to trigger re-render during drag
  @state() private _showConflictDetails = false;
  @state() private _isConflictsBannerDismissed = false;
  private _lastConflictIdsKey = "";
  /** Conflict-recompute inputs from the last willUpdate — see the guard there. */
  private _confLastResources: TimelineResource[] | null = null;
  private _confLastTz = "";
  private _confLastPrevent: boolean | null = null;
  @state() private _cachedConflicts = {
    hasConflict: false,
    messages: [] as string[],
    conflictingEventIds: new Set<string>(),
  };

  /** Zoom: pixels per millisecond (the single universal scale) */
  @state() private _pxPerMs = DEFAULT_PX_PER_MS;

  /**
   * The absolute timestamp (ms) at the LEFT EDGE of the rendered content.
   * The content always spans from _viewStartMs to _viewStartMs + totalWidth/pxPerMs.
   */
  private _viewStartMs = 0;

  @query(".tl-res-col") resColRef!: HTMLElement;
  @query(".tl-time-scroll") gridScrollRef!: HTMLElement;

  private _ghostEl: HTMLElement | null = null;

  private readonly _drag = new TimelineDragController(
    () => {
      this._dragVersion++;
      this.requestUpdate();
    },
    () => {
      this._applyGhostStyle();
    },
  );
  private _wasDragging = false;
  private _unsubStore?: () => void;
  /** Suppress scroll handler during programmatic scroll adjustments */
  private _suppressScroll = false;
  /**
   * Whether the initial centering scroll has actually been applied.
   *
   * Between `_initializeView()` setting `_viewStartMs` and its animation frame
   * applying `scrollLeft`, the container is still scrolled to 0. Any scroll
   * event delivered in that window reports a viewport ~half the content width
   * behind the requested date, so the infinite-scroll edge check below must not
   * act on it — doing so re-centers the timeline days into the past and leaves
   * today's events off-screen.
   */
  private readonly _hasCentered = false;
  /** Identifies the latest centering attempt so stale retries can bail out. */
  private readonly _centerToken = 0;

  private _isScrollingGrid = false;
  private _isScrollingRes = false;
  private _rafGridScroll: number | null = null;
  private _rafResScroll: number | null = null;

  @state() private _scrollLeft = 0;
  @state() private _scrollTop = 0;
  @state() private _viewportWidth = 1200;
  @state() private _viewportHeight = 600;

  private _cachedTrackMap = new Map<
    string,
    { trackCount: number; eventTracks: Map<string, number> }
  >();

  /** Store-slice references from the last sync — see the early-out in _syncFromStore. */
  private _lastEventsRef: SchedulerStore["events"] | null = null;
  private _lastResourcesRef: SchedulerStore["resources"] | null = null;
  private _lastTz = "";

  /**
   * Derived-view-model caches: `_vmCache` by a length-prefixed
   * `resourceId + eventId` composite key, `_rowCache` by resource id. `gen` is
   * the sync pass that last produced the entry; entries from an older pass are
   * evicted. See _syncFromStore for the change-detection contract — in
   * particular why source *fields* are compared rather than object identity.
   */
  private readonly _vmCache = new Map<
    string,
    {
      st: string;
      et: string;
      ti: string;
      co: string;
      gen: number;
      vm: TimelineEvent;
    }
  >();
  private readonly _rowCache = new Map<
    string,
    {
      /** View-models in *grouping* order — the basis for change detection. */
      raw: TimelineEvent[];
      /** Presentation inputs, compared field-by-field to detect row changes. */
      name: string;
      type: string;
      avatar: string;
      groupLabel: string | undefined;
      resource: TimelineResource;
      track: { trackCount: number; eventTracks: Map<string, number> };
      gen: number;
    }
  >();
  private _syncGen = 0;

  private _zoomRafId: number | null = null;
  private _pendingZoomFactor = 1;
  private _pendingPointerX = 0;
  private _navRafId: number | null = null;
  private _resizeObserver?: ResizeObserver;
  private _pendingCenterMs: number | null = null;
  private _activeDragUpHandler: ((e: PointerEvent) => void) | null = null;

  connectedCallback() {
    super.connectedCallback();
    this._unsubStore = schedulerStore.subscribe((state) => {
      this._syncFromStore(state);
    });
    this._syncFromStore(schedulerStore.getState());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._unsubStore) this._unsubStore();
    if (this._rafGridScroll !== null) cancelAnimationFrame(this._rafGridScroll);
    if (this._rafResScroll !== null) cancelAnimationFrame(this._rafResScroll);
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
    if (this._zoomRafId !== null) {
      cancelAnimationFrame(this._zoomRafId);
      this._zoomRafId = null;
    }
    if (this._navRafId !== null) {
      cancelAnimationFrame(this._navRafId);
      this._navRafId = null;
    }
    if (this._activeDragUpHandler) {
      document.removeEventListener("pointerup", this._activeDragUpHandler);
      this._activeDragUpHandler = null;
    }
    this._drag.cancel();
    this._ghostEl = null;
  }

  private readonly _applyGhostStyle = () => {
    this._ghostEl ??= this.renderRoot.querySelector(".tl-drag-ghost");
    const el = this._ghostEl;
    if (!el) return;

    const g = this._drag.ghost;
    el.style.left = `${g.left}px`;
    el.style.top = `${g.top}px`;
    el.style.width = `${g.width}px`;

    // Conflict check scoped ONLY to the target resource (O(events in 1 row))
    const targetResourceId =
      this._drag.targetResourceId || this._drag.originResourceId;
    let ghostStartMs = 0;
    let ghostEndMs = 0;
    const eventId = this._drag.activeEvent?.id;
    const snapMs = this._drag.snapMs;

    if (this._drag.mode === "moving") {
      const durationMs = this._drag.originalEndMs - this._drag.originalStartMs;
      const rawStart = pxToTimestamp(g.left, this._viewStartMs, this._pxPerMs);
      ghostStartMs = snapTimestamp(rawStart, snapMs);
      ghostEndMs = ghostStartMs + durationMs;
    } else if (this._drag.mode === "resize-start") {
      ghostEndMs = this._drag.originalEndMs;
      const rawStart = pxToTimestamp(g.left, this._viewStartMs, this._pxPerMs);
      ghostStartMs = snapTimestamp(rawStart, snapMs);
    } else if (this._drag.mode === "resize-end") {
      ghostStartMs = this._drag.originalStartMs;
      const rawEnd = pxToTimestamp(
        g.left + g.width,
        this._viewStartMs,
        this._pxPerMs,
      );
      ghostEndMs = snapTimestamp(rawEnd, snapMs);
    } else if (this._drag.mode === "creating") {
      const rawStart = pxToTimestamp(g.left, this._viewStartMs, this._pxPerMs);
      const rawEnd = pxToTimestamp(
        g.left + g.width,
        this._viewStartMs,
        this._pxPerMs,
      );
      ghostStartMs = snapTimestamp(rawStart, snapMs);
      ghostEndMs = snapTimestamp(rawEnd, snapMs);
      if (ghostEndMs <= ghostStartMs) ghostEndMs = ghostStartMs + snapMs;
    }

    const resource = targetResourceId
      ? this.resources.find((r) => r.id === targetResourceId)
      : null;
    const hasDragConflict = resource
      ? checkSlotConflict(resource.events, ghostStartMs, ghostEndMs, eventId)
      : false;

    el.classList.toggle("tl-drag-ghost--conflict", hasDragConflict);

    const timeEl = el.querySelector(".tl-drag-ghost__time");
    if (timeEl) {
      timeEl.textContent = g.timeLabel;
    }
  };

  private _expandOccurrences(rawEvents: CoreEvent[], centerMs: number) {
    const startRange = centerMs - 365 * 24 * 60 * 60 * 1000;
    const endRange = centerMs + 365 * 24 * 60 * 60 * 1000;
    let recurring: CoreEvent[] | null = null;
    for (const e of rawEvents) {
      if (e.recurrenceRule) {
        recurring ??= [];
        recurring.push(e);
      }
    }
    return recurring
      ? expandEvents(recurring, startRange, endRange)
      : EMPTY_EVENT_LIST;
  }

  private _groupEventsByResource(
    rawEvents: CoreEvent[],
    occurrences: EventData[],
  ) {
    const eventsByResource = new Map<string, (CoreEvent | EventData)[]>();
    const groupByResource = (e: CoreEvent | EventData) => {
      let rIds: string[];
      if (e.resourceIds && e.resourceIds.length > 0) {
        rIds = e.resourceIds;
      } else if (e.resourceId) {
        rIds = [e.resourceId];
      } else {
        rIds = [];
      }
      for (const rId of rIds) {
        let arr = eventsByResource.get(rId);
        if (!arr) {
          arr = [];
          eventsByResource.set(rId, arr);
        }
        arr.push(e);
      }
    };
    for (const e of rawEvents) {
      if (!e.recurrenceRule) groupByResource(e);
    }
    for (const e of occurrences) groupByResource(e);
    return eventsByResource;
  }

  private _computeEventTracks(sorted: TimelineEvent[]) {
    const tracks: number[] = [];
    const eventTracks = new Map<string, number>();
    for (const ev of sorted) {
      let t = 0;
      while (t < tracks.length && tracks[t] > ev.startMs) {
        t++;
      }
      tracks[t] = ev.endMs;
      eventTracks.set(ev.id, t);
    }
    return {
      trackCount: Math.max(1, tracks.length),
      eventTracks,
    };
  }

  private _buildTimelineResource(
    res: Resource,
    sorted: TimelineEvent[],
    type: string,
    groupLabel: string | undefined,
  ): TimelineResource {
    let avatarType: "initials" | "icon" | "image" = "initials";
    let avatarIcon: "room" | "equipment" | undefined = undefined;
    if (res.avatar) {
      avatarType = "image";
    } else if (type === "room") {
      avatarType = "icon";
      avatarIcon = "room";
    } else if (type === "equipment") {
      avatarType = "icon";
      avatarIcon = "equipment";
    }

    let subtitle = "Equipment";
    if (res.type === "person") subtitle = "Staff";
    else if (res.type === "room") subtitle = "Facility";

    return {
      id: res.id,
      name: res.name,
      subtitle,
      avatarType,
      avatarIcon,
      groupLabel,
      events: sorted,
      avatar: res.avatar,
    };
  }

  private _processResourceEvents(
    res: Resource,
    resEventsRaw: (CoreEvent | EventData)[],
    tz: string,
    prevRaw: TimelineEvent[] | undefined,
  ): { resEvents: TimelineEvent[]; vmCount: number; eventsChanged: boolean } {
    const resEvents: TimelineEvent[] = new Array(resEventsRaw.length);
    let eventsChanged = false;
    let vmCount = 0;

    for (let i = 0; i < resEventsRaw.length; i++) {
      const e = resEventsRaw[i];
      const key = `${res.id.length}:${res.id}${e.id}`;
      const color = e.color || "primary";
      const cached = this._vmCache.get(key);

      let vm: TimelineEvent;
      if (
        cached?.st === e.startTime &&
        cached?.et === e.endTime &&
        cached?.ti === e.title &&
        cached?.co === color
      ) {
        vm = cached!.vm;
        cached!.gen = this._syncGen;
      } else {
        const { time: startTime } = isoToZonedDisplay(e.startTime, tz);
        const { time: endTime, date } = isoToZonedDisplay(e.endTime, tz);
        vm = {
          id: e.id,
          title: e.title,
          startTime,
          endTime,
          startMs: new Date(e.startTime).getTime(),
          endMs: new Date(e.endTime).getTime(),
          color,
          date,
          resourceId: res.id,
        } as TimelineEvent;
        this._vmCache.set(key, {
          st: e.startTime,
          et: e.endTime,
          ti: e.title,
          co: color,
          gen: this._syncGen,
          vm,
        });
      }
      resEvents[i] = vm;
      vmCount++;

      if (!eventsChanged && prevRaw?.[i] !== vm) {
        eventsChanged = true;
      }
    }
    if (!eventsChanged && prevRaw && prevRaw.length !== resEvents.length) {
      eventsChanged = true;
    }

    return { resEvents, vmCount, eventsChanged };
  }

  private _resolveGroupLabel(type: string): string | undefined {
    if (type === "person") return "STAFF";
    if (type === "room") return "ROOMS";
    if (type === "equipment") return "EQUIPMENT";
    return undefined;
  }

  private _evictStaleCacheEntries(
    vmCount: number,
    resourceCount: number,
  ): void {
    if (this._vmCache.size !== vmCount) {
      for (const [k, v] of this._vmCache) {
        if (v.gen !== this._syncGen) this._vmCache.delete(k);
      }
    }
    if (this._rowCache.size !== resourceCount) {
      for (const [k, v] of this._rowCache) {
        if (v.gen !== this._syncGen) this._rowCache.delete(k);
      }
    }
  }

  private _hasResourceListChanged(newResources: TimelineResource[]): boolean {
    if (newResources.length !== this.resources.length) return true;
    for (let i = 0; i < newResources.length; i++) {
      if (newResources[i] !== this.resources[i]) return true;
    }
    return false;
  }

  private _syncFromStore(state: SchedulerStore) {
    const tz =
      (state.timezone as string) ||
      Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (
      state.events === this._lastEventsRef &&
      state.resources === this._lastResourcesRef &&
      tz === this._lastTz
    ) {
      return;
    }
    const previousTz = this._lastTz;
    this._lastEventsRef = state.events;
    this._lastResourcesRef = state.resources;
    this._lastTz = tz;

    if (tz !== previousTz) {
      this._vmCache.clear();
      this._rowCache.clear();
    }
    this._syncGen++;

    const newResources: TimelineResource[] = [];
    const rawEvents = Object.values(state.events);
    const centerMs = this._viewStartMs || Date.now();

    const occurrences = this._expandOccurrences(rawEvents, centerMs);
    const coreResources = Object.values(state.resources);

    const typeOrder: Record<string, number> = {
      person: 1,
      room: 2,
      equipment: 3,
    };
    coreResources.sort(
      (a, b) =>
        (typeOrder[a.type || "person"] || 99) -
        (typeOrder[b.type || "person"] || 99),
    );

    let currentGroupType = "";
    const newTrackMap = new Map<
      string,
      { trackCount: number; eventTracks: Map<string, number> }
    >();

    const eventsByResource = this._groupEventsByResource(
      rawEvents,
      occurrences,
    );

    let vmCount = 0;

    for (const res of coreResources) {
      const resEventsRaw = eventsByResource.get(res.id) || [];
      const prevRow = this._rowCache.get(res.id);

      const processResult = this._processResourceEvents(
        res,
        resEventsRaw,
        tz,
        prevRow?.raw,
      );
      const { resEvents, eventsChanged } = processResult;
      vmCount += processResult.vmCount;

      const type = res.type || "person";
      let groupLabel: string | undefined = undefined;
      if (type !== currentGroupType) {
        currentGroupType = type;
        groupLabel = this._resolveGroupLabel(type);
      }
      const avatarSrc = res.avatar ?? "";

      if (
        !eventsChanged &&
        prevRow?.name === res.name &&
        prevRow.type === type &&
        prevRow.avatar === avatarSrc &&
        prevRow.groupLabel === groupLabel
      ) {
        prevRow.gen = this._syncGen;
        newResources.push(prevRow.resource);
        newTrackMap.set(res.id, prevRow.track);
        continue;
      }

      const sorted = resEvents.slice().sort((a, b) => a.startMs - b.startMs);
      const track = this._computeEventTracks(sorted);
      newTrackMap.set(res.id, track);

      const resource = this._buildTimelineResource(
        res,
        sorted,
        type,
        groupLabel,
      );

      newResources.push(resource);
      this._rowCache.set(res.id, {
        raw: resEvents,
        name: res.name,
        type,
        avatar: avatarSrc,
        groupLabel,
        resource,
        track,
        gen: this._syncGen,
      });
    }

    this._evictStaleCacheEntries(vmCount, coreResources.length);
    this._cachedTrackMap = newTrackMap;

    if (this._hasResourceListChanged(newResources) && newResources.length > 0) {
      this.resources = newResources;
    }
  }

  willUpdate(changedProperties: Map<string, unknown>) {
    super.willUpdate(changedProperties);

    // Recompute conflicts only when an actual input changed.
    //
    // The previous guard included `conflictingEventIds.size === 0`, which is
    // true for every conflict-free dataset — the normal case — so this ran over
    // every event on EVERY update: each scroll tick, each drag-start, each
    // dialog toggle. Tracking the inputs by reference fixes that.
    //
    // `resources` identity is a sound signal because _syncFromStore reassigns it
    // if and only if something visible changed, and never mutates it in place.
    const tz = schedulerStore.getState().timezone;
    if (
      this.resources === this._confLastResources &&
      tz === this._confLastTz &&
      this.preventConflicts === this._confLastPrevent
    ) {
      return;
    }
    this._confLastResources = this.resources;
    this._confLastTz = tz;
    this._confLastPrevent = this.preventConflicts;

    const conflictResources = this.resources as unknown as ConflictResource[];
    this._cachedConflicts = computeTimelineConflicts(conflictResources, tz);

    const currentIdsKey = Array.from(this._cachedConflicts.conflictingEventIds)
      .sort((a, b) => a.localeCompare(b))
      .join(",");
    if (currentIdsKey !== this._lastConflictIdsKey) {
      this._isConflictsBannerDismissed = false;
      this._lastConflictIdsKey = currentIdsKey;
    }
  }

  updated(changedProperties: Map<string, unknown>) {
    super.updated(changedProperties);
    if (changedProperties.has("_isConflictsBannerDismissed")) {
      const scrollEl = this.gridScrollRef;
      if (scrollEl) {
        const originalScroll = scrollEl.scrollTop;
        scrollEl.scrollTop = originalScroll + 1;
        scrollEl.scrollTop = originalScroll;
      }
    }

    if (this._drag.active && !this._ghostEl) {
      this._ghostEl = this.renderRoot.querySelector(".tl-drag-ghost");
    } else if (!this._drag.active && this._ghostEl) {
      this._ghostEl = null;
    }
  }

  firstUpdated() {
    if (this.gridScrollRef) {
      this._resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          if (w > 0) {
            if (this._pendingCenterMs !== null) {
              const target = this._pendingCenterMs;
              this._pendingCenterMs = null;
              this._initializeView(target);
            }
          }
        }
      });
      this._resizeObserver.observe(this.gridScrollRef);
    }
    const now = Date.now();
    this._initializeView(now);
  }

  /**
   * Initialize (or re-center) the timeline around a timestamp.
   * Sets _viewStartMs so that `centerMs` is at the middle of the container.
   */
  private _initializeView(centerMs: number) {
    // Content spans CONTENT_HALF_WIDTH * 2 pixels = 20000px total
    this._viewStartMs = centerMs - CONTENT_HALF_WIDTH / this._pxPerMs;
    this.requestUpdate();

    if (!this.gridScrollRef || this.gridScrollRef.clientWidth === 0) {
      this._pendingCenterMs = centerMs;
      this._emitNavChange();
      return;
    }

    const containerWidth = this.gridScrollRef.clientWidth;
    this._suppressScroll = true;
    this.gridScrollRef.scrollLeft = CONTENT_HALF_WIDTH - containerWidth / 2;
    this._suppressScroll = false;

    this._emitNavChange();
  }

  /** Total content width in px — always fixed at 2 * CONTENT_HALF_WIDTH */
  private get _totalWidth(): number {
    return CONTENT_HALF_WIDTH * 2;
  }

  private _getViewEndMs(): number {
    return this._viewStartMs + this._totalWidth / this._pxPerMs;
  }

  /** Get the timestamp at the center of the currently visible area */
  private _getVisibleCenterMs(): number {
    if (!this.gridScrollRef)
      return this._viewStartMs + CONTENT_HALF_WIDTH / this._pxPerMs;
    const containerWidth = this.gridScrollRef.clientWidth;
    const scrollCenter = this.gridScrollRef.scrollLeft + containerWidth / 2;
    return this._viewStartMs + scrollCenter / this._pxPerMs;
  }

  // ── Scroll handling ─────────────────────────────────────────────────

  private _onGridScroll() {
    if (!this.gridScrollRef) return;

    // Sync vertical scroll between resource column and time grid
    if (this.resColRef && this.gridScrollRef) {
      if (!this._isScrollingRes) {
        this._isScrollingGrid = true;
        if (
          Math.abs(this.resColRef.scrollTop - this.gridScrollRef.scrollTop) >
          0.5
        ) {
          this.resColRef.scrollTop = this.gridScrollRef.scrollTop;
        }
        if (this._rafGridScroll !== null)
          cancelAnimationFrame(this._rafGridScroll);
        this._rafGridScroll = requestAnimationFrame(() => {
          this._isScrollingGrid = false;
          this._rafGridScroll = null;
        });
      }
    }

    if (this._scrollLeft !== this.gridScrollRef.scrollLeft) {
      this._scrollLeft = this.gridScrollRef.scrollLeft;
    }
    if (this._scrollTop !== this.gridScrollRef.scrollTop) {
      this._scrollTop = this.gridScrollRef.scrollTop;
    }
    const cw = this.gridScrollRef.clientWidth;
    const ch = this.gridScrollRef.clientHeight;
    if (cw && this._viewportWidth !== cw) {
      this._viewportWidth = cw;
    }
    if (ch && this._viewportHeight !== ch) {
      this._viewportHeight = ch;
    }

    // Skip re-centering during programmatic scroll adjustments
    if (this._suppressScroll) return;

    // Infinite scroll: when user nears the edges, re-center the content.
    // Skipped until the initial centering lands — see _hasCentered.
    if (this._hasCentered) {
      const sl = this.gridScrollRef.scrollLeft;
      const maxScroll = this._totalWidth - cw;

      // If within 15% of either edge, re-center
      const edgeThreshold = maxScroll * 0.15;
      if (sl < edgeThreshold || sl > maxScroll - edgeThreshold) {
        const currentCenterMs = this._getVisibleCenterMs();
        this._initializeView(currentCenterMs);
      }
    }
    this._scheduleNavChange();
  }

  /**
   * Coalesce nav-change emission to one per frame.
   *
   * `_emitNavChange` formats three date labels and dispatches an event that the
   * host re-renders on. Firing it per native scroll event (which on a trackpad
   * exceeds 60Hz) did that work several times per frame for no visible benefit.
   * Mirrors the existing rAF-coalesced zoom commit.
   */
  private _scheduleNavChange() {
    if (this._navRafId !== null) return;
    this._navRafId = requestAnimationFrame(() => {
      this._navRafId = null;
      this._emitNavChange();
    });
  }

  private _onResScroll() {
    if (this.resColRef && this.gridScrollRef) {
      if (!this._isScrollingGrid) {
        this._isScrollingRes = true;
        if (
          Math.abs(this.gridScrollRef.scrollTop - this.resColRef.scrollTop) >
          0.5
        ) {
          this.gridScrollRef.scrollTop = this.resColRef.scrollTop;
        }
        if (this._rafResScroll !== null)
          cancelAnimationFrame(this._rafResScroll);
        this._rafResScroll = requestAnimationFrame(() => {
          this._isScrollingRes = false;
          this._rafResScroll = null;
        });
      }
    }
  }

  private _emitNavChange() {
    const visibleCenter = this._getVisibleCenterMs();
    const level = getActiveZoomLevel(this._pxPerMs);
    const tz = getBrowserTimezone();
    const navLabel = formatNavDate(visibleCenter, level, tz);

    // `toLocaleDateString` constructs a fresh Intl.DateTimeFormat internally on
    // every call — the memoization in core's time.ts cannot reach it — so hold
    // the two formatters here instead.
    const d = new Date(visibleCenter);
    const dayName = NAV_WEEKDAY_FMT.format(d);
    const shortDate = NAV_SHORT_DATE_FMT.format(d);

    this.dispatchEvent(
      new CustomEvent("nav-change", {
        detail: {
          navLabel,
          dayName,
          shortDate,
          zoomPercent: this._zoomPercent(),
          zoomUnit: level.unit,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ── Navigation ────────────────────────────────────────────────────

  public goToPrev() {
    const level = getActiveZoomLevel(this._pxPerMs);
    const currentCenter = this._getVisibleCenterMs();
    this._initializeView(currentCenter - getNavStepMs(level));
  }

  public goToNext() {
    const level = getActiveZoomLevel(this._pxPerMs);
    const currentCenter = this._getVisibleCenterMs();
    this._initializeView(currentCenter + getNavStepMs(level));
  }

  public goToToday() {
    this._pxPerMs = DEFAULT_PX_PER_MS; // reset zoom to default
    this._initializeView(Date.now());
  }

  public goToDate(date: string | number | Date) {
    this._pxPerMs = DEFAULT_PX_PER_MS;
    let targetTime: number;
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [y, m, d] = date.split("-").map(Number);
      // Center on noon local time on the target day
      targetTime = new Date(y, m - 1, d, 12, 0, 0).getTime();
    } else {
      targetTime = new Date(date).getTime();
    }
    this._initializeView(targetTime);
  }

  private _handleEventClick(e: Event, ev: TimelineEvent) {
    if (this._wasDragging) {
      this._wasDragging = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    this.dispatchEvent(
      new CustomEvent("event-click", {
        detail: ev,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleAddEvent() {
    this.dispatchEvent(
      new CustomEvent("add-event", { bubbles: true, composed: true }),
    );
  }

  public setView(v: ViewType) {
    this.view = v;
    // Let the parent app know so it can swap components if needed
    this.dispatchEvent(
      new CustomEvent("view-change", {
        detail: { view: v },
        bubbles: true,
        composed: true,
      }),
    );
  }

  public toggleCreate() {
    this.allowCreate = !this.allowCreate;
    this.dispatchEvent(
      new CustomEvent("allow-create-change", {
        detail: { allowCreate: this.allowCreate },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ── Zoom handler (Ctrl/Cmd + Scroll) ──────────────────────────────

  private _handleWheel(e: WheelEvent) {
    // Only zoom when Ctrl or Meta (Cmd on Mac) is held
    if (!e.ctrlKey && !e.metaKey) return;

    e.preventDefault();

    const container = this.gridScrollRef;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const direction = e.deltaY < 0 ? 1 : -1; // scroll up = zoom in

    // Accumulate zoom factor & capture latest pointer X
    this._pendingZoomFactor *= 1 + direction * ZOOM_SCALE_FACTOR;
    this._pendingPointerX = e.clientX - rect.left;

    this._zoomRafId ??= requestAnimationFrame(() => this._commitZoom());
  }

  private _commitZoom() {
    this._zoomRafId = null;

    const container = this.gridScrollRef;
    if (!container) {
      this._pendingZoomFactor = 1;
      return;
    }

    const pointerPx = container.scrollLeft + this._pendingPointerX;
    const timeUnderCursorMs = this._viewStartMs + pointerPx / this._pxPerMs;

    const newPxPerMs = Math.min(
      MAX_PX_PER_MS,
      Math.max(MIN_PX_PER_MS, this._pxPerMs * this._pendingZoomFactor),
    );
    const newViewStartMs = timeUnderCursorMs - pointerPx / newPxPerMs;

    this._scrollLeft = container.scrollLeft;
    this._scrollTop = container.scrollTop;
    if (container.clientWidth) this._viewportWidth = container.clientWidth;
    if (container.clientHeight) this._viewportHeight = container.clientHeight;

    this._pxPerMs = newPxPerMs;
    this._viewStartMs = newViewStartMs;

    this._pendingZoomFactor = 1;

    this.dispatchEvent(
      new CustomEvent("zoom-change", {
        detail: {
          pxPerMs: newPxPerMs,
          level: getActiveZoomLevel(newPxPerMs).unit,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ── Drag-and-drop handlers ────────────────────────────────────────

  private _onEventPointerDown(
    e: PointerEvent,
    ev: TimelineEvent,
    resourceId: string,
    evTop: number,
  ) {
    if (e.button !== 0) return;
    this._drag.startMove(e, ev, resourceId, evTop);
    this._addDragUpListener();
  }

  private _onResizePointerDown(
    e: PointerEvent,
    ev: TimelineEvent,
    resourceId: string,
    edge: "start" | "end",
    evTop: number,
  ) {
    if (e.button !== 0) return;
    this._drag.startResize(e, ev, resourceId, edge, evTop);
    this._addDragUpListener();
  }

  private _onRowPointerDown(e: PointerEvent, resourceId: string) {
    if (e.button !== 0) return;
    if (!this.allowCreate) return;
    this._drag.startCreate(e, resourceId);
    if (this._drag.mode === "creating") {
      this._addDragUpListener();
    }
  }

  private _handleDragComplete(
    result:
      | { type: "event-move"; detail: EventMoveDetail }
      | { type: "event-resize"; detail: EventResizeDetail }
      | { type: "event-create"; detail: EventCreateDetail }
      | null,
  ) {
    if (!result) return;
    this._wasDragging = true;

    let hasConflict = false;
    let targetResId = "";
    let actionVerb = "";

    if (result.type === "event-move") {
      const { event, newResourceId, newStartTime, newEndTime } = result.detail;
      targetResId = newResourceId;
      actionVerb = "move";
      const startMs = new Date(newStartTime).getTime();
      const endMs = new Date(newEndTime).getTime();

      const resource = this.resources.find((r) => r.id === newResourceId);
      if (resource) {
        hasConflict = checkSlotConflict(
          resource.events,
          startMs,
          endMs,
          event.id,
        );
      }
    } else if (result.type === "event-resize") {
      const { event, resourceId, newStartTime, newEndTime } = result.detail;
      targetResId = resourceId;
      actionVerb = "resize";
      const startMs = new Date(newStartTime).getTime();
      const endMs = new Date(newEndTime).getTime();

      const resource = this.resources.find((r) => r.id === resourceId);
      if (resource) {
        hasConflict = checkSlotConflict(
          resource.events,
          startMs,
          endMs,
          event.id,
        );
      }
    } else if (result.type === "event-create") {
      const { resourceId, startTime, endTime } = result.detail;
      targetResId = resourceId;
      actionVerb = "create";
      const startMs = new Date(startTime).getTime();
      const endMs = new Date(endTime).getTime();

      const resource = this.resources.find((r) => r.id === resourceId);
      if (resource) {
        hasConflict = checkSlotConflict(resource.events, startMs, endMs);
      }
    }

    const resourceName = this._resolveResourceName(targetResId);
    const conflictMessage = `Cannot ${actionVerb} event. ${resourceName} is already scheduled during this time. Double-booking is disabled.`;

    if (hasConflict) {
      // Dispatch a cancelable conflict-detected event
      const conflictEvent = new CustomEvent("conflict-detected", {
        detail: {
          message: conflictMessage,
          action: actionVerb,
          detail: result.detail,
        },
        bubbles: true,
        composed: true,
        cancelable: true,
      });
      this.dispatchEvent(conflictEvent);

      if (this.preventConflicts && !conflictEvent.defaultPrevented) {
        this._blockedConflictMessage = conflictMessage;
        this._showBlockedConflictDialog = true;
        return;
      }
    }

    // Always dispatch the custom action event (Unidirectional data flow)
    this.dispatchEvent(
      new CustomEvent(result.type, {
        detail: {
          ...result.detail,
          hasConflict,
          conflictMessage: hasConflict ? conflictMessage : "",
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _addDragUpListener() {
    if (this._activeDragUpHandler) {
      document.removeEventListener("pointerup", this._activeDragUpHandler);
      this._activeDragUpHandler = null;
    }
    const handler = (_e: PointerEvent) => {
      document.removeEventListener("pointerup", handler);
      if (this._activeDragUpHandler === handler) {
        this._activeDragUpHandler = null;
      }
      const result = this._drag.completeAndGetResult();
      this._handleDragComplete(result);
    };
    this._activeDragUpHandler = handler;
    document.addEventListener("pointerup", handler);
  }

  private _resolveResourceName(id: string): string {
    const res = this.resources.find((r) => r.id === id);
    return res ? res.name : id;
  }

  private _closeBlockedConflictDialog() {
    this._showBlockedConflictDialog = false;
    this._blockedConflictMessage = "";
  }

  // ── Column generation (memoized) ──────────────────────────────────

  /**
   * Cached `generateColumns` / `generateSuperLabels` pair.
   *
   * `viewEndMs` is fully determined by `viewStartMs` and `pxPerMs` (the content
   * is a fixed pixel width), so it does not need to be part of the key.
   */
  private _colMemo: {
    key: string;
    columns: ReturnType<typeof generateColumns>;
    superLabels: ReturnType<typeof generateSuperLabels>;
  } | null = null;

  private _getColumns(
    viewStartMs: number,
    viewEndMs: number,
    pxPerMs: number,
    level: ReturnType<typeof getActiveZoomLevel>,
    tz: string,
  ) {
    const key = `${viewStartMs}|${pxPerMs}|${level.unit}|${tz}`;
    let memo = this._colMemo;
    if (memo?.key !== key) {
      memo = {
        key,
        columns: generateColumns(viewStartMs, viewEndMs, pxPerMs, level, tz),
        superLabels: generateSuperLabels(
          viewStartMs,
          viewEndMs,
          pxPerMs,
          level,
          tz,
        ),
      };
      this._colMemo = memo;
    }
    return memo;
  }

  // ── Resource layout computation ───────────────────────────────────

  private _computeResourceLayout(
    groups: { label: string; items: TimelineResource[] }[],
    resourceTrackMap: Map<string, { trackCount: number }>,
  ): ResourceLayout[] {
    const layout: ResourceLayout[] = [];
    let y = HOUR_HEADER_HEIGHT + SUPER_HEADER_HEIGHT;
    let idx = 0;
    for (const g of groups) {
      if (g.label) y += GROUP_LABEL_HEIGHT;
      for (const r of g.items) {
        const tracks = resourceTrackMap.get(r.id)?.trackCount || 1;
        const height = ROW_HEIGHT * tracks;
        layout.push({ id: r.id, yOffset: y, index: idx, height });
        y += height;
        idx++;
      }
    }
    return layout;
  }

  // ── Rendering helpers ─────────────────────────────────────────────

  private renderAvatar(r: TimelineResource) {
    const isIcon = r.avatarIcon === "room" || r.avatarIcon === "equipment";
    const borderRadius = isIcon ? "10px" : "50%";

    const fallback =
      r.avatarIcon === "room"
        ? html`<span class="tl-avatar tl-avatar--icon tl-avatar--room"
            >${RoomIcon()}</span
          >`
        : r.avatarIcon === "equipment"
          ? html`<span class="tl-avatar tl-avatar--icon tl-avatar--equipment"
              >${EquipmentIcon()}</span
            >`
          : html`<span
              class="tl-avatar tl-avatar--initials"
              style="background: ${avatarColor(r.id)}"
              >${getInitials(r.name)}</span
            >`;

    if (r.avatarType === "image" && r.avatar) {
      return html`
        <div
          class="tl-avatar-wrap"
          style="position: relative; display: inline-flex; flex-shrink: 0;"
        >
          ${fallback}
          <img
            class="tl-avatar tl-avatar--image"
            src="${r.avatar}"
            alt="${r.name}"
            style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: ${borderRadius};"
            @load=${(e: Event) => {
              const img = e.currentTarget as HTMLImageElement;
              img.style.display = "";
            }}
            @error=${(e: Event) => {
              const img = e.currentTarget as HTMLImageElement;
              img.style.display = "none";
            }}
          />
        </div>
      `;
    }

    return fallback;
  }

  private _renderDragGhost() {
    if (!this._drag.active) return nothing;
    const g = this._drag.ghost;

    const targetResourceId =
      this._drag.targetResourceId || this._drag.originResourceId;
    let ghostStartMs = 0;
    let ghostEndMs = 0;
    const eventId = this._drag.activeEvent?.id;
    const snapMs = this._drag.snapMs;

    if (this._drag.mode === "moving") {
      const durationMs = this._drag.originalEndMs - this._drag.originalStartMs;
      const rawStart = pxToTimestamp(g.left, this._viewStartMs, this._pxPerMs);
      ghostStartMs = snapTimestamp(rawStart, snapMs);
      ghostEndMs = ghostStartMs + durationMs;
    } else if (this._drag.mode === "resize-start") {
      ghostEndMs = this._drag.originalEndMs;
      const rawStart = pxToTimestamp(g.left, this._viewStartMs, this._pxPerMs);
      ghostStartMs = snapTimestamp(rawStart, snapMs);
    } else if (this._drag.mode === "resize-end") {
      ghostStartMs = this._drag.originalStartMs;
      const rawEnd = pxToTimestamp(
        g.left + g.width,
        this._viewStartMs,
        this._pxPerMs,
      );
      ghostEndMs = snapTimestamp(rawEnd, snapMs);
    } else if (this._drag.mode === "creating") {
      const rawStart = pxToTimestamp(g.left, this._viewStartMs, this._pxPerMs);
      const rawEnd = pxToTimestamp(
        g.left + g.width,
        this._viewStartMs,
        this._pxPerMs,
      );
      ghostStartMs = snapTimestamp(rawStart, snapMs);
      ghostEndMs = snapTimestamp(rawEnd, snapMs);
      if (ghostEndMs <= ghostStartMs) ghostEndMs = ghostStartMs + snapMs;
    }

    const resource = targetResourceId
      ? this.resources.find((r) => r.id === targetResourceId)
      : null;
    const hasDragConflict = resource
      ? checkSlotConflict(resource.events, ghostStartMs, ghostEndMs, eventId)
      : false;

    return html`
      <div
        class="tl-drag-ghost tl-drag-ghost--${g.color} ${hasDragConflict
          ? "tl-drag-ghost--conflict"
          : ""}"
        style="left: ${g.left}px; top: ${g.top}px; width: ${g.width}px;"
      >
        <span class="tl-drag-ghost__title">
          ${hasDragConflict
            ? html`<span class="tl-drag-ghost__conflict-icon">⚠</span> `
            : nothing}
          ${g.title}
        </span>
        <span class="tl-drag-ghost__time">${g.timeLabel}</span>
      </div>
    `;
  }

  /** Compute zoom percentage for display */
  private _zoomPercent(): number {
    return Math.round((this._pxPerMs / DEFAULT_PX_PER_MS) * 100);
  }

  private _renderConflictBanner(conflicts: ConflictState) {
    if (!conflicts.hasConflict || this._isConflictsBannerDismissed)
      return nothing;

    const detailsToggleLabel = this._showConflictDetails
      ? "Hide Details"
      : "Show Details";

    const detailsList = this._showConflictDetails
      ? html`
          <ul class="tl-conflict-details-list">
            ${conflicts.messages.map((msg: string) => html`<li>${msg}</li>`)}
          </ul>
        `
      : nothing;

    const contentHtml =
      conflicts.messages.length === 1
        ? html`<span class="tl-conflict-banner__message"
            >${conflicts.messages[0]}</span
          >`
        : html`
            <div class="tl-conflict-banner__summary">
              <span
                >Multiple scheduling conflicts detected
                (${conflicts.messages.length} conflicts).</span
              >
              <button
                class="tl-conflict-details-toggle"
                @click=${() =>
                  (this._showConflictDetails = !this._showConflictDetails)}
              >
                ${detailsToggleLabel}
              </button>
            </div>
            ${detailsList}
          `;

    return html`
      <div class="tl-conflict-banner">
        <span class="tl-conflict-banner__icon">⚠</span>
        <div class="tl-conflict-banner__content">${contentHtml}</div>
        <button
          class="tl-conflict-banner__close"
          @click=${() => (this._isConflictsBannerDismissed = true)}
          aria-label="Dismiss warning"
        >
          ×
        </button>
      </div>
    `;
  }

  private _renderResourceHeaders(
    groups: { label: string; items: TimelineResource[] }[],
    resourceTrackMap: Map<
      string,
      { trackCount: number; eventTracks: Map<string, number> }
    >,
    visMinRowPx: number,
    visMaxRowPx: number,
  ) {
    let resY = 0;
    return groups.map((g) => {
      const labelHtml = g.label
        ? html`<div class="tl-res-group-label">${g.label}</div>`
        : nothing;
      if (g.label) resY += GROUP_LABEL_HEIGHT;

      const itemsHtml = g.items.map((r) => {
        const tracksCount = resourceTrackMap.get(r.id)?.trackCount || 1;
        const rowHeightPx = tracksCount * ROW_HEIGHT;
        const isVisible =
          resY + rowHeightPx >= visMinRowPx && resY <= visMaxRowPx;
        resY += rowHeightPx;

        if (!isVisible) {
          return html`<div
            class="tl-res-row"
            style="height: ${rowHeightPx}px"
          ></div>`;
        }

        return html`
          <div class="tl-res-row" style="height: ${rowHeightPx}px">
            ${this.renderAvatar(r)}
            <div class="tl-res-info">
              <span class="tl-res-name">${r.name}</span>
              <span class="tl-res-sub">${r.subtitle}</span>
            </div>
          </div>
        `;
      });

      return html`<div>${labelHtml}${itemsHtml}</div>`;
    });
  }

  private _renderEvent(
    ev: TimelineEvent,
    index: number,
    trackIndex: number,
    viewStartMs: number,
    pxPerMs: number,
    r: TimelineResource,
    conflicts: ConflictState,
  ) {
    const evTop = trackIndex * ROW_HEIGHT + 8;
    const evLeft = timestampToPx(ev.startMs, viewStartMs, pxPerMs);
    const evWidth = timestampToPx(ev.endMs, viewStartMs, pxPerMs) - evLeft;

    if (evWidth < 1) return nothing;

    const MIN_EVENT_PX = 24;
    const displayWidth = Math.max(evWidth, MIN_EVENT_PX);
    const isTiny = displayWidth < 60;
    const showTime = displayWidth >= 120;
    const tooltipLabel = `${ev.title} · ${fmt12(ev.startTime)} – ${fmt12(ev.endTime)}`;
    const zIndex = 10 + index;

    return html`
      <div
        class="tl-event tl-event--${ev.color} ${this._drag.isDraggingEvent(ev)
          ? "tl-event--dragging"
          : ""} ${isTiny
          ? "tl-event--tiny"
          : ""} ${conflicts.conflictingEventIds.has(ev.id)
          ? "tl-event--conflict"
          : ""}"
        style="top: ${evTop}px; bottom: auto; height: ${ROW_HEIGHT -
        16}px; left: ${evLeft}px; width: ${displayWidth}px; z-index: ${zIndex};"
        data-tooltip="${tooltipLabel}"
        @pointerdown=${(e: PointerEvent) =>
          this._onEventPointerDown(e, ev, r.id, evTop)}
        @click=${(e: Event) => this._handleEventClick(e, ev)}
      >
        <div
          class="tl-event-resize-handle tl-event-resize-handle--start"
          @pointerdown=${(e: PointerEvent) =>
            this._onResizePointerDown(e, ev, r.id, "start", evTop)}
        ></div>
        ${!isTiny
          ? html`<span class="tl-event__title">${ev.title}</span>`
          : nothing}
        ${conflicts.conflictingEventIds.has(ev.id)
          ? html`<span
              class="tl-event__conflict-dot"
              title="Conflict overlap detected"
            ></span>`
          : nothing}
        ${showTime
          ? html`<span class="tl-event__time"
              >${fmt12(ev.startTime)} – ${fmt12(ev.endTime)}</span
            >`
          : nothing}
        <div
          class="tl-event-resize-handle tl-event-resize-handle--end"
          @pointerdown=${(e: PointerEvent) =>
            this._onResizePointerDown(e, ev, r.id, "end", evTop)}
        ></div>
      </div>
    `;
  }

  private _renderResourceEvents(options: {
    groups: { label: string; items: TimelineResource[] }[];
    resourceTrackMap: Map<
      string,
      { trackCount: number; eventTracks: Map<string, number> }
    >;
    visMinRowPx: number;
    visMaxRowPx: number;
    visMinMs: number;
    visMaxMs: number;
    viewStartMs: number;
    pxPerMs: number;
    conflicts: ConflictState;
  }) {
    const {
      groups,
      resourceTrackMap,
      visMinRowPx,
      visMaxRowPx,
      visMinMs,
      visMaxMs,
      viewStartMs,
      pxPerMs,
      conflicts,
    } = options;
    let rowY = 0;
    return groups.map((g) => {
      const spacerHtml = g.label
        ? html`<div class="tl-group-spacer"></div>`
        : nothing;
      if (g.label) rowY += GROUP_LABEL_HEIGHT;

      const itemsHtml = g.items.map((r) => {
        const trackInfo = resourceTrackMap.get(r.id);
        const tracksCount = trackInfo?.trackCount || 1;
        const evTracks = trackInfo?.eventTracks;
        const rowHeightPx = tracksCount * ROW_HEIGHT;

        const isVisible =
          rowY + rowHeightPx >= visMinRowPx && rowY <= visMaxRowPx;
        rowY += rowHeightPx;

        if (!isVisible) {
          return html`<div
            class="tl-event-row"
            style="height: ${rowHeightPx}px"
            data-resource-id=${r.id}
          ></div>`;
        }

        const sortedEvents = r.events.filter(
          (ev) => ev.endMs >= visMinMs && ev.startMs <= visMaxMs,
        );

        return html`
          <div
            class="tl-event-row"
            style="height: ${rowHeightPx}px"
            data-resource-id=${r.id}
            @pointerdown=${(e: PointerEvent) => this._onRowPointerDown(e, r.id)}
          >
            ${sortedEvents.map((ev, index) => {
              const trackIndex = evTracks?.get(ev.id) || 0;
              return this._renderEvent(
                ev,
                index,
                trackIndex,
                viewStartMs,
                pxPerMs,
                r,
                conflicts,
              );
            })}
          </div>
        `;
      });

      return html`<div>${spacerHtml}${itemsHtml}</div>`;
    });
  }

  render() {
    const conflicts = this._cachedConflicts;
    const pxPerMs = this._pxPerMs;
    const viewStartMs = this._viewStartMs;
    const viewEndMs = this._getViewEndMs();
    const level = getActiveZoomLevel(pxPerMs);
    const tz = schedulerStore.getState().timezone;
    const totalW = this._totalWidth;

    const scrollLeft = this.gridScrollRef
      ? this.gridScrollRef.scrollLeft
      : this._scrollLeft;
    const clientWidth = this.gridScrollRef
      ? this.gridScrollRef.clientWidth
      : this._viewportWidth;
    const OVERSCAN_PX = 800;
    const visMinPx = Math.max(0, scrollLeft - OVERSCAN_PX);
    const visMaxPx = scrollLeft + clientWidth + OVERSCAN_PX;
    const visMinMs = pxToTimestamp(visMinPx, viewStartMs, pxPerMs);
    const visMaxMs = pxToTimestamp(visMaxPx, viewStartMs, pxPerMs);

    const { columns, superLabels } = this._getColumns(
      viewStartMs,
      viewEndMs,
      pxPerMs,
      level,
      tz,
    );
    const visColumns = columns.filter(
      (col) => col.px + col.width >= visMinPx && col.px <= visMaxPx,
    );
    const visSuperLabels = superLabels.filter(
      (sl) => sl.px + sl.width >= visMinPx && sl.px <= visMaxPx,
    );

    const nowMs = Date.now();
    const nowPx = timestampToPx(nowMs, viewStartMs, pxPerMs);

    const allResources = this.resources;
    const resourceTrackMap = this._cachedTrackMap;

    const groups: { label: string; items: TimelineResource[] }[] = [];
    let cur: (typeof groups)[0] | null = null;
    for (const r of allResources) {
      if (r.groupLabel) {
        cur = { label: r.groupLabel, items: [r] };
        groups.push(cur);
      } else if (cur) {
        cur.items.push(r);
      } else {
        cur = { label: "", items: [r] };
        groups.push(cur);
      }
    }

    const resourceLayout = this._computeResourceLayout(
      groups,
      resourceTrackMap,
    );
    this._drag.updateLayout(
      this.gridScrollRef,
      resourceLayout,
      pxPerMs,
      viewStartMs,
    );

    const scrollTop = this.gridScrollRef
      ? this.gridScrollRef.scrollTop
      : this._scrollTop;
    const clientHeight = this.gridScrollRef
      ? this.gridScrollRef.clientHeight
      : this._viewportHeight;
    const OVERSCAN_ROW_PX = 200;
    const visMinRowPx = Math.max(0, scrollTop - OVERSCAN_ROW_PX);
    const visMaxRowPx = scrollTop + clientHeight + OVERSCAN_ROW_PX;

    return html`
      <div
        class="tl-component-shell ${this.allowCreate
          ? "tl-component-shell--draw-mode"
          : ""}"
      >
        ${this._renderConflictBanner(conflicts)}
        <div class="tl-panel">
          <div class="tl-grid-wrap">
            <div class="tl-res-col" @scroll=${this._onResScroll}>
              <div
                class="tl-res-col__header"
                style="height: ${HOUR_HEADER_HEIGHT + SUPER_HEADER_HEIGHT}px"
              >
                RESOURCE
              </div>
              ${this._renderResourceHeaders(
                groups,
                resourceTrackMap,
                visMinRowPx,
                visMaxRowPx,
              )}
            </div>

            <div
              class="tl-time-scroll"
              @scroll=${this._onGridScroll}
              @wheel=${this._handleWheel}
            >
              <div class="tl-time-inner" style="width: ${totalW}px">
                ${visSuperLabels.length > 0
                  ? html`
                      <div class="tl-super-header">
                        ${visSuperLabels.map(
                          (sl) => html`
                            <div
                              class="tl-super-cell"
                              style="left: ${sl.px}px; width: ${sl.width}px;"
                            >
                              ${sl.label}
                            </div>
                          `,
                        )}
                      </div>
                    `
                  : html`<div class="tl-super-header"></div>`}

                <div class="tl-hour-header">
                  ${visColumns.map(
                    (col) => html`
                      <div
                        class="tl-hour-cell"
                        style="left: ${col.px}px; width: ${col.width}px;"
                      >
                        ${col.label}
                      </div>
                    `,
                  )}
                </div>

                <div class="tl-vlines-layer">
                  ${visColumns.map(
                    (col) =>
                      html`<div
                        class="tl-vline"
                        style="left: ${col.px}px"
                      ></div>`,
                  )}
                </div>

                ${nowPx >= visMinPx && nowPx <= visMaxPx
                  ? html`
                      <div class="tl-now-line" style="left: ${nowPx}px">
                        <span class="tl-now-dot"></span>
                      </div>
                    `
                  : nothing}
                ${this._renderResourceEvents({
                  groups,
                  resourceTrackMap,
                  visMinRowPx,
                  visMaxRowPx,
                  visMinMs,
                  visMaxMs,
                  viewStartMs,
                  pxPerMs,
                  conflicts,
                })}
                ${this._renderDragGhost()}
              </div>
            </div>
          </div>
        </div>

        ${this.showFab
          ? html`
              <button
                class="tl-fab"
                @click=${this._handleAddEvent}
                aria-label="Add event"
              >
                ${PlusIcon()}
              </button>
            `
          : nothing}
        ${this._showBlockedConflictDialog
          ? html`
              <div class="tl-alert-dialog-backdrop">
                <div
                  class="tl-alert-dialog"
                  role="alertdialog"
                  aria-modal="true"
                >
                  <div class="tl-alert-dialog__header">
                    <span class="tl-alert-dialog__title"
                      >Schedule Conflict Blocked</span
                    >
                  </div>
                  <div class="tl-alert-dialog__body">
                    <p>${this._blockedConflictMessage}</p>
                  </div>
                  <div class="tl-alert-dialog__footer">
                    <button
                      class="tl-alert-dialog__btn"
                      @click=${this._closeBlockedConflictDialog}
                    >
                      OK
                    </button>
                  </div>
                </div>
              </div>
            `
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "janus-timeline": JanusTimeline;
  }
}
