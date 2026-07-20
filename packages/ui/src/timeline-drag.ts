/**
 * timeline-drag.ts
 *
 * Drag controller for the multi-scale timeline.
 * Uses absolute timestamps (ms) for all positioning.
 */

import {
  TimelineEvent,
  type EventCreateDetail,
  type EventMoveDetail,
  type EventResizeDetail,
} from "./timeline-types";
import {
  ROW_HEIGHT,
  DRAG_THRESHOLD,
  fmt12,
  msToTimeStr,
} from "./timeline-utils";
import {
  timestampToPx,
  pxToTimestamp,
  snapTimestamp,
  getActiveZoomLevel,
} from "./timeline-zoom";

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
 * pointer events. Uses absolute ms timestamps for all positioning.
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
  private _originalStartMs = 0;
  private _originalEndMs = 0;
  private _createAnchorMs = 0; // for create-by-drag: the anchor timestamp
  private _resourceLayout: ResourceLayout[] = [];
  private _scrollContainer: HTMLElement | null = null;
  private _requestUpdate: () => void;
  private _pxPerMs = 0;
  private _viewStartMs = 0;
  private _originalRowTopOffset = 8;

  // Bound handler for cleanup
  private _boundMove: (e: PointerEvent) => void;

  get targetResourceId(): string {
    return this._targetResourceId;
  }

  get originResourceId(): string {
    return this._originResourceId;
  }

  get activeEvent(): TimelineEvent | null {
    return this._event;
  }

  get originalStartMs(): number {
    return this._originalStartMs;
  }

  get originalEndMs(): number {
    return this._originalEndMs;
  }

  get snapMs(): number {
    return this._getSnapMs();
  }

  constructor(requestUpdate: () => void) {
    this._requestUpdate = requestUpdate;
    this._boundMove = this._onPointerMove.bind(this);
  }

  /** Must be called each render with current layout & zoom info */
  updateLayout(
    scrollContainer: HTMLElement | null,
    resourceLayout: ResourceLayout[],
    pxPerMs: number,
    viewStartMs: number,
  ) {
    this._scrollContainer = scrollContainer;
    this._resourceLayout = resourceLayout;
    this._pxPerMs = pxPerMs;
    this._viewStartMs = viewStartMs;
  }

  /** True if an event is the one currently being dragged */
  isDraggingEvent(ev: TimelineEvent): boolean {
    return this.active && this._event?.id === ev.id && this.mode === "moving";
  }

  // ── Start handlers ──────────────────────────────────────────────────

  startMove(
    e: PointerEvent,
    ev: TimelineEvent,
    resourceId: string,
    rowTopOffset: number = 8,
  ) {
    e.stopPropagation();
    e.preventDefault();
    this.mode = "moving";
    this._event = ev;
    this._originResourceId = resourceId;
    this._targetResourceId = resourceId;
    this._originalRowTopOffset = rowTopOffset;
    this._originalStartMs = ev.startMs;
    this._originalEndMs = ev.endMs;
    this._startClientX = e.clientX;
    this._startClientY = e.clientY;

    this._addMoveListener();
  }

  startResize(
    e: PointerEvent,
    ev: TimelineEvent,
    resourceId: string,
    edge: "start" | "end",
    rowTopOffset: number = 8,
  ) {
    e.stopPropagation();
    e.preventDefault();
    this.mode = edge === "start" ? "resize-start" : "resize-end";
    this._event = ev;
    this._originResourceId = resourceId;
    this._targetResourceId = resourceId;
    this._originalRowTopOffset = rowTopOffset;
    this._originalStartMs = ev.startMs;
    this._originalEndMs = ev.endMs;
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

    // Compute the timestamp at click position
    if (this._scrollContainer) {
      const rect = this._scrollContainer.getBoundingClientRect();
      const clickPx = e.clientX - rect.left + this._scrollContainer.scrollLeft;
      this._createAnchorMs = pxToTimestamp(
        clickPx,
        this._viewStartMs,
        this._pxPerMs,
      );
    }

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
   */
  completeAndGetResult():
    | { type: "event-move"; detail: EventMoveDetail }
    | { type: "event-resize"; detail: EventResizeDetail }
    | { type: "event-create"; detail: EventCreateDetail }
    | null {
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

  private _getSnapMs(): number {
    const level = getActiveZoomLevel(this._pxPerMs);
    return level.snapMs;
  }

  private _computeMoveGhost(dx: number, e: PointerEvent) {
    const snapMs = this._getSnapMs();
    const durationMs = this._originalEndMs - this._originalStartMs;

    // How many ms did the pointer move?
    const deltaMs = dx / this._pxPerMs;
    const newStartMs = snapTimestamp(this._originalStartMs + deltaMs, snapMs);
    const newEndMs = newStartMs + durationMs;

    // Find target resource
    const targetRow = this._findRowFromPointerY(e.clientY);
    this._targetResourceId = targetRow.id;

    const startLabel = msToTimeStr(newStartMs);
    const endLabel = msToTimeStr(newEndMs);

    const ghostTopOffset =
      this._targetResourceId === this._originResourceId
        ? this._originalRowTopOffset
        : 8;

    this.ghost = {
      left: timestampToPx(newStartMs, this._viewStartMs, this._pxPerMs),
      top: targetRow.yOffset + ghostTopOffset,
      width:
        timestampToPx(newEndMs, this._viewStartMs, this._pxPerMs) -
        timestampToPx(newStartMs, this._viewStartMs, this._pxPerMs),
      color: this._event!.color,
      timeLabel: `${fmt12(startLabel)} – ${fmt12(endLabel)}`,
      title: this._event!.title,
    };
  }

  private _computeResizeStartGhost(dx: number) {
    const snapMs = this._getSnapMs();
    const deltaMs = dx / this._pxPerMs;
    const endMs = this._originalEndMs;
    const minDuration = snapMs; // minimum 1 snap unit

    let newStartMs = snapTimestamp(this._originalStartMs + deltaMs, snapMs);
    // Don't allow start past end
    if (newStartMs > endMs - minDuration) {
      newStartMs = endMs - minDuration;
    }

    const rowEntry = this._resourceLayout.find(
      (r) => r.id === this._originResourceId,
    );

    const startLabel = msToTimeStr(newStartMs);

    this.ghost = {
      left: timestampToPx(newStartMs, this._viewStartMs, this._pxPerMs),
      top: (rowEntry?.yOffset ?? 0) + this._originalRowTopOffset,
      width:
        timestampToPx(endMs, this._viewStartMs, this._pxPerMs) -
        timestampToPx(newStartMs, this._viewStartMs, this._pxPerMs),
      color: this._event!.color,
      timeLabel: `${fmt12(startLabel)} – ${fmt12(this._event!.endTime)}`,
      title: this._event!.title,
    };
  }

  private _computeResizeEndGhost(dx: number) {
    const snapMs = this._getSnapMs();
    const deltaMs = dx / this._pxPerMs;
    const startMs = this._originalStartMs;
    const minDuration = snapMs;

    let newEndMs = snapTimestamp(this._originalEndMs + deltaMs, snapMs);
    if (newEndMs < startMs + minDuration) {
      newEndMs = startMs + minDuration;
    }

    const rowEntry = this._resourceLayout.find(
      (r) => r.id === this._originResourceId,
    );

    const endLabel = msToTimeStr(newEndMs);

    this.ghost = {
      left: timestampToPx(startMs, this._viewStartMs, this._pxPerMs),
      top: (rowEntry?.yOffset ?? 0) + this._originalRowTopOffset,
      width:
        timestampToPx(newEndMs, this._viewStartMs, this._pxPerMs) -
        timestampToPx(startMs, this._viewStartMs, this._pxPerMs),
      color: this._event!.color,
      timeLabel: `${fmt12(this._event!.startTime)} – ${fmt12(endLabel)}`,
      title: this._event!.title,
    };
  }

  private _computeCreateGhost(e: PointerEvent) {
    if (!this._scrollContainer) return;
    const snapMs = this._getSnapMs();

    const rect = this._scrollContainer.getBoundingClientRect();
    const currentPx = e.clientX - rect.left + this._scrollContainer.scrollLeft;
    const currentMs = pxToTimestamp(
      currentPx,
      this._viewStartMs,
      this._pxPerMs,
    );

    const snappedAnchor = snapTimestamp(this._createAnchorMs, snapMs);
    const snappedCurrent = snapTimestamp(currentMs, snapMs);

    const startMs = Math.min(snappedAnchor, snappedCurrent);
    let endMs = Math.max(snappedAnchor, snappedCurrent);
    if (endMs <= startMs) endMs = startMs + snapMs;

    const rowEntry = this._resourceLayout.find(
      (r) => r.id === this._originResourceId,
    );

    const startLabel = msToTimeStr(startMs);
    const endLabel = msToTimeStr(endMs);

    this.ghost = {
      left: timestampToPx(startMs, this._viewStartMs, this._pxPerMs),
      top: (rowEntry?.yOffset ?? 0) + 8,
      width:
        timestampToPx(endMs, this._viewStartMs, this._pxPerMs) -
        timestampToPx(startMs, this._viewStartMs, this._pxPerMs),
      color: "blue",
      timeLabel: `${fmt12(startLabel)} – ${fmt12(endLabel)}`,
      title: "New Event",
    };
  }

  // ── Result computation ──────────────────────────────────────────────

  private _computeResult():
    | { type: "event-move"; detail: EventMoveDetail }
    | { type: "event-resize"; detail: EventResizeDetail }
    | { type: "event-create"; detail: EventCreateDetail }
    | null {
    const snapMs = this._getSnapMs();

    switch (this.mode) {
      case "moving": {
        const ev = this._event!;
        const durationMs = this._originalEndMs - this._originalStartMs;
        const ghostStartMs = pxToTimestamp(
          this.ghost.left,
          this._viewStartMs,
          this._pxPerMs,
        );
        const snappedStart = snapTimestamp(ghostStartMs, snapMs);
        const snappedEnd = snappedStart + durationMs;

        return {
          type: "event-move",
          detail: {
            event: ev,
            oldResourceId: this._originResourceId,
            newResourceId: this._targetResourceId,
            newStartTime: new Date(snappedStart).toISOString(),
            newEndTime: new Date(snappedEnd).toISOString(),
          },
        };
      }
      case "resize-start": {
        const ev = this._event!;
        const ghostStartMs = pxToTimestamp(
          this.ghost.left,
          this._viewStartMs,
          this._pxPerMs,
        );
        const snappedStart = snapTimestamp(ghostStartMs, snapMs);
        return {
          type: "event-resize",
          detail: {
            event: ev,
            resourceId: this._originResourceId,
            newStartTime: new Date(snappedStart).toISOString(),
            newEndTime: new Date(this._originalEndMs).toISOString(),
          },
        };
      }
      case "resize-end": {
        const ev = this._event!;
        const ghostEndPx = this.ghost.left + this.ghost.width;
        const ghostEndMs = pxToTimestamp(
          ghostEndPx,
          this._viewStartMs,
          this._pxPerMs,
        );
        const snappedEnd = snapTimestamp(ghostEndMs, snapMs);
        return {
          type: "event-resize",
          detail: {
            event: ev,
            resourceId: this._originResourceId,
            newStartTime: new Date(this._originalStartMs).toISOString(),
            newEndTime: new Date(snappedEnd).toISOString(),
          },
        };
      }
      case "creating": {
        const ghostStartMs = pxToTimestamp(
          this.ghost.left,
          this._viewStartMs,
          this._pxPerMs,
        );
        const ghostEndMs = pxToTimestamp(
          this.ghost.left + this.ghost.width,
          this._viewStartMs,
          this._pxPerMs,
        );
        const snappedStart = snapTimestamp(ghostStartMs, snapMs);
        let snappedEnd = snapTimestamp(ghostEndMs, snapMs);
        if (snappedEnd <= snappedStart) snappedEnd = snappedStart + snapMs;

        return {
          type: "event-create",
          detail: {
            resourceId: this._originResourceId,
            startTime: new Date(snappedStart).toISOString(),
            endTime: new Date(snappedEnd).toISOString(),
            date: new Date(snappedStart).toISOString().split("T")[0],
          },
        };
      }
      default:
        return null;
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private _findRowFromPointerY(clientY: number): ResourceLayout {
    if (!this._scrollContainer || this._resourceLayout.length === 0) {
      return this._resourceLayout[0] ?? { id: "", yOffset: 0, index: 0 };
    }

    const rect = this._scrollContainer.getBoundingClientRect();
    const contentY = clientY - rect.top + this._scrollContainer.scrollTop;

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
