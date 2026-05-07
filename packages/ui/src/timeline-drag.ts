import { TimelineEvent } from "./timeline-types";
import {
  DEFAULT_HOUR_WIDTH,
  HOUR_START,
  ROW_HEIGHT,
  DRAG_THRESHOLD,
  toMin,
  pxToMinutes,
  snapMinutes,
  minutesToTimeStr,
  fmt12,
} from "./timeline-utils";

export type DragMode =
  | "idle"
  | "moving"
  | "resize-start"
  | "resize-end"
  | "creating";

export interface ResourceLayout {
  id: string;
  yOffset: number;
  index: number;
}

export interface DragGhost {
  left: number;
  top: number;
  width: number;
  color: string;
  timeLabel: string;
  title: string;
}

/**
 * TimelineDragController
 *
 * Manages all drag interactions on the timeline grid using native
 * pointer events. Tracks a simple state machine (idle → dragging → idle)
 * and computes ghost positions with 15-minute snapping.
 *
 * The controller does NOT mutate data — it returns event detail objects
 * that the host component dispatches as CustomEvents.
 */
export class TimelineDragController {
  mode: DragMode = "idle";
  active = false;

  // Ghost rendering info (read by host for template)
  ghost: DragGhost = {
    left: 0,
    top: 0,
    width: 0,
    color: "orange",
    timeLabel: "",
    title: "",
  };

  // Internal tracking
  private _event: TimelineEvent | null = null;
  private _originResourceId = "";
  private _targetResourceId = "";
  private _startClientX = 0;
  private _startClientY = 0;
  private _originalLeft = 0;
  private _originalWidth = 0;
  private _resourceLayout: ResourceLayout[] = [];
  private _scrollContainer: HTMLElement | null = null;
  private _requestUpdate: () => void;
  private _hourWidth: number = DEFAULT_HOUR_WIDTH;

  // Bound handler for cleanup
  private _boundMove: (e: PointerEvent) => void;

  constructor(requestUpdate: () => void) {
    this._requestUpdate = requestUpdate;
    this._boundMove = this._onPointerMove.bind(this);
  }

  /** Must be called each render with current layout info */
  updateLayout(
    scrollContainer: HTMLElement | null,
    resourceLayout: ResourceLayout[],
    hourWidth: number = DEFAULT_HOUR_WIDTH,
  ) {
    this._scrollContainer = scrollContainer;
    this._resourceLayout = resourceLayout;
    this._hourWidth = hourWidth;
  }

  /** True if an event is the one currently being dragged */
  isDraggingEvent(ev: TimelineEvent): boolean {
    return this.active && this._event?.id === ev.id && this.mode === "moving";
  }

  // ── Start handlers ──────────────────────────────────────────────────

  startMove(e: PointerEvent, ev: TimelineEvent, resourceId: string) {
    e.stopPropagation();
    e.preventDefault();
    this.mode = "moving";
    this._event = ev;
    this._originResourceId = resourceId;
    this._targetResourceId = resourceId;

    const hw = this._hourWidth;
    const evLeft = ((toMin(ev.startTime) - HOUR_START * 60) / 60) * hw + 2;
    const evWidth = ((toMin(ev.endTime) - toMin(ev.startTime)) / 60) * hw - 6;

    this._originalLeft = evLeft;
    this._originalWidth = evWidth;
    this._startClientX = e.clientX;
    this._startClientY = e.clientY;

    this._addMoveListener();
  }

  startResize(
    e: PointerEvent,
    ev: TimelineEvent,
    resourceId: string,
    edge: "start" | "end",
  ) {
    e.stopPropagation();
    e.preventDefault();
    this.mode = edge === "start" ? "resize-start" : "resize-end";
    this._event = ev;
    this._originResourceId = resourceId;
    this._targetResourceId = resourceId;

    const hw = this._hourWidth;
    const evLeft = ((toMin(ev.startTime) - HOUR_START * 60) / 60) * hw + 2;
    const evWidth = ((toMin(ev.endTime) - toMin(ev.startTime)) / 60) * hw - 6;

    this._originalLeft = evLeft;
    this._originalWidth = evWidth;
    this._startClientX = e.clientX;
    this._startClientY = e.clientY;

    this._addMoveListener();
  }

  startCreate(e: PointerEvent, resourceId: string) {
    // Only start if click was on the row background, not on an event
    const target = e.target as HTMLElement;
    if (target.closest(".tl-event")) return;

    e.preventDefault();
    this.mode = "creating";
    this._event = null;
    this._originResourceId = resourceId;
    this._targetResourceId = resourceId;
    this._startClientX = e.clientX;
    this._startClientY = e.clientY;

    // Compute the starting X in the time grid
    if (this._scrollContainer) {
      const rect = this._scrollContainer.getBoundingClientRect();
      this._originalLeft =
        e.clientX - rect.left + this._scrollContainer.scrollLeft;
    }
    this._originalWidth = 0;

    this._addMoveListener();
  }

  // ── Pointer event handlers ──────────────────────────────────────────

  private _onPointerMove(e: PointerEvent) {
    const dx = e.clientX - this._startClientX;
    const dy = e.clientY - this._startClientY;

    // Check threshold before activating
    if (!this.active) {
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
        return;
      }
      this.active = true;
      document.body.style.userSelect = "none";
      document.body.style.cursor =
        this.mode === "moving"
          ? "grabbing"
          : this.mode === "creating"
            ? "crosshair"
            : "col-resize";
    }

    // Compute ghost position
    switch (this.mode) {
      case "moving":
        this._computeMoveGhost(dx, e);
        break;
      case "resize-start":
        this._computeResizeStartGhost(dx);
        break;
      case "resize-end":
        this._computeResizeEndGhost(dx);
        break;
      case "creating":
        this._computeCreateGhost(e);
        break;
    }

    this._requestUpdate();
  }

  /**
   * Complete the drag and return the event detail to dispatch.
   * Called by the host in the pointerup handler.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  completeAndGetResult(): { type: string; detail: any } | null {
    this._removeMoveListener();
    document.body.style.userSelect = "";
    document.body.style.cursor = "";

    const wasActive = this.active;
    const result = wasActive ? this._computeResult() : null;

    this.mode = "idle";
    this.active = false;
    this._requestUpdate();

    return result;
  }

  cancel() {
    this._removeMoveListener();
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    this.mode = "idle";
    this.active = false;
    this._requestUpdate();
  }

  // ── Ghost computation ───────────────────────────────────────────────

  private _computeMoveGhost(dx: number, e: PointerEvent) {
    const hw = this._hourWidth;
    const newLeft = this._originalLeft + dx;
    const ev = this._event!;
    const duration = toMin(ev.endTime) - toMin(ev.startTime);

    // Snap the start time
    const rawStartMin = pxToMinutes(newLeft - 2, hw);
    const snappedStart = snapMinutes(rawStartMin);
    const snappedEnd = snappedStart + duration;

    // Find target resource using the pointer's actual Y position
    // relative to the scroll container's content area
    const targetRow = this._findRowFromPointerY(e.clientY);
    this._targetResourceId = targetRow.id;

    this.ghost = {
      left: (snappedStart / 60) * hw + 2,
      top: targetRow.yOffset + 8,
      width: (duration / 60) * hw - 6,
      color: ev.color,
      timeLabel: `${fmt12(minutesToTimeStr(snappedStart))} – ${fmt12(minutesToTimeStr(snappedEnd))}`,
      title: ev.title,
    };
  }

  private _computeResizeStartGhost(dx: number) {
    const hw = this._hourWidth;
    const ev = this._event!;
    const newLeft = this._originalLeft + dx;
    const rightEdge = this._originalLeft + this._originalWidth;

    const rawStartMin = pxToMinutes(newLeft - 2, hw);
    const snappedStart = snapMinutes(rawStartMin);
    const endMin = toMin(ev.endTime);

    // Don't allow start to go past end (min 15 min event)
    const clampedStart = Math.min(snappedStart, endMin - 15);
    const snappedLeft = (clampedStart / 60) * hw + 2;
    const newWidth = rightEdge - snappedLeft;

    const rowEntry = this._resourceLayout.find(
      (r) => r.id === this._originResourceId,
    );

    this.ghost = {
      left: snappedLeft,
      top: (rowEntry?.yOffset ?? 0) + 8,
      width: Math.max(newWidth, 20),
      color: ev.color,
      timeLabel: `${fmt12(minutesToTimeStr(clampedStart))} – ${fmt12(ev.endTime)}`,
      title: ev.title,
    };
  }

  private _computeResizeEndGhost(dx: number) {
    const hw = this._hourWidth;
    const ev = this._event!;
    const newWidth = this._originalWidth + dx;

    const startMin = toMin(ev.startTime);
    const rawEndMin = startMin + pxToMinutes(newWidth + 6, hw);
    const snappedEnd = snapMinutes(rawEndMin);

    // Don't allow end to go before start (min 15 min event)
    const clampedEnd = Math.max(snappedEnd, startMin + 15);

    const rowEntry = this._resourceLayout.find(
      (r) => r.id === this._originResourceId,
    );

    this.ghost = {
      left: this._originalLeft,
      top: (rowEntry?.yOffset ?? 0) + 8,
      width: ((clampedEnd - startMin) / 60) * hw - 6,
      color: ev.color,
      timeLabel: `${fmt12(ev.startTime)} – ${fmt12(minutesToTimeStr(clampedEnd))}`,
      title: ev.title,
    };
  }

  private _computeCreateGhost(e: PointerEvent) {
    if (!this._scrollContainer) return;
    const hw = this._hourWidth;

    const rect = this._scrollContainer.getBoundingClientRect();
    const currentX = e.clientX - rect.left + this._scrollContainer.scrollLeft;

    const startPx = Math.min(this._originalLeft, currentX);
    const endPx = Math.max(this._originalLeft, currentX);

    const rawStartMin = pxToMinutes(startPx, hw);
    const rawEndMin = pxToMinutes(endPx, hw);
    const snappedStart = snapMinutes(rawStartMin);
    const snappedEnd = Math.max(snapMinutes(rawEndMin), snappedStart + 15);

    const rowEntry = this._resourceLayout.find(
      (r) => r.id === this._originResourceId,
    );

    this.ghost = {
      left: (snappedStart / 60) * hw,
      top: (rowEntry?.yOffset ?? 0) + 8,
      width: ((snappedEnd - snappedStart) / 60) * hw,
      color: "blue",
      timeLabel: `${fmt12(minutesToTimeStr(snappedStart))} – ${fmt12(minutesToTimeStr(snappedEnd))}`,
      title: "New Event",
    };
  }

  // ── Result computation ──────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _computeResult(): { type: string; detail: any } | null {
    const hw = this._hourWidth;
    switch (this.mode) {
      case "moving": {
        const ev = this._event!;
        const duration = toMin(ev.endTime) - toMin(ev.startTime);
        const rawStartMin = pxToMinutes(this.ghost.left - 2, hw);
        const snappedStart = snapMinutes(rawStartMin);
        return {
          type: "event-move",
          detail: {
            event: ev,
            oldResourceId: this._originResourceId,
            newResourceId: this._targetResourceId,
            newStartTime: minutesToTimeStr(snappedStart),
            newEndTime: minutesToTimeStr(snappedStart + duration),
          },
        };
      }
      case "resize-start":
      case "resize-end": {
        const ev = this._event!;
        const startMin =
          this.mode === "resize-start"
            ? snapMinutes(pxToMinutes(this.ghost.left - 2, hw))
            : toMin(ev.startTime);
        const endMin =
          this.mode === "resize-end"
            ? snapMinutes(
                pxToMinutes(this.ghost.left + this.ghost.width + 4, hw),
              )
            : toMin(ev.endTime);
        return {
          type: "event-resize",
          detail: {
            event: ev,
            resourceId: this._originResourceId,
            newStartTime: minutesToTimeStr(startMin),
            newEndTime: minutesToTimeStr(endMin),
          },
        };
      }
      case "creating": {
        const rawStartMin = pxToMinutes(this.ghost.left, hw);
        const rawEndMin = pxToMinutes(this.ghost.left + this.ghost.width, hw);
        const snappedStart = snapMinutes(rawStartMin);
        const snappedEnd = Math.max(snapMinutes(rawEndMin), snappedStart + 15);
        return {
          type: "event-create",
          detail: {
            resourceId: this._originResourceId,
            startTime: minutesToTimeStr(snappedStart),
            endTime: minutesToTimeStr(snappedEnd),
            date: "",
          },
        };
      }
      default:
        return null;
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  /**
   * Find the resource row under the pointer using actual clientY.
   * Converts clientY to content-area Y by accounting for the scroll
   * container's position and scroll offset.
   */
  private _findRowFromPointerY(clientY: number): ResourceLayout {
    if (!this._scrollContainer || this._resourceLayout.length === 0) {
      return this._resourceLayout[0] ?? { id: "", yOffset: 0, index: 0 };
    }

    const rect = this._scrollContainer.getBoundingClientRect();
    const contentY = clientY - rect.top + this._scrollContainer.scrollTop;

    // Find the row whose Y range contains contentY
    let closest = this._resourceLayout[0];
    let minDist = Infinity;
    for (const row of this._resourceLayout) {
      const rowMid = row.yOffset + ROW_HEIGHT / 2;
      const dist = Math.abs(contentY - rowMid);
      if (dist < minDist) {
        minDist = dist;
        closest = row;
      }
    }
    return closest;
  }

  private _addMoveListener() {
    document.addEventListener("pointermove", this._boundMove);
  }

  private _removeMoveListener() {
    document.removeEventListener("pointermove", this._boundMove);
  }
}
