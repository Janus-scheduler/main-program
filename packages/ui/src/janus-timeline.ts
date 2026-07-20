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
} from "@janus-scheduler/core";
import "./janus-ai-bar";
import "./janus-topbar";

import { TimelineEvent, TimelineResource } from "./timeline-types";
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

@customElement("janus-timeline")
export class JanusTimeline extends LitElement {
  static styles = timelineStyles;

  @property({ type: Array }) resources: TimelineResource[] = [];
  /** When true, dragging on empty row space creates a new event. Default: false */
  @property({ type: Boolean, attribute: "allow-create" }) allowCreate = false;
  /** When true, renders a + Floating Action Button to add an event. Default: false */
  @property({ type: Boolean, attribute: "show-fab" }) showFab = false;
  @property({ type: Boolean, attribute: "prevent-conflicts" })
  preventConflicts = true;

  @state() private _showBlockedConflictDialog = false;
  @state() private _blockedConflictMessage = "";

  @state() view: "Timeline" | "Month" = "Timeline";
  @state() private _dragVersion = 0; // bumped to trigger re-render during drag
  @state() private _showConflictDetails = false;
  @state() private _isConflictsBannerDismissed = false;
  private _lastConflictIdsKey = "";
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

  private _drag = new TimelineDragController(() => {
    this._dragVersion++;
  });
  private _wasDragging = false;
  private _unsubStore?: () => void;
  /** Suppress scroll handler during programmatic scroll adjustments */
  private _suppressScroll = false;

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
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _syncFromStore(state: any) {
    const tz =
      (state.timezone as string) ||
      Intl.DateTimeFormat().resolvedOptions().timeZone;
    const newResources: TimelineResource[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawEvents = Object.values(state.events) as any[];
    const centerMs = this._viewStartMs || Date.now();
    const startRange = centerMs - 365 * 24 * 60 * 60 * 1000;
    const endRange = centerMs + 365 * 24 * 60 * 60 * 1000;
    const coreEvents = expandEvents(rawEvents, startRange, endRange);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coreResources = Object.values(state.resources) as any[];

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

    for (const res of coreResources) {
      const resEvents = coreEvents
        .filter(
          (e) =>
            (e.resourceIds && e.resourceIds.includes(res.id)) ||
            e.resourceId === res.id,
        )
        .map((e) => {
          const startD = new Date(e.startTime);
          const endD = new Date(e.endTime);
          const { time: startTime } = isoToZonedDisplay(e.startTime, tz);
          const { time: endTime, date } = isoToZonedDisplay(e.endTime, tz);
          return {
            id: e.id,
            title: e.title,
            startTime,
            endTime,
            startMs: startD.getTime(),
            endMs: endD.getTime(),
            color: e.color || "blue",
            date,
            resourceId: res.id,
          } as TimelineEvent;
        });

      let avatarType: "initials" | "icon" = "initials";
      let avatarIcon: "room" | "equipment" | undefined = undefined;
      let groupLabel: string | undefined = undefined;

      const type = res.type || "person";

      if (type !== currentGroupType) {
        currentGroupType = type;
        if (type === "person") groupLabel = "STAFF";
        else if (type === "room") groupLabel = "ROOMS";
        else if (type === "equipment") groupLabel = "EQUIPMENT";
      }

      if (type === "room") {
        avatarType = "icon";
        avatarIcon = "room";
      } else if (type === "equipment") {
        avatarType = "icon";
        avatarIcon = "equipment";
      }

      newResources.push({
        id: res.id,
        name: res.name,
        subtitle:
          res.type === "person"
            ? "Staff"
            : res.type === "room"
              ? "Facility"
              : "Equipment",
        avatarType,
        avatarIcon,
        groupLabel,
        events: resEvents,
      });
    }

    if (newResources.length > 0) {
      this.resources = newResources;
    }
  }

  willUpdate(changedProperties: Map<string, unknown>) {
    super.willUpdate(changedProperties);
    if (
      changedProperties.has("resources") ||
      changedProperties.has("preventConflicts") ||
      (this._cachedConflicts.conflictingEventIds.size === 0 &&
        this.resources.length > 0)
    ) {
      const conflictResources = this.resources as unknown as ConflictResource[];
      const tz = schedulerStore.getState().timezone;
      this._cachedConflicts = computeTimelineConflicts(conflictResources, tz);

      const currentIdsKey = Array.from(
        this._cachedConflicts.conflictingEventIds,
      )
        .sort()
        .join(",");
      if (currentIdsKey !== this._lastConflictIdsKey) {
        this._isConflictsBannerDismissed = false;
        this._lastConflictIdsKey = currentIdsKey;
      }
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
  }

  firstUpdated() {
    // Center on today at current time
    const now = new Date();
    this._initializeView(now.getTime());
  }

  /**
   * Initialize (or re-center) the timeline around a timestamp.
   * Sets _viewStartMs so that `centerMs` is at the middle of the container.
   */
  private _initializeView(centerMs: number) {
    // Content spans CONTENT_HALF_WIDTH * 2 pixels = 20000px total
    this._viewStartMs = centerMs - CONTENT_HALF_WIDTH / this._pxPerMs;
    this.requestUpdate();

    requestAnimationFrame(() => {
      if (!this.gridScrollRef) return;
      // Scroll to center of the content
      const containerWidth = this.gridScrollRef.clientWidth;
      this._suppressScroll = true;
      this.gridScrollRef.scrollLeft = CONTENT_HALF_WIDTH - containerWidth / 2;
      this._suppressScroll = false;
    });

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
    // Sync vertical scroll between resource column and time grid
    if (this.resColRef && this.gridScrollRef) {
      if (this.resColRef.scrollTop !== this.gridScrollRef.scrollTop) {
        this.resColRef.scrollTop = this.gridScrollRef.scrollTop;
      }
    }

    // Skip re-centering during programmatic scroll adjustments
    if (this._suppressScroll) return;

    // Infinite scroll: when user nears the edges, re-center the content
    if (this.gridScrollRef) {
      const sl = this.gridScrollRef.scrollLeft;
      const containerWidth = this.gridScrollRef.clientWidth;
      const maxScroll = this._totalWidth - containerWidth;

      // If within 15% of either edge, re-center
      const edgeThreshold = maxScroll * 0.15;
      if (sl < edgeThreshold || sl > maxScroll - edgeThreshold) {
        const currentCenterMs = this._getVisibleCenterMs();
        this._initializeView(currentCenterMs);
      }
    }
    this._emitNavChange();
  }

  private _onResScroll() {
    if (this.resColRef && this.gridScrollRef) {
      if (this.gridScrollRef.scrollTop !== this.resColRef.scrollTop) {
        this.gridScrollRef.scrollTop = this.resColRef.scrollTop;
      }
    }
  }

  private _emitNavChange() {
    const visibleCenter = this._getVisibleCenterMs();
    const level = getActiveZoomLevel(this._pxPerMs);
    const tz = getBrowserTimezone();
    const navLabel = formatNavDate(visibleCenter, level, tz);

    const d = new Date(visibleCenter);
    const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
    const shortDate = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

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

  public setView(v: "Timeline" | "Month") {
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
    const pointerX = e.clientX - rect.left;

    // 1. What timestamp is currently under the pointer?
    const pointerPx = container.scrollLeft + pointerX;
    const timeUnderCursorMs = this._viewStartMs + pointerPx / this._pxPerMs;

    // 2. Compute new pxPerMs (smooth clamping)
    const direction = e.deltaY < 0 ? 1 : -1; // scroll up = zoom in
    const newPxPerMs = Math.min(
      MAX_PX_PER_MS,
      Math.max(
        MIN_PX_PER_MS,
        this._pxPerMs * (1 + direction * ZOOM_SCALE_FACTOR),
      ),
    );

    // 3. Adjust viewStartMs so the time under cursor stays at the same pixel
    //    timeUnderCursorMs = newViewStartMs + pointerPx / newPxPerMs
    //    But pointerPx changes because scrollLeft stays the same, so:
    //    We want: after zoom, the cursor still points to timeUnderCursorMs
    //    newViewStartMs = timeUnderCursorMs - pointerPx_new / newPxPerMs
    //    We need to find what pointerPx_new should be. For cursor anchoring:
    //    newViewStartMs = timeUnderCursorMs - (scrollLeft + pointerX) / newPxPerMs
    //    But we can simplify: keep scrollLeft + pointerX pointing to the same time
    const newViewStartMs = timeUnderCursorMs - pointerPx / newPxPerMs;

    // 4. Apply
    this._pxPerMs = newPxPerMs;
    this._viewStartMs = newViewStartMs;

    // No need to adjust scrollLeft — the content re-renders around the new viewStartMs
    // and the scroll position naturally keeps the cursor pointing to the same time

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

  private _addDragUpListener() {
    const handler = (_e: PointerEvent) => {
      document.removeEventListener("pointerup", handler);
      const result = this._drag.completeAndGetResult();
      if (result) {
        this._wasDragging = true;

        let hasConflict = false;
        let targetResId = "";
        let actionVerb = "";

        if (result.type === "event-move") {
          const { event, newResourceId, newStartTime, newEndTime } =
            result.detail;
          targetResId = newResourceId;
          actionVerb = "move";
          const startMs = new Date(newStartTime).getTime();
          const endMs = new Date(newEndTime).getTime();

          const resource = this.resources.find((r) => r.id === newResourceId);
          if (resource) {
            hasConflict = checkSlotConflict(
              resource.events as unknown as any[],
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
              resource.events as unknown as any[],
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
            hasConflict = checkSlotConflict(
              resource.events as unknown as any[],
              startMs,
              endMs,
            );
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
    };
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
        layout.push({ id: r.id, yOffset: y, index: idx });
        const tracks = resourceTrackMap.get(r.id)?.trackCount || 1;
        y += ROW_HEIGHT * tracks;
        idx++;
      }
    }
    return layout;
  }

  // ── Rendering helpers ─────────────────────────────────────────────

  private renderAvatar(r: TimelineResource) {
    if (r.avatarType === "initials") {
      return html`<span
        class="tl-avatar tl-avatar--initials"
        style="background: ${avatarColor(r.id)}"
        >${getInitials(r.name)}</span
      >`;
    }
    return html`
      <span class="tl-avatar tl-avatar--icon tl-avatar--${r.avatarIcon}">
        ${r.avatarIcon === "room" ? RoomIcon() : EquipmentIcon()}
      </span>
    `;
  }

  private _renderDragGhost() {
    if (!this._drag.active) return nothing;
    void this._dragVersion;
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
      ? checkSlotConflict(
          resource.events as unknown as any[],
          ghostStartMs,
          ghostEndMs,
          eventId,
        )
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

  render() {
    const conflicts = this._cachedConflicts;
    const pxPerMs = this._pxPerMs;
    const viewStartMs = this._viewStartMs;
    const viewEndMs = this._getViewEndMs();
    const level = getActiveZoomLevel(pxPerMs);

    const tz = schedulerStore.getState().timezone;

    // Generate columns and super-labels (timezone-aware)
    const columns = generateColumns(viewStartMs, viewEndMs, pxPerMs, level, tz);
    const superLabels = generateSuperLabels(
      viewStartMs,
      viewEndMs,
      pxPerMs,
      level,
      tz,
    );

    // Total width of the rendered content (fixed)
    const totalW = this._totalWidth;

    // Current-time indicator
    const nowMs = Date.now();
    const nowPx = timestampToPx(nowMs, viewStartMs, pxPerMs);

    // Collect all events from all resources
    const allResources = this.resources;

    const resourceTrackMap = new Map<
      string,
      { trackCount: number; eventTracks: Map<string, number> }
    >();
    for (const r of allResources) {
      const sorted = [...r.events].sort((a, b) => a.startMs - b.startMs);
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
      resourceTrackMap.set(r.id, {
        trackCount: Math.max(1, tracks.length),
        eventTracks,
      });
    }

    // Grouping
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

    // Filter events to those visible in the current viewport (with margin)
    const visibleResources = allResources.map((r) => ({
      ...r,
      events: r.events.filter(
        (ev) => ev.endMs > viewStartMs && ev.startMs < viewEndMs,
      ),
    }));

    // Re-group with visible events
    const visGroups: { label: string; items: TimelineResource[] }[] = [];
    let visCur: (typeof visGroups)[0] | null = null;
    for (const r of visibleResources) {
      const orig = allResources.find((o) => o.id === r.id);
      if (orig?.groupLabel) {
        visCur = { label: orig.groupLabel, items: [r] };
        visGroups.push(visCur);
      } else if (visCur) {
        visCur.items.push(r);
      } else {
        visCur = { label: "", items: [r] };
        visGroups.push(visCur);
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

    return html`
      <div
        class="tl-component-shell ${this.allowCreate
          ? "tl-component-shell--draw-mode"
          : ""}"
      >
        <!-- Conflict warning banner -->
        ${conflicts.hasConflict && !this._isConflictsBannerDismissed
          ? html`
              <div class="tl-conflict-banner">
                <span class="tl-conflict-banner__icon">⚠</span>
                <div class="tl-conflict-banner__content">
                  ${conflicts.messages.length === 1
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
                              (this._showConflictDetails =
                                !this._showConflictDetails)}
                          >
                            ${this._showConflictDetails
                              ? "Hide Details"
                              : "Show Details"}
                          </button>
                        </div>
                        ${this._showConflictDetails
                          ? html`
                              <ul class="tl-conflict-details-list">
                                ${conflicts.messages.map(
                                  (msg) => html`<li>${msg}</li>`,
                                )}
                              </ul>
                            `
                          : nothing}
                      `}
                </div>
                <button
                  class="tl-conflict-banner__close"
                  @click=${() => (this._isConflictsBannerDismissed = true)}
                  aria-label="Dismiss warning"
                >
                  ×
                </button>
              </div>
            `
          : nothing}
        <div class="tl-panel">
          <div class="tl-grid-wrap">
            <div class="tl-res-col" @scroll=${this._onResScroll}>
              <div
                class="tl-res-col__header"
                style="height: ${HOUR_HEADER_HEIGHT + SUPER_HEADER_HEIGHT}px"
              >
                RESOURCE
              </div>
              ${groups.map(
                (g) => html`
                  <div>
                    ${g.label
                      ? html`<div class="tl-res-group-label">${g.label}</div>`
                      : nothing}
                    ${g.items.map((r) => {
                      const tracksCount =
                        resourceTrackMap.get(r.id)?.trackCount || 1;
                      const rowHeightPx = tracksCount * ROW_HEIGHT;
                      return html`
                        <div
                          class="tl-res-row"
                          style="height: ${rowHeightPx}px"
                        >
                          ${this.renderAvatar(r)}
                          <div class="tl-res-info">
                            <span class="tl-res-name">${r.name}</span>
                            <span class="tl-res-sub">${r.subtitle}</span>
                          </div>
                        </div>
                      `;
                    })}
                  </div>
                `,
              )}
            </div>

            <div
              class="tl-time-scroll"
              @scroll=${this._onGridScroll}
              @wheel=${this._handleWheel}
            >
              <div class="tl-time-inner" style="width: ${totalW}px">
                <!-- Super header row -->
                ${superLabels.length > 0
                  ? html`
                      <div class="tl-super-header">
                        ${superLabels.map(
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

                <!-- Column headers -->
                <div class="tl-hour-header">
                  ${columns.map(
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

                <!-- Now line -->
                ${nowPx > 0 && nowPx < totalW
                  ? html`
                      <div class="tl-now-line" style="left: ${nowPx}px">
                        <span class="tl-now-dot"></span>
                      </div>
                    `
                  : nothing}

                <!-- Resource rows with events -->
                ${visGroups.map(
                  (g) => html`
                    <div>
                      ${g.label
                        ? html`<div class="tl-group-spacer"></div>`
                        : nothing}
                      ${g.items.map((r) => {
                        const trackInfo = resourceTrackMap.get(r.id);
                        const tracksCount = trackInfo?.trackCount || 1;
                        const evTracks = trackInfo?.eventTracks;
                        const rowHeightPx = tracksCount * ROW_HEIGHT;
                        return html`
                          <div
                            class="tl-event-row"
                            style="height: ${rowHeightPx}px"
                            data-resource-id=${r.id}
                            @pointerdown=${(e: PointerEvent) =>
                              this._onRowPointerDown(e, r.id)}
                          >
                            <!-- Column grid lines -->
                            ${columns.map(
                              (col) =>
                                html`<div
                                  class="tl-vline"
                                  style="left: ${col.px}px"
                                ></div>`,
                            )}
                            <!-- Events -->
                            ${(() => {
                              const sortedEvents = [...r.events].sort(
                                (a, b) => a.startMs - b.startMs,
                              );

                              return sortedEvents.map((ev, index) => {
                                const trackIndex = evTracks?.get(ev.id) || 0;
                                const evTop = trackIndex * ROW_HEIGHT + 8;

                                const evLeft = timestampToPx(
                                  ev.startMs,
                                  viewStartMs,
                                  pxPerMs,
                                );
                                const evWidth =
                                  timestampToPx(
                                    ev.endMs,
                                    viewStartMs,
                                    pxPerMs,
                                  ) - evLeft; // width based on time
                                // Don't render events that are too small to see
                                if (evWidth < 1) return nothing;

                                // Always enforce a minimum visual width so events remain
                                // visible and clickable at every zoom level.
                                const MIN_EVENT_PX = 24;
                                const displayWidth = Math.max(
                                  evWidth,
                                  MIN_EVENT_PX,
                                );
                                const isTiny = displayWidth < 60;
                                const showTime = displayWidth >= 120;
                                const tooltipLabel = `${ev.title} · ${fmt12(ev.startTime)} – ${fmt12(ev.endTime)}`;

                                const zIndex = 10 + index;

                                return html`
                                  <div
                                    class="tl-event tl-event--${ev.color} ${this._drag.isDraggingEvent(
                                      ev,
                                    )
                                      ? "tl-event--dragging"
                                      : ""} ${isTiny
                                      ? "tl-event--tiny"
                                      : ""} ${conflicts.conflictingEventIds.has(
                                      ev.id,
                                    )
                                      ? "tl-event--conflict"
                                      : ""}"
                                    style="top: ${evTop}px; bottom: auto; height: ${ROW_HEIGHT -
                                    16}px; left: ${evLeft}px; width: ${displayWidth}px; z-index: ${zIndex};"
                                    data-tooltip="${tooltipLabel}"
                                    @pointerdown=${(e: PointerEvent) =>
                                      this._onEventPointerDown(
                                        e,
                                        ev,
                                        r.id,
                                        evTop,
                                      )}
                                    @click=${(e: Event) =>
                                      this._handleEventClick(e, ev)}
                                  >
                                    <div
                                      class="tl-event-resize-handle tl-event-resize-handle--start"
                                      @pointerdown=${(e: PointerEvent) =>
                                        this._onResizePointerDown(
                                          e,
                                          ev,
                                          r.id,
                                          "start",
                                          evTop,
                                        )}
                                    ></div>
                                    ${!isTiny
                                      ? html`<span class="tl-event__title"
                                          >${ev.title}</span
                                        >`
                                      : nothing}
                                    ${conflicts.conflictingEventIds.has(ev.id)
                                      ? html`<span
                                          class="tl-event__conflict-dot"
                                          title="Conflict overlap detected"
                                        ></span>`
                                      : nothing}
                                    ${showTime
                                      ? html`<span class="tl-event__time"
                                          >${fmt12(ev.startTime)} –
                                          ${fmt12(ev.endTime)}</span
                                        >`
                                      : nothing}
                                    <div
                                      class="tl-event-resize-handle tl-event-resize-handle--end"
                                      @pointerdown=${(e: PointerEvent) =>
                                        this._onResizePointerDown(
                                          e,
                                          ev,
                                          r.id,
                                          "end",
                                          evTop,
                                        )}
                                    ></div>
                                  </div>
                                `;
                              });
                            })()}
                          </div>
                        `;
                      })}
                    </div>
                  `,
                )}
                ${this._renderDragGhost()}
              </div>
            </div>
          </div>
        </div>

        <!-- FAB -->
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

        <!-- Blocked Conflict Alert Dialog -->
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
