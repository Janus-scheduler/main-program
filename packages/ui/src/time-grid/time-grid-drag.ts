/**
 * time-grid-drag.ts
 *
 * Drag controller shared by the two hour-grid views (`<janus-day-grid>` /
 * `<janus-week-grid>`), mirroring `timeline-drag.ts`'s role for the Timeline
 * view.
 *
 * Unlike the Timeline controller (which works in absolute ms across a single
 * infinite-scroll axis), this one operates entirely in wall-clock terms —
 * minutes-from-midnight plus a "YYYY-MM-DD" date — matching how
 * `time-grid-utils.ts` already represents events. That keeps this module
 * free of any timezone conversion; the host component converts once, at
 * dispatch time, the same way it already does for `slot-select`.
 *
 * The controller does NOT mutate data — it returns a result object that the
 * host component turns into a CustomEvent.
 */

import type { TimeGridEvent } from "./time-grid-types";
import { DRAG_THRESHOLD } from "../timeline/timeline-utils";
import {
  fmt12,
  minutesFromTimeStr,
  timeStrFromMinutes,
} from "./time-grid-utils";

export type TimeGridDragMode =
  "idle" | "moving" | "resize-start" | "resize-end" | "creating";

/**
 * One day column's horizontal bounds in viewport px — used to find which
 * column the pointer is over while dragging across days (Week view only).
 */
export interface TimeGridColumnBounds {
  dateStr: string;
  left: number;
  right: number;
}

export interface TimeGridDragGhost {
  dateStr: string;
  top: number;
  height: number;
  timeLabel: string;
}

export interface TimeGridMoveResult {
  type: "event-move";
  event: TimeGridEvent;
  oldDate: string;
  newDate: string;
  newStartTime: string; // "HH:MM"
  newEndTime: string; // "HH:MM"
}

export interface TimeGridResizeResult {
  type: "event-resize";
  event: TimeGridEvent;
  date: string;
  newStartTime: string; // "HH:MM"
  newEndTime: string; // "HH:MM"
}

export interface TimeGridCreateResult {
  type: "slot-select";
  date: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

export class TimeGridDragController {
  mode: TimeGridDragMode = "idle";
  active = false;

  // Ghost rendering info (read by host for template)
  ghost: TimeGridDragGhost = { dateStr: "", top: 0, height: 0, timeLabel: "" };

  // Internal tracking
  private _event: TimeGridEvent | null = null;
  private _originDate = "";
  private _originalStartMin = 0;
  private _originalEndMin = 0;
  private _startClientX = 0;
  private _startClientY = 0;
  private _pxPerMinute = 1;
  private _slotMinutes = 30;
  private _windowStartMin = 0;
  private _windowEndMin = 24 * 60;
  private _columns: TimeGridColumnBounds[] = [];

  // Most recently computed ghost time — read back on release, so the final
  // result never has to re-derive minutes from rendered pixels.
  private _lastDate = "";
  private _lastStartMin = 0;
  private _lastEndMin = 0;

  // "creating" only: the column's top edge in viewport px (captured once at
  // startCreate, since the column doesn't move mid-drag) and the anchor
  // minute the drag started from — the drawn range is [anchor, current].
  private _createColTop = 0;
  private _createAnchorMin = 0;

  private _requestUpdate: () => void;
  private _boundMove: (e: PointerEvent) => void;

  constructor(requestUpdate: () => void) {
    this._requestUpdate = requestUpdate;
    this._boundMove = this._onPointerMove.bind(this);
  }

  get activeEvent(): TimeGridEvent | null {
    return this._event;
  }

  /** Must be called before each `startMove`/`startResize` with fresh layout info. */
  updateLayout(
    pxPerMinute: number,
    slotMinutes: number,
    windowStartMin: number,
    windowEndMin: number,
    columns: TimeGridColumnBounds[],
  ) {
    this._pxPerMinute = pxPerMinute;
    this._slotMinutes = slotMinutes;
    this._windowStartMin = windowStartMin;
    this._windowEndMin = windowEndMin;
    this._columns = columns;
  }

  isDraggingEvent(ev: TimeGridEvent): boolean {
    return this.active && this._event?.id === ev.id && this.mode === "moving";
  }

  isResizingEvent(ev: TimeGridEvent): boolean {
    return (
      this.active &&
      this._event?.id === ev.id &&
      (this.mode === "resize-start" || this.mode === "resize-end")
    );
  }

  // ── Start handlers ──────────────────────────────────────────────────

  startMove(e: PointerEvent, ev: TimeGridEvent, dateStr: string) {
    e.stopPropagation();
    e.preventDefault();
    this.mode = "moving";
    this._event = ev;
    this._originDate = dateStr;
    this._originalStartMin = minutesFromTimeStr(ev.startTime);
    this._originalEndMin = minutesFromTimeStr(ev.endTime);
    this._startClientX = e.clientX;
    this._startClientY = e.clientY;
    this._addMoveListener();
  }

  startResize(
    e: PointerEvent,
    ev: TimeGridEvent,
    dateStr: string,
    edge: "start" | "end",
  ) {
    e.stopPropagation();
    e.preventDefault();
    this.mode = edge === "start" ? "resize-start" : "resize-end";
    this._event = ev;
    this._originDate = dateStr;
    this._originalStartMin = minutesFromTimeStr(ev.startTime);
    this._originalEndMin = minutesFromTimeStr(ev.endTime);
    this._startClientX = e.clientX;
    this._startClientY = e.clientY;
    this._addMoveListener();
  }

  /**
   * Begin drawing a new event on empty grid space.
   *
   * @param colTop the dragged column's `getBoundingClientRect().top`, used
   *   to convert pointer Y into minutes-from-midnight for this drag.
   */
  startCreate(e: PointerEvent, dateStr: string, colTop: number) {
    e.preventDefault();
    this.mode = "creating";
    this._event = null;
    this._originDate = dateStr;
    this._createColTop = colTop;
    this._createAnchorMin = this._minuteFromClientY(e.clientY);
    this._startClientX = e.clientX;
    this._startClientY = e.clientY;
    this._addMoveListener();
  }

  // ── Pointer event handling ───────────────────────────────────────────

  private _onPointerMove(e: PointerEvent) {
    const dx = e.clientX - this._startClientX;
    const dy = e.clientY - this._startClientY;

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
            : "row-resize";
    }

    switch (this.mode) {
      case "moving":
        this._computeMoveGhost(dy, e.clientX);
        break;
      case "resize-start":
        this._computeResizeGhost("start", dy);
        break;
      case "resize-end":
        this._computeResizeGhost("end", dy);
        break;
      case "creating":
        this._computeCreateGhost(e.clientY);
        break;
    }

    this._requestUpdate();
  }

  /** Complete the drag and return the result to dispatch, or null if it never became a real drag. */
  completeAndGetResult():
    TimeGridMoveResult | TimeGridResizeResult | TimeGridCreateResult | null {
    this._removeMoveListener();
    document.body.style.userSelect = "";
    document.body.style.cursor = "";

    const wasActive = this.active;
    const result = wasActive ? this._computeResult() : null;

    this.mode = "idle";
    this.active = false;
    this._event = null;
    this._requestUpdate();

    return result;
  }

  cancel() {
    this._removeMoveListener();
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    this.mode = "idle";
    this.active = false;
    this._event = null;
    this._requestUpdate();
  }

  // ── Ghost computation ─────────────────────────────────────────────────

  private _snap(min: number): number {
    return Math.round(min / this._slotMinutes) * this._slotMinutes;
  }

  private _computeMoveGhost(dy: number, clientX: number) {
    const durationMin = this._originalEndMin - this._originalStartMin;
    const deltaMin = dy / this._pxPerMinute;

    let newStart = this._snap(this._originalStartMin + deltaMin);
    newStart = Math.max(
      this._windowStartMin,
      Math.min(this._windowEndMin - durationMin, newStart),
    );
    const newEnd = newStart + durationMin;

    const dateStr = this._columnAt(clientX)?.dateStr ?? this._originDate;

    this._lastDate = dateStr;
    this._lastStartMin = newStart;
    this._lastEndMin = newEnd;

    this.ghost = {
      dateStr,
      top: (newStart - this._windowStartMin) * this._pxPerMinute,
      height: durationMin * this._pxPerMinute,
      timeLabel: `${fmt12(timeStrFromMinutes(newStart))} – ${fmt12(timeStrFromMinutes(newEnd))}`,
    };
  }

  private _computeResizeGhost(edge: "start" | "end", dy: number) {
    const deltaMin = dy / this._pxPerMinute;
    const minDuration = this._slotMinutes;

    let newStart = this._originalStartMin;
    let newEnd = this._originalEndMin;

    if (edge === "start") {
      newStart = this._snap(this._originalStartMin + deltaMin);
      newStart = Math.max(
        this._windowStartMin,
        Math.min(this._originalEndMin - minDuration, newStart),
      );
    } else {
      newEnd = this._snap(this._originalEndMin + deltaMin);
      newEnd = Math.min(
        this._windowEndMin,
        Math.max(this._originalStartMin + minDuration, newEnd),
      );
    }

    this._lastDate = this._originDate;
    this._lastStartMin = newStart;
    this._lastEndMin = newEnd;

    this.ghost = {
      dateStr: this._originDate,
      top: (newStart - this._windowStartMin) * this._pxPerMinute,
      height: (newEnd - newStart) * this._pxPerMinute,
      timeLabel: `${fmt12(timeStrFromMinutes(newStart))} – ${fmt12(timeStrFromMinutes(newEnd))}`,
    };
  }

  private _columnAt(clientX: number): TimeGridColumnBounds | undefined {
    return this._columns.find((c) => clientX >= c.left && clientX < c.right);
  }

  /** Pointer Y (viewport px) → minutes-from-midnight, clamped to the visible window. */
  private _minuteFromClientY(clientY: number): number {
    const raw =
      this._windowStartMin + (clientY - this._createColTop) / this._pxPerMinute;
    return Math.max(this._windowStartMin, Math.min(this._windowEndMin, raw));
  }

  private _computeCreateGhost(clientY: number) {
    const anchor = this._snap(this._createAnchorMin);
    const current = this._snap(this._minuteFromClientY(clientY));

    let start = Math.min(anchor, current);
    let end = Math.max(anchor, current);
    if (end <= start) end = start + this._slotMinutes;
    start = Math.max(this._windowStartMin, start);
    end = Math.min(this._windowEndMin, end);

    this._lastDate = this._originDate;
    this._lastStartMin = start;
    this._lastEndMin = end;

    this.ghost = {
      dateStr: this._originDate,
      top: (start - this._windowStartMin) * this._pxPerMinute,
      height: (end - start) * this._pxPerMinute,
      timeLabel: `${fmt12(timeStrFromMinutes(start))} – ${fmt12(timeStrFromMinutes(end))}`,
    };
  }

  // ── Result computation ─────────────────────────────────────────────────

  private _computeResult():
    TimeGridMoveResult | TimeGridResizeResult | TimeGridCreateResult | null {
    if (this.mode === "moving" && this._event) {
      return {
        type: "event-move",
        event: this._event,
        oldDate: this._originDate,
        newDate: this._lastDate,
        newStartTime: timeStrFromMinutes(this._lastStartMin),
        newEndTime: timeStrFromMinutes(this._lastEndMin),
      };
    }
    if (
      (this.mode === "resize-start" || this.mode === "resize-end") &&
      this._event
    ) {
      return {
        type: "event-resize",
        event: this._event,
        date: this._originDate,
        newStartTime: timeStrFromMinutes(this._lastStartMin),
        newEndTime: timeStrFromMinutes(this._lastEndMin),
      };
    }
    if (this.mode === "creating") {
      return {
        type: "slot-select",
        date: this._lastDate,
        startTime: timeStrFromMinutes(this._lastStartMin),
        endTime: timeStrFromMinutes(this._lastEndMin),
      };
    }
    return null;
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private _addMoveListener() {
    document.addEventListener("pointermove", this._boundMove);
  }

  private _removeMoveListener() {
    document.removeEventListener("pointermove", this._boundMove);
  }
}
