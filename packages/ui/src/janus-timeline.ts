import { LitElement, html, nothing } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";
import { timelineStyles } from "./timeline-styles";
import { schedulerStore, isoToZonedDisplay } from "@janus-scheduler/core";
import "./janus-ai-bar";

import { TimelineEvent, TimelineResource } from "./timeline-types";
import {
  RoomIcon,
  EquipmentIcon,
  ChevronLeft,
  ChevronRight,
  SearchIcon,
  BellIcon,
  PlusIcon,
  PencilRulerIcon,
} from "./timeline-icons";
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
} from "./timeline-zoom";
import { TimelineDragController, ResourceLayout } from "./timeline-drag";

@customElement("janus-timeline")
export class JanusTimeline extends LitElement {
  static styles = timelineStyles;

  @property({ type: Array }) resources: TimelineResource[] = [];
  /** When true, dragging on empty row space creates a new event. Default: false */
  @property({ type: Boolean, attribute: "allow-create" }) allowCreate = false;

  @state() view: "Timeline" | "Month" = "Timeline";
  @state() private _dragVersion = 0; // bumped to trigger re-render during drag

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
    const coreEvents = Object.values(state.events) as any[];
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
            color: "blue",
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
      this.resColRef.scrollTop = this.gridScrollRef.scrollTop;
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
  }

  // ── Navigation ────────────────────────────────────────────────────

  private _goToPrev() {
    const level = getActiveZoomLevel(this._pxPerMs);
    const currentCenter = this._getVisibleCenterMs();
    this._initializeView(currentCenter - getNavStepMs(level));
  }

  private _goToNext() {
    const level = getActiveZoomLevel(this._pxPerMs);
    const currentCenter = this._getVisibleCenterMs();
    this._initializeView(currentCenter + getNavStepMs(level));
  }

  private _goToToday() {
    this._pxPerMs = DEFAULT_PX_PER_MS; // reset zoom to default
    this._initializeView(Date.now());
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

  private _handleViewSwitch(v: "Timeline" | "Month") {
    this.view = v;
    this.dispatchEvent(
      new CustomEvent("view-change", {
        detail: { view: v },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _toggleCreate() {
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
  ) {
    if (e.button !== 0) return;
    this._drag.startMove(e, ev, resourceId);
    this._addDragUpListener();
  }

  private _onResizePointerDown(
    e: PointerEvent,
    ev: TimelineEvent,
    resourceId: string,
    edge: "start" | "end",
  ) {
    if (e.button !== 0) return;
    this._drag.startResize(e, ev, resourceId, edge);
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
        this.dispatchEvent(
          new CustomEvent(result.type, {
            detail: result.detail,
            bubbles: true,
            composed: true,
          }),
        );
      }
    };
    document.addEventListener("pointerup", handler);
  }

  // ── Resource layout computation ───────────────────────────────────

  private _computeResourceLayout(
    groups: { label: string; items: TimelineResource[] }[],
  ): ResourceLayout[] {
    const layout: ResourceLayout[] = [];
    let y = HOUR_HEADER_HEIGHT + SUPER_HEADER_HEIGHT;
    let idx = 0;
    for (const g of groups) {
      if (g.label) y += GROUP_LABEL_HEIGHT;
      for (const r of g.items) {
        layout.push({ id: r.id, yOffset: y, index: idx });
        y += ROW_HEIGHT;
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
    return html`
      <div
        class="tl-drag-ghost tl-drag-ghost--${g.color}"
        style="left: ${g.left}px; top: ${g.top}px; width: ${g.width}px;"
      >
        <span class="tl-drag-ghost__title">${g.title}</span>
        <span class="tl-drag-ghost__time">${g.timeLabel}</span>
      </div>
    `;
  }

  /** Compute zoom percentage for display */
  private _zoomPercent(): number {
    return Math.round((this._pxPerMs / DEFAULT_PX_PER_MS) * 100);
  }

  render() {
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

    // Update drag controller
    const resourceLayout = this._computeResourceLayout(groups);
    this._drag.updateLayout(
      this.gridScrollRef,
      resourceLayout,
      pxPerMs,
      viewStartMs,
    );

    // Nav label (timezone-aware)
    const visibleCenter = this._getVisibleCenterMs();
    const navLabel = formatNavDate(visibleCenter, level, tz);

    return html`
      <div class="tl-component-shell">
        <header class="tl-topbar">
          <nav class="tl-nav">
            <button
              class="tl-nav__arrow"
              aria-label="Previous"
              @click=${this._goToPrev}
            >
              ${ChevronLeft()}
            </button>
            <button class="tl-nav__today" @click=${this._goToToday}>
              Today
            </button>
            <button
              class="tl-nav__arrow"
              aria-label="Next"
              @click=${this._goToNext}
            >
              ${ChevronRight()}
            </button>
            <span class="tl-nav__date">${navLabel}</span>
            <span class="tl-nav__date--short">${navLabel}</span>
          </nav>
          <div class="tl-topbar__right">
            ${this._zoomPercent() !== 100
              ? html`<span class="tl-zoom-badge"
                  >${this._zoomPercent()}% · ${level.unit}</span
                >`
              : nothing}
            <div class="tl-view-toggle">
              ${(["Timeline", "Month"] as const).map(
                (v) => html`
                  <button
                    class="tl-view-toggle__btn ${this.view === v
                      ? "active"
                      : ""}"
                    @click=${() => this._handleViewSwitch(v)}
                  >
                    ${v}
                  </button>
                `,
              )}
            </div>
            <button
              class="tl-icon-btn tl-draw-toggle ${this.allowCreate
                ? "tl-draw-toggle--active"
                : ""}"
              aria-label="Toggle draw-to-create"
              data-tooltip="${this.allowCreate
                ? "Draw Event ON — click to disable"
                : "Draw Event OFF — drag on empty space to create an event"}"
              @click=${this._toggleCreate}
            >
              ${PencilRulerIcon()}
            </button>
            <button class="tl-icon-btn" aria-label="Search">
              ${SearchIcon()}
            </button>
            <button
              class="tl-icon-btn tl-icon-btn--bell"
              aria-label="Notifications"
            >
              ${BellIcon()}
              <span class="tl-bell-dot"></span>
            </button>
          </div>
        </header>

        <div class="tl-panel">
          <div class="tl-grid-wrap">
            <div class="tl-res-col" @scroll=${(e: Event) => e.preventDefault()}>
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
                    ${g.items.map(
                      (r) => html`
                        <div class="tl-res-row">
                          ${this.renderAvatar(r)}
                          <div class="tl-res-info">
                            <span class="tl-res-name">${r.name}</span>
                            <span class="tl-res-sub">${r.subtitle}</span>
                          </div>
                        </div>
                      `,
                    )}
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
                      ${g.items.map(
                        (r) => html`
                          <div
                            class="tl-event-row"
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
                            ${r.events.map((ev) => {
                              const evLeft = timestampToPx(
                                ev.startMs,
                                viewStartMs,
                                pxPerMs,
                              );
                              const evWidth =
                                timestampToPx(ev.endMs, viewStartMs, pxPerMs) -
                                evLeft;
                              // Don't render events that are too small to see
                              if (evWidth < 2) return nothing;
                              return html`
                                <div
                                  class="tl-event tl-event--${ev.color} ${this._drag.isDraggingEvent(
                                    ev,
                                  )
                                    ? "tl-event--dragging"
                                    : ""}"
                                  style="left: ${evLeft +
                                  2}px; width: ${Math.max(evWidth - 6, 4)}px;"
                                  @pointerdown=${(e: PointerEvent) =>
                                    this._onEventPointerDown(e, ev, r.id)}
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
                                      )}
                                  ></div>
                                  <span class="tl-event__title"
                                    >${ev.title}</span
                                  >
                                  ${evWidth > 80
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
                                      )}
                                  ></div>
                                </div>
                              `;
                            })}
                          </div>
                        `,
                      )}
                    </div>
                  `,
                )}
                ${this._renderDragGhost()}
              </div>
            </div>
          </div>
        </div>

        <button
          class="tl-fab"
          @click=${this._handleAddEvent}
          aria-label="Add event"
        >
          ${PlusIcon()}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "janus-timeline": JanusTimeline;
  }
}
