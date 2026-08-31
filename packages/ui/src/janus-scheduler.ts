import { LitElement, html, nothing } from "lit";
import { customElement, state, property } from "lit/decorators.js";
import {
  type SchedulerSaveData,
  type SchedulerDeleteData,
  type EventDraft,
  schedulerStore,
  getAllTimezones,
  formatTimezoneLabel,
  checkDraftConflict,
  zonedInputToISO,
  isoToZonedDisplay,
} from "@janus-scheduler/core";
import { schedulerStyles } from "./styles";
import "./janus-confirm-dialog";

const COLORS = [
  "primary",
  "orange",
  "orange",
  "blue",
  "green",
  "yellow",
  "purple",
  "red",
  "pink",
  "indigo",
  "cyan",
  "teal",
];

// ─── Icons ───────────────────────────────────────────────────────────────────

const CalendarIcon = () =>
  html`<svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>`;

const ClockIcon = () =>
  html`<svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>`;

const SearchIcon = () =>
  html`<svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>`;

const BellIcon = () =>
  html`<svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>`;

const TrashIcon = () =>
  html`<svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6M9 6V4h6v2" />
  </svg>`;

const XIcon = () =>
  html`<svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>`;

const GlobeIcon = () =>
  html`<svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path
      d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
    />
  </svg>`;

const RepeatIcon = () =>
  html`<svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>`;

const UsersIcon = () =>
  html`<svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>`;

const TagIcon = () =>
  html`<svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path
      d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"
    />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>`;

const ChevronDownIcon = () =>
  html`<svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>`;

const ChevronLeftIcon = () =>
  html`<svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>`;

const ChevronRightIcon = () =>
  html`<svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>`;

// ─── Avatar helpers ───────────────────────────────────────────────────────────

const avatarPalette: Record<string, string> = {
  "John Doe": "primary",
  "Sarah Chen": "blue",
};

function avatarHtml(name: string, avatarUrl?: string) {
  if (avatarUrl) {
    return html`<img
      class="avatar"
      src="${avatarUrl}"
      alt="${name}"
      style="object-fit: cover;"
    />`;
  }
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
  const cls = avatarPalette[name]
    ? `avatar-${avatarPalette[name]}`
    : "avatar-primary";
  return html`<span class="avatar ${cls}">${initials}</span>`;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateShort(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function isEndBeforeStart(
  sd: string,
  st: string,
  ed: string,
  et: string,
): boolean {
  if (!sd || !st || !ed || !et) return false;
  return new Date(`${ed}T${et}`).getTime() <= new Date(`${sd}T${st}`).getTime();
}

function parseRRule(rruleStr: string): { freq: string; until: string } {
  const result = { freq: "Weekly", until: "" };
  if (!rruleStr) return result;

  const parts = rruleStr.split(";");
  for (const part of parts) {
    const [key, val] = part.split("=");
    if (!key || !val) continue;
    if (key === "FREQ") {
      const lower = val.toLowerCase();
      const capitalized = lower.charAt(0).toUpperCase() + lower.slice(1);
      if (["Daily", "Weekly", "Monthly", "Yearly"].includes(capitalized)) {
        result.freq = capitalized;
      }
    } else if (key === "UNTIL") {
      const match = val.match(/^(\d{4})(\d{2})(\d{2})/);
      if (match) {
        result.until = `${match[1]}-${match[2]}-${match[3]}`;
      }
    }
  }
  return result;
}

function formatRecurrence(rruleStr: string): string {
  if (!rruleStr) return "";
  const { freq, until } = parseRRule(rruleStr);
  let label = `Repeats ${freq.toLowerCase()}`;
  if (until) {
    label += ` until ${formatDate(until)}`;
  }
  return label;
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface CalState {
  viewYear: number;
  viewMonth: number;
}

function calDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  return cells;
}

function isoFromParts(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// ─── Time data ────────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

type OpenPicker =
  | "startDate"
  | "startTime"
  | "endDate"
  | "endTime"
  | "timezone"
  | "recurrenceUntil"
  | null;

// ─── Component ───────────────────────────────────────────────────────────────

@customElement("janus-scheduler")
export class JanusScheduler extends LitElement {
  static styles = schedulerStyles;

  // ── External inputs (@property) — can be set by React/Angular/Solid wrappers
  // These pre-fill the form when editing an existing event.
  // Leave unset (empty string / empty array) for a blank "create" form.
  @property({ type: String }) title = "";
  @property({ type: String }) startDate = "";
  @property({ type: String }) startTime = "";
  @property({ type: String }) endDate = "";
  @property({ type: String }) endTime = "";
  @property({ type: Array }) participants: string[] = [];
  @property({ type: String }) description = "";
  @property({ type: String }) activeColor = "primary";
  @property({ type: String }) brandColor?: string;
  @property({ type: String }) error: string | null = null;
  @property({ type: Boolean }) allDay = false;
  @property({ type: String }) recurrenceRule = "";
  /**
   * The ID of the event being edited.
   * - `null` / omitted → creation mode (onSave should call addEvent)
   * - a string         → edit mode     (onSave should call updateEvent, onDelete should call deleteEvent)
   */
  @property({ type: String }) eventId: string | null = null;
  @property({ type: Boolean, attribute: "show-confirm-on-create" })
  showConfirmOnCreate = false;
  @property({ type: Boolean, attribute: "prevent-conflicts" })
  preventConflicts = false;

  // Safe accessor — guards against React passing undefined for array props
  private get _participants(): string[] {
    return Array.isArray(this.participants) ? this.participants : [];
  }

  // ── Internal UI state (@state) — never set from outside
  @state() private _isEditing = false;
  @state() participantInput = "";
  @state() activeSuggestionIndex = -1;
  @state() private _shakeInput = false;
  @state() sidebarOpen = false;
  @state() openPicker: OpenPicker = null;
  @state() private _tzSearch = "";
  @state() private _selectedTz: string = schedulerStore.getState().timezone;
  @state() private _showCreateConfirm = false;
  @state() private _showDeleteConfirm = false;
  @state() private _titleTouched = false;
  @state() private _participantsTouched = false;
  @state() private _recurrenceFreq: "Daily" | "Weekly" | "Monthly" | "Yearly" =
    "Weekly";
  @state() private _recurrenceUntilDate = "";
  @state() recurrenceCal: CalState = {
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth(),
  };

  // Calendar view: sync to the selected date when a property is set,
  // otherwise default to current month
  @state() startCal: CalState = {
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth(),
  };
  @state() endCal: CalState = {
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth(),
  };

  private _unsubStore?: () => void;

  // ─── Computed ──────────────────────────────────────────────────────────────

  private _resolveResourceName(id: string): string {
    const res = schedulerStore.getState().resources[id];
    return res ? res.name : id;
  }

  private get _matchingSuggestions() {
    const input = this.participantInput.trim().toLowerCase();
    if (!input) return [];

    const draft = schedulerStore.getState().eventDraft;
    const existingParticipants = draft ? draft.participants : [];

    const allResources = Object.values(schedulerStore.getState().resources);
    return allResources.filter((res) => {
      // Don't suggest already added participants
      if (existingParticipants.includes(res.id)) return false;

      return (
        res.name.toLowerCase().includes(input) ||
        res.id.toLowerCase().includes(input)
      );
    });
  }

  private get _invalid() {
    const draft = schedulerStore.getState().eventDraft;
    if (!draft) return false;
    const timeInvalid = this._timeInvalid;
    const titleInvalid = !draft.title || !draft.title.trim();
    const participantsInvalid =
      !draft.participants || draft.participants.length === 0;
    const conflictInvalid =
      this.preventConflicts && this._resourceConflict.hasConflict;
    return (
      timeInvalid || titleInvalid || participantsInvalid || conflictInvalid
    );
  }

  private get _timeInvalid() {
    const draft = schedulerStore.getState().eventDraft;
    if (!draft) return false;

    const occInvalid = isEndBeforeStart(
      draft.startDate,
      draft.startTime,
      draft.endDate,
      draft.endTime,
    );
    if (occInvalid) return true;

    if (draft.recurrenceRule && this._recurrenceUntilDate) {
      if (this._recurrenceUntilDate < draft.startDate) {
        return true;
      }
    }
    return false;
  }

  private get _resourceConflict(): { hasConflict: boolean; message: string } {
    const draft = schedulerStore.getState().eventDraft;
    if (!draft || !draft.title || draft.participants.length === 0) {
      return { hasConflict: false, message: "" };
    }

    const eventsList = Object.values(schedulerStore.getState().events);
    const result = checkDraftConflict(draft, eventsList, this._selectedTz);

    if (result.hasConflict && result.resourceIds.length > 0) {
      const names = result.resourceIds.map((id) =>
        this._resolveResourceName(id),
      );
      const message = result.message.replace(
        "[REPLACE_RESOURCES]",
        names.join(", "),
      );
      return {
        hasConflict: true,
        message,
      };
    }

    return { hasConflict: false, message: "" };
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  willUpdate(changedProperties: Map<string, unknown>) {
    if (changedProperties.has("eventId")) {
      this._isEditing = this.eventId === null;
      this._showCreateConfirm = false;
      this._titleTouched = false;
      this._participantsTouched = false;

      const todayStr = new Date().toISOString().split("T")[0];
      const defaults = {
        title: this.title,
        startDate: this.startDate || todayStr,
        startTime: this.startTime || "09:00",
        endDate: this.endDate || this.startDate || todayStr,
        endTime: this.endTime || "10:00",
        participants: this._participants,
        description: this.description,
        activeColor: this.activeColor || "primary",
        timezone: schedulerStore.getState().timezone,
        allDay: this.allDay,
        recurrenceRule: this.recurrenceRule,
      };

      schedulerStore.getState().startDraft(this.eventId, defaults);

      const draft = schedulerStore.getState().eventDraft;
      if (draft) {
        this._selectedTz = draft.timezone || schedulerStore.getState().timezone;
        if (draft.recurrenceRule) {
          const parsed = parseRRule(draft.recurrenceRule);
          this._recurrenceFreq = parsed.freq as
            | "Daily"
            | "Weekly"
            | "Monthly"
            | "Yearly";
          this._recurrenceUntilDate = parsed.until;
          if (parsed.until) {
            const [y, m] = parsed.until.split("-").map(Number);
            this.recurrenceCal = { viewYear: y, viewMonth: m - 1 };
          }
        } else {
          this._recurrenceFreq = "Weekly";
          this._recurrenceUntilDate = "";
        }
      }
    }
  }

  // When startDate/endDate properties are set from outside (edit mode),
  // sync the calendar view to show the correct month
  updated(changed: Map<string, unknown>) {
    if (changed.has("startDate") && this.startDate) {
      const [y, m] = this.startDate.split("-").map(Number);
      this.startCal = { viewYear: y, viewMonth: m - 1 };
    }
    if (changed.has("endDate") && this.endDate) {
      const [y, m] = this.endDate.split("-").map(Number);
      this.endCal = { viewYear: y, viewMonth: m - 1 };
    }
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("click", this._outsideClick);

    // Subscribe to store updates to keep the Lit UI reactive
    this._unsubStore = schedulerStore.subscribe(() => {
      const draft = schedulerStore.getState().eventDraft;
      if (draft && draft.timezone) {
        this._selectedTz = draft.timezone;
      }
      this.requestUpdate();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("click", this._outsideClick);
    this._unsubStore?.();
  }

  private _outsideClick = () => {
    if (this.openPicker) this.openPicker = null;
  };

  private _toggle(p: OpenPicker) {
    this.openPicker = this.openPicker === p ? null : p;
  }

  // ─── Dispatchers & Action Handlers ─────────────────────────────────────────

  private _onClose(clearDraft = false) {
    schedulerStore.getState().clearDraft(clearDraft);
    this.dispatchEvent(
      new CustomEvent("close", { bubbles: true, composed: true }),
    );
  }

  private _handleCancel() {
    if (this.eventId !== null) {
      // Revert edit draft back to event defaults
      const defaults = {
        title: this.title,
        startDate: this.startDate,
        startTime: this.startTime,
        endDate: this.endDate,
        endTime: this.endTime,
        participants: this._participants,
        description: this.description,
        activeColor: this.activeColor || "primary",
        timezone: this._selectedTz,
      };
      schedulerStore.getState().startDraft(this.eventId, defaults);
      this._isEditing = false;
    } else {
      // Close and discard draft completely
      this._onClose(true);
    }
  }

  private _handleSaveClick() {
    this._titleTouched = true;
    this._participantsTouched = true;
    if (this._invalid) {
      this._shakeInput = true;
      setTimeout(() => {
        this._shakeInput = false;
      }, 500);
      return;
    }
    if (this.eventId !== null) {
      this._onSave();
    } else if (this.showConfirmOnCreate) {
      this._showCreateConfirm = true;
    } else {
      this._onSave();
    }
  }

  private _onConfirmCreate() {
    this._showCreateConfirm = false;
    this._onSave();
  }

  private _onSave() {
    const draft = schedulerStore.getState().eventDraft;
    if (!draft || this._invalid) return;

    // Persist the chosen timezone to the store so all components stay in sync
    schedulerStore.getState().setTimezone(this._selectedTz);

    // Clear draft
    schedulerStore.getState().clearDraft(true);

    const baseId = this.eventId
      ? this.eventId.replace(/_occ_\d+$/, "")
      : this.eventId;

    this.dispatchEvent(
      new CustomEvent("save", {
        bubbles: true,
        composed: true,
        detail: {
          id: baseId,
          title: draft.title,
          startDate: draft.startDate,
          startTime: draft.startTime,
          endDate: draft.endDate,
          endTime: draft.endTime,
          participants: draft.participants,
          description: draft.description,
          activeColor: draft.activeColor,
          timezone: this._selectedTz,
          allDay: draft.allDay,
          recurrenceRule: draft.recurrenceRule,
        } as SchedulerSaveData,
      }),
    );
  }

  private _onDeleteClick() {
    this._showDeleteConfirm = true;
  }

  private _onConfirmDelete() {
    this._showDeleteConfirm = false;
    this._onDelete();
  }

  private _onDelete() {
    const draft = schedulerStore.getState().eventDraft;
    const titleVal = draft ? draft.title : this.title;

    // Clear draft
    schedulerStore.getState().clearDraft(true);

    const baseId = this.eventId
      ? this.eventId.replace(/_occ_\d+$/, "")
      : this.eventId;

    this.dispatchEvent(
      new CustomEvent("delete", {
        bubbles: true,
        composed: true,
        // id is what the host needs to call manager.deleteEvent(id).
        // title is included for display purposes (e.g. confirmation messages).
        detail: { id: baseId, title: titleVal } as SchedulerDeleteData,
      }),
    );
  }

  // ─── Participants ──────────────────────────────────────────────────────────

  private _removeParticipant(id: string) {
    const draft = schedulerStore.getState().eventDraft;
    if (!draft) return;
    this._participantsTouched = true;
    const participants = draft.participants.filter((p) => p !== id);
    schedulerStore.getState().updateDraft({ participants });
  }

  private _selectSuggestion(id: string) {
    const draft = schedulerStore.getState().eventDraft;
    if (!draft) return;

    this._participantsTouched = true;
    if (!draft.participants.includes(id)) {
      const participants = [...draft.participants, id];
      schedulerStore.getState().updateDraft({ participants });
    }
    this.participantInput = "";
    this.activeSuggestionIndex = -1;
  }

  private _handleParticipantKey(e: KeyboardEvent) {
    const draft = schedulerStore.getState().eventDraft;
    if (!draft) return;

    const suggestions = this._matchingSuggestions;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (suggestions.length > 0) {
        this.activeSuggestionIndex =
          (this.activeSuggestionIndex + 1) % suggestions.length;
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (suggestions.length > 0) {
        this.activeSuggestionIndex =
          (this.activeSuggestionIndex - 1 + suggestions.length) %
          suggestions.length;
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      this.participantInput = "";
      this.activeSuggestionIndex = -1;
    } else if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = this.participantInput.trim().toLowerCase();
      if (!val) return;

      // 1. If user highlighted a suggestion using Arrow keys, use it
      if (
        this.activeSuggestionIndex >= 0 &&
        this.activeSuggestionIndex < suggestions.length
      ) {
        this._selectSuggestion(suggestions[this.activeSuggestionIndex].id);
        return;
      }

      // 2. Otherwise, check for exact match in suggestions
      const exactMatch = suggestions.find(
        (s) => s.id.toLowerCase() === val || s.name.toLowerCase() === val,
      );
      if (exactMatch) {
        this._selectSuggestion(exactMatch.id);
        return;
      }

      // 3. Check if there's only one suggestion (fuzzy/partial match)
      if (suggestions.length === 1) {
        this._selectSuggestion(suggestions[0].id);
        return;
      }

      // 4. Otherwise, trigger shake because it's not a valid resource
      this._shakeInput = true;
      setTimeout(() => {
        this._shakeInput = false;
      }, 500);
    } else if (
      e.key === "Backspace" &&
      !this.participantInput &&
      draft.participants.length
    ) {
      const participants = draft.participants.slice(0, -1);
      schedulerStore.getState().updateDraft({ participants });
    }
  }

  // ─── Time helpers ──────────────────────────────────────────────────────────

  private _parseTime(t: string) {
    if (!t) return { h: 0, m: 0 };
    const [h, m] = t.split(":").map(Number);
    return { h, m };
  }

  private _setTime(which: "start" | "end", h: number, m: number) {
    const val = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    if (which === "start") {
      schedulerStore.getState().updateDraft({ startTime: val });
    } else {
      schedulerStore.getState().updateDraft({ endTime: val });
    }
    this.openPicker = null;
  }

  // ─── Calendar date selection ───────────────────────────────────────────────

  private _selectDate(
    which: "start" | "end" | "recurrenceUntil",
    y: number,
    mo: number,
    d: number,
  ) {
    const iso = isoFromParts(y, mo, d);
    const draft = schedulerStore.getState().eventDraft;
    if (!draft) return;

    if (which === "start") {
      const updates: Partial<EventDraft> = { startDate: iso };
      this.startCal = { viewYear: y, viewMonth: mo };
      if (draft.allDay) {
        updates.endDate = iso;
        this.endCal = { viewYear: y, viewMonth: mo };
      } else {
        if (
          !draft.endDate ||
          draft.endDate < iso ||
          isEndBeforeStart(iso, draft.startTime, draft.endDate, draft.endTime)
        ) {
          updates.endDate = iso;
          this.endCal = { viewYear: y, viewMonth: mo };
        }
      }
      schedulerStore.getState().updateDraft(updates);
    } else if (which === "end") {
      schedulerStore.getState().updateDraft({ endDate: iso });
      this.endCal = { viewYear: y, viewMonth: mo };
    } else {
      this._recurrenceUntilDate = iso;
      this.recurrenceCal = { viewYear: y, viewMonth: mo };
      this._updateRecurrenceRule();
    }
    this.openPicker = null;
  }

  private _toggleAllDay() {
    const draft = schedulerStore.getState().eventDraft;
    if (!draft) return;
    const newAllDay = !draft.allDay;
    if (newAllDay) {
      const todayStr = new Date().toISOString().split("T")[0];
      const targetStart = draft.startDate || todayStr;
      schedulerStore.getState().updateDraft({
        allDay: true,
        startDate: targetStart,
        startTime: "00:00",
        endDate: targetStart,
        endTime: "23:59",
      });
    } else {
      schedulerStore.getState().updateDraft({
        allDay: false,
      });
    }
  }

  private _toggleRepeat() {
    const draft = schedulerStore.getState().eventDraft;
    if (!draft) return;
    if (draft.recurrenceRule) {
      schedulerStore.getState().updateDraft({ recurrenceRule: "" });
      this._recurrenceUntilDate = "";
    } else {
      this._recurrenceFreq = "Weekly";
      const start = new Date(draft.startDate + "T00:00:00");
      start.setMonth(start.getMonth() + 1);
      const year = start.getFullYear();
      const month = String(start.getMonth() + 1).padStart(2, "0");
      const day = String(start.getDate()).padStart(2, "0");
      this._recurrenceUntilDate = `${year}-${month}-${day}`;
      const [y, m] = this._recurrenceUntilDate.split("-").map(Number);
      this.recurrenceCal = { viewYear: y, viewMonth: m - 1 };
      this._updateRecurrenceRule();
    }
  }

  private _setRepeatFreq(freq: "Daily" | "Weekly" | "Monthly" | "Yearly") {
    this._recurrenceFreq = freq;
    this._updateRecurrenceRule();
  }

  private _updateRecurrenceRule() {
    const draft = schedulerStore.getState().eventDraft;
    if (!draft) return;
    const freqUpper = this._recurrenceFreq.toUpperCase();
    let rule = `FREQ=${freqUpper}`;
    if (this._recurrenceUntilDate) {
      const d = new Date(this._recurrenceUntilDate + "T23:59:59");
      const untilStr = d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      rule += `;UNTIL=${untilStr}`;
    }
    schedulerStore.getState().updateDraft({ recurrenceRule: rule });
  }

  // ─── Calendar dropdown ─────────────────────────────────────────────────────

  private _calPicker(
    which: "start" | "end" | "recurrenceUntil",
    selectedIso: string,
    cal: CalState,
    onNav: (d: -1 | 1) => void,
  ) {
    const { viewYear: vy, viewMonth: vm } = cal;
    const days = calDays(vy, vm);
    const [selY, selM, selD] = selectedIso
      ? selectedIso.split("-").map(Number)
      : [0, 0, 0];
    const now = new Date();
    const todY = now.getFullYear(),
      todM = now.getMonth(),
      todD = now.getDate();

    return html`
      <div class="cal-dropdown" @click=${(e: Event) => e.stopPropagation()}>
        <div class="cal-header">
          <button class="cal-nav-btn" type="button" @click=${() => onNav(-1)}>
            ${ChevronLeftIcon()}
          </button>
          <span class="cal-month-label">${MONTH_NAMES[vm]} ${vy}</span>
          <button class="cal-nav-btn" type="button" @click=${() => onNav(1)}>
            ${ChevronRightIcon()}
          </button>
        </div>
        <div class="cal-weekdays">
          ${WEEKDAYS.map((w) => html`<span class="cal-wd">${w}</span>`)}
        </div>
        <div class="cal-grid">
          ${days.map((d) => {
            if (d === null) return html`<span class="cal-empty"></span>`;
            const isSel = d === selD && vm === selM - 1 && vy === selY;
            const isToday = d === todD && vm === todM && vy === todY;
            return html`<button
              type="button"
              class="cal-day ${isSel ? "cal-day--selected" : ""} ${isToday &&
              !isSel
                ? "cal-day--today"
                : ""}"
              @click=${() => this._selectDate(which, vy, vm, d)}
            >
              ${d}
            </button>`;
          })}
        </div>
        <div class="cal-preview">
          ${selectedIso ? formatDate(selectedIso) : "No date selected"}
        </div>
      </div>
    `;
  }

  // ─── Time picker dropdown ──────────────────────────────────────────────────

  private _timePicker(which: "start" | "end", currentTime: string) {
    const { h: selH, m: selM } = this._parseTime(currentTime);
    return html`
      <div
        class="time-picker-dropdown"
        @click=${(e: Event) => e.stopPropagation()}
      >
        <div class="time-picker-header">Select Time</div>
        <div class="time-picker-body">
          <div class="time-col">
            <div class="time-col-label">Hour</div>
            <div class="time-scroll">
              ${HOURS.map(
                (h) =>
                  html`<button
                    type="button"
                    class="time-cell ${selH === h ? "time-cell--active" : ""}"
                    @click=${() => this._setTime(which, h, selM)}
                  >
                    ${h % 12 || 12} ${h >= 12 ? "PM" : "AM"}
                  </button>`,
              )}
            </div>
          </div>
          <div class="time-divider">:</div>
          <div class="time-col">
            <div class="time-col-label">Min</div>
            <div class="time-scroll">
              ${MINUTES.map(
                (m) =>
                  html`<button
                    type="button"
                    class="time-cell ${selM === m ? "time-cell--active" : ""}"
                    @click=${() => this._setTime(which, selH, m)}
                  >
                    ${String(m).padStart(2, "0")}
                  </button>`,
              )}
            </div>
          </div>
        </div>
        <div class="time-picker-preview">${formatTime(currentTime)}</div>
      </div>
    `;
  }

  // ─── Shared trigger button ─────────────────────────────────────────────────

  private _triggerBtn(
    icon: unknown,
    value: string,
    isOpen: boolean,
    isInvalid: boolean,
    pickerId: OpenPicker,
  ) {
    const cls = [
      "time-trigger",
      isOpen ? "time-trigger--open" : "",
      isInvalid ? "time-trigger--invalid" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return html`
      <button
        type="button"
        class="${cls}"
        @click=${(e: Event) => {
          e.stopPropagation();
          this._toggle(pickerId);
        }}
      >
        <span class="time-trigger-icon">${icon}</span>
        <span class="time-trigger-value">${value || "—"}</span>
        <span class="time-trigger-chevron">${ChevronDownIcon()}</span>
      </button>
    `;
  }

  // ─── Timezone picker dropdown ──────────────────────────────────────────────

  private _timezonePicker() {
    const allZones = getAllTimezones();
    const q = this._tzSearch.toLowerCase();
    const filtered = q
      ? allZones.filter(
          (tz) =>
            tz.toLowerCase().includes(q) ||
            formatTimezoneLabel(tz).toLowerCase().includes(q),
        )
      : allZones;
    const visible = filtered.slice(0, 80); // cap for performance

    return html`
      <div
        class="tz-picker-dropdown"
        @click=${(e: Event) => e.stopPropagation()}
      >
        <div class="tz-search-wrap">
          <input
            class="tz-search-input"
            type="text"
            placeholder="Search timezone…"
            .value=${this._tzSearch}
            @input=${(e: Event) =>
              (this._tzSearch = (e.target as HTMLInputElement).value)}
          />
        </div>
        <ul class="tz-list">
          ${visible.map(
            (tz) => html`
              <li
                class="tz-item ${this._selectedTz === tz
                  ? "tz-item--active"
                  : ""}"
                @click=${() => {
                  this._selectedTz = tz;
                  this._tzSearch = "";
                  this.openPicker = null;
                }}
              >
                ${formatTimezoneLabel(tz)}
              </li>
            `,
          )}
          ${visible.length === 0
            ? html`<li class="tz-item tz-item--empty">No results</li>`
            : nothing}
        </ul>
      </div>
    `;
  }

  // ─── Calendar nav helper ───────────────────────────────────────────────────

  private _navCal(which: "start" | "end" | "recurrenceUntil", delta: -1 | 1) {
    const prev =
      which === "start"
        ? this.startCal
        : which === "end"
          ? this.endCal
          : this.recurrenceCal;
    let { viewYear: y, viewMonth: m } = prev;
    m += delta;
    if (m < 0) {
      m = 11;
      y--;
    }
    if (m > 11) {
      m = 0;
      y++;
    }
    const next: CalState = { viewYear: y, viewMonth: m };
    if (which === "start") this.startCal = next;
    else if (which === "end") this.endCal = next;
    else this.recurrenceCal = next;
  }

  // ─── Render View Mode ──────────────────────────────────────────────────────

  private _renderViewMode(draft: EventDraft) {
    let displayStartDate = draft.startDate;
    let displayEndDate = draft.endDate;
    let startTimeVal = draft.startTime;
    let endTimeVal = draft.endTime;

    const occMatch = this.eventId
      ? this.eventId.match(/^(.+)_occ_(\d+)$/)
      : null;
    if (occMatch) {
      const occStartMs = parseInt(occMatch[2], 10);
      if (!isNaN(occStartMs)) {
        try {
          const tz = this._selectedTz;
          const baseStartIso = zonedInputToISO(
            draft.startDate,
            draft.startTime,
            tz,
          );
          const baseEndIso = zonedInputToISO(draft.endDate, draft.endTime, tz);
          const durationMs =
            new Date(baseEndIso).getTime() - new Date(baseStartIso).getTime();

          const occEndMs = occStartMs + durationMs;

          const startParts = isoToZonedDisplay(
            new Date(occStartMs).toISOString(),
            tz,
          );
          const endParts = isoToZonedDisplay(
            new Date(occEndMs).toISOString(),
            tz,
          );

          displayStartDate = startParts.date;
          displayEndDate = endParts.date;
          startTimeVal = startParts.time;
          endTimeVal = endParts.time;
        } catch {
          // Fallback to draft dates on failure
        }
      }
    }

    const multiDay = displayStartDate !== displayEndDate;

    const displayDate = multiDay
      ? `${formatDate(displayStartDate)} – ${formatDate(displayEndDate)}`
      : formatDate(displayStartDate);

    const displayTime = draft.allDay
      ? "All-day event"
      : `${formatTime(startTimeVal)} – ${formatTime(endTimeVal)}`;

    const color = draft.activeColor || "primary";

    return html`
      <div class="view-panel">
        <!-- Colour accent bar + title block -->
        <div class="view-hero color-${color}">
          <div class="view-hero-bar"></div>
          <div class="view-hero-body">
            <div class="view-hero-top">
              <button
                class="close-btn"
                @click=${() => this._onClose(false)}
                aria-label="Close"
              >
                ${XIcon()}
              </button>
            </div>
            <h2 class="view-hero-title">${draft.title || "Untitled Event"}</h2>
            <div class="view-hero-datetime">
              <span class="view-hero-datetime-icon">${CalendarIcon()}</span>
              ${draft.allDay
                ? html`
                    <span>${displayDate}</span>
                    <span class="view-hero-sep">·</span>
                    <span class="view-allday-badge">All-day</span>
                  `
                : multiDay
                  ? html`
                      <span>
                        ${formatDate(displayStartDate)},
                        ${formatTime(startTimeVal)} –
                        ${formatDate(displayEndDate)}, ${formatTime(endTimeVal)}
                      </span>
                    `
                  : html`
                      <span>${displayDate}</span>
                      <span class="view-hero-sep">·</span>
                      <span class="view-hero-datetime-icon"
                        >${ClockIcon()}</span
                      >
                      <span>${displayTime}</span>
                    `}
            </div>
            ${draft.recurrenceRule
              ? html`
                  <div class="view-hero-recurrence">
                    ${RepeatIcon()}
                    <span>${formatRecurrence(draft.recurrenceRule)}</span>
                  </div>
                `
              : nothing}
          </div>
        </div>

        <!-- Body -->
        <div class="view-body">
          <!-- Participants -->
          <div class="view-section">
            <div class="view-section-label">Participants</div>
            <div class="view-participants-list">
              ${draft.participants.map((p: string, idx: number) => {
                const name = this._resolveResourceName(p);
                const res = schedulerStore.getState().resources[p];
                const isLead = idx === 0;
                return html`
                  <div class="view-participant-item">
                    ${avatarHtml(name, res?.avatar)}
                    <div class="view-participant-info">
                      <span class="view-participant-name">${name}</span>
                      ${isLead
                        ? html`<span class="view-participant-role-badge"
                            >Primary</span
                          >`
                        : nothing}
                    </div>
                  </div>
                `;
              })}
              ${draft.participants.length === 0
                ? html`
                    <div class="view-empty-row">No participants assigned</div>
                  `
                : nothing}
            </div>
          </div>

          <!-- Description -->
          ${draft.description
            ? html`
                <div class="view-section">
                  <div class="view-section-label">Description</div>
                  <div class="view-desc">${draft.description}</div>
                </div>
              `
            : nothing}

          <!-- Meta row: timezone + color -->
          <div class="view-meta-row">
            <div class="view-meta-chip">
              ${GlobeIcon()}
              <span
                >${this._selectedTz.split("/").pop()?.replace(/_/g, " ") ??
                this._selectedTz}</span
              >
            </div>
            <div class="view-meta-chip">
              <span class="view-color-dot swatch-${color}"></span>
              <span class="capitalize">${color}</span>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="view-footer">
          <button class="btn-delete" @click=${this._onDeleteClick}>
            ${TrashIcon()} Delete
          </button>
          <div class="view-footer-right">
            <button class="btn-cancel" @click=${() => this._onClose(false)}>
              Close
            </button>
            <button
              class="btn-edit-event color-btn-${color}"
              @click=${() => (this._isEditing = true)}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                style="margin-right:4px;vertical-align:middle;"
              >
                <path d="M12 20h9" />
                <path
                  d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
                />
              </svg>
              Edit Event
            </button>
          </div>
        </div>
      </div>
    `;
  }
  // ─── Render ────────────────────────────────────────────────────────────────

  render() {
    const draft = schedulerStore.getState().eventDraft;
    if (!draft) return nothing;

    const invalid = this._invalid;
    const timeInvalid = this._timeInvalid;

    const multiDay = draft.startDate !== draft.endDate;

    const sidebarDate = multiDay
      ? `${formatDateShort(draft.startDate)} – ${formatDateShort(draft.endDate)}`
      : formatDate(draft.startDate);

    // When multi-day, attach the date to each time so the sidebar is unambiguous
    const sidebarTime = draft.allDay
      ? "All-day"
      : multiDay
        ? `${formatDateShort(draft.startDate)}, ${formatTime(draft.startTime)} – ${formatDateShort(draft.endDate)}, ${formatTime(draft.endTime)}`
        : `${formatTime(draft.startTime)} – ${formatTime(draft.endTime)}`;

    return html`
      ${this.brandColor
        ? html`<style>
            :host {
              --janus-primary-color: ${this.brandColor};
            }
          </style>`
        : nothing}
      <div
        class="overlay"
        @click=${(e: Event) =>
          e.target === e.currentTarget && this._onClose(false)}
      >
        ${this._showCreateConfirm
          ? this._renderConfirmDialog(draft)
          : this._showDeleteConfirm
            ? this._renderDeleteConfirmDialog(draft)
            : html`
                <div
                  class="modal ${this._isEditing ? "" : "modal--view"}"
                  role="dialog"
                  aria-modal="true"
                >
                  ${!this._isEditing
                    ? this._renderViewMode(draft)
                    : html`
                        <!-- ── Sidebar ─────────────────────────────────────────────────── -->
                        <aside
                          class="sidebar ${this.sidebarOpen
                            ? "sidebar--open"
                            : ""}"
                        >
                          <div
                            class="sidebar-accent color-${draft.activeColor}"
                          ></div>
                          <div class="sidebar-top">
                            <div class="sidebar-event-badge">Event</div>
                            <h2 class="sidebar-title">
                              ${draft.title || "Untitled Event"}
                            </h2>
                          </div>
                          <div class="sidebar-meta">
                            <div class="meta-item">
                              <span class="meta-icon">${CalendarIcon()}</span>
                              <div>
                                <div class="meta-label">Date</div>
                                <div class="meta-value">
                                  ${sidebarDate || "—"}
                                </div>
                              </div>
                            </div>
                            <div class="meta-item">
                              <span class="meta-icon">${ClockIcon()}</span>
                              <div>
                                <div class="meta-label">Time</div>
                                <div class="meta-value">${sidebarTime}</div>
                              </div>
                            </div>
                            ${draft.recurrenceRule
                              ? html`
                                  <div class="meta-item">
                                    <span
                                      class="meta-icon"
                                      style="color: var(--c-${draft.activeColor});"
                                    >
                                      ${RepeatIcon()}
                                    </span>
                                    <div>
                                      <div class="meta-label">Repeat</div>
                                      <div class="meta-value">
                                        ${formatRecurrence(
                                          draft.recurrenceRule,
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                `
                              : nothing}
                            <div class="meta-item">
                              <span class="meta-icon">${UsersIcon()}</span>
                              <div>
                                <div class="meta-label">Participants</div>
                                <div class="meta-value">
                                  ${draft.participants.length}
                                  ${draft.participants.length === 1
                                    ? "person"
                                    : "people"}
                                </div>
                                <div class="avatar-stack">
                                  ${draft.participants
                                    .slice(0, 4)
                                    .map((n) =>
                                      avatarHtml(
                                        this._resolveResourceName(n),
                                        schedulerStore.getState().resources[n]
                                          ?.avatar,
                                      ),
                                    )}
                                  ${draft.participants.length > 4
                                    ? html`<span class="avatar avatar-more"
                                        >+${draft.participants.length - 4}</span
                                      >`
                                    : nothing}
                                </div>
                              </div>
                            </div>
                            <div class="meta-item">
                              <span class="meta-icon">${TagIcon()}</span>
                              <div class="color-meta-block">
                                <div class="meta-label">Color</div>
                                <div class="swatches">
                                  ${COLORS.map(
                                    (c) =>
                                      html`<button
                                        class="swatch swatch-${c} ${draft.activeColor ===
                                        c
                                          ? "active"
                                          : ""}"
                                        @click=${() =>
                                          schedulerStore
                                            .getState()
                                            .updateDraft({ activeColor: c })}
                                        aria-label="${c} color"
                                      ></button>`,
                                  )}
                                </div>
                              </div>
                            </div>
                            <div class="meta-item">
                              <span class="meta-icon">${BellIcon()}</span>
                              <div>
                                <div class="meta-label">Reminder</div>
                                <div class="meta-value">15 min before</div>
                              </div>
                            </div>
                          </div>
                          ${this.eventId
                            ? html`
                                <div class="sidebar-footer">
                                  <button
                                    class="btn-delete"
                                    @click=${this._onDeleteClick}
                                  >
                                    ${TrashIcon()} Delete Event
                                  </button>
                                </div>
                              `
                            : nothing}
                        </aside>

                        <!-- ── Panel ───────────────────────────────────────────────────── -->
                        <div class="panel">
                          <div class="panel-header">
                            <div class="panel-header-left">
                              <button
                                class="mobile-summary-btn"
                                @click=${() =>
                                  (this.sidebarOpen = !this.sidebarOpen)}
                                aria-label="Toggle event summary"
                              >
                                <div class="dot dot-${draft.activeColor}"></div>
                                <span class="mobile-summary-title"
                                  >${draft.title || "Untitled"}</span
                                >
                                <span
                                  class="chevron ${this.sidebarOpen
                                    ? "chevron--up"
                                    : ""}"
                                  >${ChevronDownIcon()}</span
                                >
                              </button>
                              <span class="panel-heading"
                                >${this.eventId
                                  ? "Edit Event"
                                  : "Create Event"}</span
                              >
                            </div>
                            <button
                              class="close-btn"
                              @click=${() => this._onClose(true)}
                              aria-label="Close"
                            >
                              ${XIcon()}
                            </button>
                          </div>

                          <!-- Mobile summary strip -->
                          <div
                            class="mobile-summary-panel ${this.sidebarOpen
                              ? "mobile-summary-panel--open"
                              : ""}"
                          >
                            <div class="mobile-summary-grid">
                              <div class="msummary-item">
                                <span class="meta-label">Start</span>
                                <span class="meta-value"
                                  >${formatDateShort(draft.startDate)}
                                  ${draft.allDay
                                    ? ""
                                    : formatTime(draft.startTime)}</span
                                >
                              </div>
                              <div class="msummary-item">
                                <span class="meta-label">End</span>
                                <span class="meta-value"
                                  >${formatDateShort(draft.endDate)}
                                  ${draft.allDay
                                    ? ""
                                    : formatTime(draft.endTime)}</span
                                >
                              </div>
                              <div class="msummary-item">
                                <span class="meta-label">Participants</span>
                                <span class="meta-value"
                                  >${draft.participants.length} people</span
                                >
                              </div>
                              ${draft.recurrenceRule
                                ? html`
                                    <div class="msummary-item">
                                      <span class="meta-label">Repeat</span>
                                      <span class="meta-value"
                                        >${formatRecurrence(
                                          draft.recurrenceRule,
                                        )}</span
                                      >
                                    </div>
                                  `
                                : nothing}
                              <div class="msummary-item">
                                <span class="meta-label">Color</span>
                                <div class="swatches swatches--sm">
                                  ${COLORS.map(
                                    (c) =>
                                      html`<button
                                        class="swatch swatch-${c} ${draft.activeColor ===
                                        c
                                          ? "active"
                                          : ""}"
                                        @click=${() =>
                                          schedulerStore
                                            .getState()
                                            .updateDraft({ activeColor: c })}
                                      ></button>`,
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div class="panel-body">
                            ${this.error
                              ? html` <div class="error-alert">
                                  <span class="error-icon">!</span>
                                  <span class="error-message"
                                    >${this.error}</span
                                  >
                                </div>`
                              : nothing}

                            <!-- Basic Info -->
                            <div class="form-section">
                              <div class="section-label">Basic Info</div>
                              <div class="form-group">
                                <label for="event-title">Event Title</label>
                                <input
                                  id="event-title"
                                  type="text"
                                  .value=${draft.title}
                                  @input=${(e: Event) => {
                                    this._titleTouched = true;
                                    schedulerStore.getState().updateDraft({
                                      title: (e.target as HTMLInputElement)
                                        .value,
                                    });
                                  }}
                                  @blur=${() => {
                                    this._titleTouched = true;
                                  }}
                                  placeholder="Add a title…"
                                />
                                ${this._titleTouched &&
                                (!draft.title || !draft.title.trim())
                                  ? html`<div
                                      class="dt-invalid-notice"
                                      style="margin-top: 6px;"
                                    >
                                      <span>⚠</span>
                                      <span>Event Title is required.</span>
                                    </div>`
                                  : nothing}
                              </div>
                            </div>

                            <!-- Date & Time -->
                            <div class="form-section">
                              <div class="section-label">Date &amp; Time</div>

                              <!-- Switches Row -->
                              <div class="toggle-row">
                                <div class="toggle-control">
                                  <span class="toggle-label" id="all-day-label"
                                    >All-day Event</span
                                  >
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked="${draft.allDay
                                      ? "true"
                                      : "false"}"
                                    aria-labelledby="all-day-label"
                                    class="switch-btn ${draft.allDay
                                      ? "switch-btn--active"
                                      : ""}"
                                    @click=${this._toggleAllDay}
                                  >
                                    <span class="switch-slider"></span>
                                  </button>
                                </div>
                                <div class="toggle-control">
                                  <span class="toggle-label" id="repeat-label"
                                    >Repeat Event</span
                                  >
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked="${draft.recurrenceRule
                                      ? "true"
                                      : "false"}"
                                    aria-labelledby="repeat-label"
                                    class="switch-btn ${draft.recurrenceRule
                                      ? "switch-btn--active"
                                      : ""}"
                                    @click=${this._toggleRepeat}
                                  >
                                    <span class="switch-slider"></span>
                                  </button>
                                </div>
                              </div>

                              <!-- Recurrence Options -->
                              ${draft.recurrenceRule
                                ? html`
                                    <div class="recurrence-section">
                                      <div class="dt-row-label">
                                        Repeat Frequency
                                      </div>
                                      <div class="recurrence-freq-selector">
                                        ${[
                                          "Daily",
                                          "Weekly",
                                          "Monthly",
                                          "Yearly",
                                        ].map(
                                          (freq) => html`
                                            <button
                                              type="button"
                                              class="freq-pill ${this
                                                ._recurrenceFreq === freq
                                                ? "freq-pill--active"
                                                : ""}"
                                              @click=${() =>
                                                this._setRepeatFreq(
                                                  freq as
                                                    | "Daily"
                                                    | "Weekly"
                                                    | "Monthly"
                                                    | "Yearly",
                                                )}
                                            >
                                              ${freq}
                                            </button>
                                          `,
                                        )}
                                      </div>
                                      <div
                                        class="dt-row-label"
                                        style="margin-top: 10px;"
                                      >
                                        Repeat Until
                                      </div>
                                      <div class="dt-row">
                                        <div class="dt-cell dt-cell--date">
                                          ${this._triggerBtn(
                                            CalendarIcon(),
                                            this._recurrenceUntilDate
                                              ? formatDateShort(
                                                  this._recurrenceUntilDate,
                                                )
                                              : "Never Ends",
                                            this.openPicker ===
                                              "recurrenceUntil",
                                            false,
                                            "recurrenceUntil",
                                          )}
                                          ${this.openPicker ===
                                          "recurrenceUntil"
                                            ? this._calPicker(
                                                "recurrenceUntil",
                                                this._recurrenceUntilDate,
                                                this.recurrenceCal,
                                                (d) =>
                                                  this._navCal(
                                                    "recurrenceUntil",
                                                    d,
                                                  ),
                                              )
                                            : nothing}
                                        </div>
                                        ${this._recurrenceUntilDate
                                          ? html`
                                              <button
                                                type="button"
                                                class="btn-clear-until"
                                                @click=${() => {
                                                  this._recurrenceUntilDate =
                                                    "";
                                                  this._updateRecurrenceRule();
                                                }}
                                              >
                                                Clear End Date
                                              </button>
                                            `
                                          : nothing}
                                      </div>
                                    </div>
                                  `
                                : nothing}

                              <!-- START -->
                              <div class="dt-row-label">Start</div>
                              <div
                                class="dt-row ${draft.allDay
                                  ? "dt-row--all-day"
                                  : ""}"
                              >
                                <!-- Start date trigger + dropdown -->
                                <div class="dt-cell dt-cell--date">
                                  ${this._triggerBtn(
                                    CalendarIcon(),
                                    formatDateShort(draft.startDate),
                                    this.openPicker === "startDate",
                                    false,
                                    "startDate",
                                  )}
                                  ${this.openPicker === "startDate"
                                    ? this._calPicker(
                                        "start",
                                        draft.startDate,
                                        this.startCal,
                                        (d) => this._navCal("start", d),
                                      )
                                    : nothing}
                                </div>
                                <!-- Start time trigger + dropdown -->
                                ${draft.allDay
                                  ? nothing
                                  : html`
                                      <div class="dt-cell dt-cell--time">
                                        ${this._triggerBtn(
                                          ClockIcon(),
                                          formatTime(draft.startTime),
                                          this.openPicker === "startTime",
                                          false,
                                          "startTime",
                                        )}
                                        ${this.openPicker === "startTime"
                                          ? this._timePicker(
                                              "start",
                                              draft.startTime,
                                            )
                                          : nothing}
                                      </div>
                                    `}
                              </div>

                              <!-- END -->
                              <div class="dt-row-label dt-row-label--end">
                                End
                              </div>
                              <div
                                class="dt-row ${draft.allDay
                                  ? "dt-row--all-day"
                                  : ""}"
                              >
                                <!-- End date trigger + dropdown -->
                                <div class="dt-cell dt-cell--date">
                                  ${this._triggerBtn(
                                    CalendarIcon(),
                                    formatDateShort(draft.endDate),
                                    this.openPicker === "endDate",
                                    timeInvalid,
                                    "endDate",
                                  )}
                                  ${this.openPicker === "endDate"
                                    ? this._calPicker(
                                        "end",
                                        draft.endDate,
                                        this.endCal,
                                        (d) => this._navCal("end", d),
                                      )
                                    : nothing}
                                </div>
                                <!-- End time trigger + dropdown -->
                                ${draft.allDay
                                  ? nothing
                                  : html`
                                      <div class="dt-cell dt-cell--time">
                                        ${this._triggerBtn(
                                          ClockIcon(),
                                          formatTime(draft.endTime),
                                          this.openPicker === "endTime",
                                          timeInvalid,
                                          "endTime",
                                        )}
                                        ${this.openPicker === "endTime"
                                          ? this._timePicker(
                                              "end",
                                              draft.endTime,
                                            )
                                          : nothing}
                                      </div>
                                    `}
                              </div>

                              <!-- Validation warning -->
                              ${timeInvalid
                                ? html` <div class="dt-invalid-notice">
                                    <span>⚠</span>
                                    <span
                                      >End must be after start. Please adjust
                                      the date or time.</span
                                    >
                                  </div>`
                                : nothing}

                              <!-- Conflict warning -->
                              ${this._resourceConflict.hasConflict
                                ? html`<div
                                    class="dt-conflict-warning ${this
                                      .preventConflicts
                                      ? "dt-conflict-warning--blocking"
                                      : ""}"
                                  >
                                    <span>⚠</span>
                                    <span
                                      >${this._resourceConflict.message}${this
                                        .preventConflicts
                                        ? " (Saving disabled due to schedule conflict)"
                                        : ""}</span
                                    >
                                  </div>`
                                : nothing}

                              <!-- Timezone selector -->
                              <div class="dt-tz-row">
                                <div class="dt-row-label">Timezone</div>
                                <div class="dt-cell dt-cell--tz">
                                  ${this._triggerBtn(
                                    GlobeIcon(),
                                    this._selectedTz
                                      .split("/")
                                      .pop()
                                      ?.replace(/_/g, " ") ?? this._selectedTz,
                                    this.openPicker === "timezone",
                                    false,
                                    "timezone",
                                  )}
                                  ${this.openPicker === "timezone"
                                    ? this._timezonePicker()
                                    : nothing}
                                </div>
                              </div>
                            </div>

                            <!-- People -->
                            <div class="form-section">
                              <div class="section-label">People</div>
                              <div class="form-group">
                                <label>Participants</label>
                                <div
                                  class="participants-box ${this._shakeInput
                                    ? "shake"
                                    : ""}"
                                  @click=${() =>
                                    this.shadowRoot
                                      ?.getElementById("participant-input")
                                      ?.focus()}
                                >
                                  ${draft.participants.map((id) => {
                                    const name = this._resolveResourceName(id);
                                    const res =
                                      schedulerStore.getState().resources[id];
                                    return html` <span class="chip">
                                      ${avatarHtml(name, res?.avatar)} ${name}
                                      <button
                                        class="chip-remove"
                                        @click=${(e: Event) => {
                                          e.stopPropagation();
                                          this._removeParticipant(id);
                                        }}
                                      >
                                        ${XIcon()}
                                      </button>
                                    </span>`;
                                  })}
                                  <input
                                    id="participant-input"
                                    class="participant-inline-input"
                                    type="text"
                                    placeholder="Add people…"
                                    .value=${this.participantInput}
                                    @input=${(e: Event) => {
                                      this.participantInput = (
                                        e.target as HTMLInputElement
                                      ).value;
                                      this.activeSuggestionIndex = -1;
                                    }}
                                    @keydown=${this._handleParticipantKey}
                                  />
                                  <span class="search-icon-wrap"
                                    >${SearchIcon()}</span
                                  >
                                </div>

                                <!-- Suggestions Dropdown -->
                                ${this.participantInput.trim()
                                  ? html`
                                      <div class="suggestions-dropdown">
                                        ${this._matchingSuggestions.length > 0
                                          ? html`
                                              <ul>
                                                ${this._matchingSuggestions.map(
                                                  (res, index) => html`
                                                    <li
                                                      class="suggestion-item ${index ===
                                                      this.activeSuggestionIndex
                                                        ? "active"
                                                        : ""}"
                                                      @mousedown=${(
                                                        e: MouseEvent,
                                                      ) => {
                                                        e.preventDefault();
                                                        this._selectSuggestion(
                                                          res.id,
                                                        );
                                                      }}
                                                      @mouseenter=${() => {
                                                        this.activeSuggestionIndex =
                                                          index;
                                                      }}
                                                    >
                                                      ${avatarHtml(
                                                        res.name,
                                                        res.avatar,
                                                      )}
                                                      <div
                                                        class="suggestion-info"
                                                      >
                                                        <div
                                                          class="suggestion-name"
                                                        >
                                                          ${res.name}
                                                        </div>
                                                        <div
                                                          class="suggestion-id"
                                                        >
                                                          ${res.id}
                                                        </div>
                                                      </div>
                                                    </li>
                                                  `,
                                                )}
                                              </ul>
                                            `
                                          : html`
                                              <div class="suggestions-empty">
                                                No matching resources found
                                              </div>
                                            `}
                                      </div>
                                    `
                                  : nothing}
                                ${this._participantsTouched &&
                                (!draft.participants ||
                                  draft.participants.length === 0)
                                  ? html`<div
                                      class="dt-invalid-notice"
                                      style="margin-top: 6px;"
                                    >
                                      <span>⚠</span>
                                      <span
                                        >At least one participant is
                                        required.</span
                                      >
                                    </div>`
                                  : nothing}
                              </div>
                            </div>

                            <!-- Details -->
                            <div class="form-section">
                              <div class="section-label">Details</div>
                              <div class="form-group">
                                <label for="description">Description</label>
                                <textarea
                                  id="description"
                                  rows="4"
                                  .value=${draft.description}
                                  @input=${(e: Event) =>
                                    schedulerStore.getState().updateDraft({
                                      description: (
                                        e.target as HTMLTextAreaElement
                                      ).value,
                                    })}
                                  placeholder="Add a description…"
                                ></textarea>
                              </div>
                            </div>
                          </div>

                          <div class="panel-footer">
                            ${this.eventId
                              ? html`<button
                                  class="btn-delete btn-delete--footer"
                                  @click=${this._onDeleteClick}
                                >
                                  ${TrashIcon()} Delete
                                </button>`
                              : nothing}
                            <div class="footer-right">
                              <button
                                class="btn-cancel"
                                @click=${this._handleCancel}
                              >
                                Cancel
                              </button>
                              <button
                                class="btn-save"
                                ?disabled=${this._titleTouched &&
                                this._participantsTouched &&
                                invalid}
                                @click=${this._handleSaveClick}
                              >
                                ${this.eventId ? "Save" : "Create"}
                              </button>
                            </div>
                          </div>
                        </div>
                      `}
                </div>
              `}
      </div>
    `;
  }

  private _renderConfirmDialog(draft: EventDraft) {
    return html`
      <janus-confirm-dialog
        .draft=${draft}
        .resolveResourceName=${(pId: string) => this._resolveResourceName(pId)}
        title="Confirm new event"
        subtitle="Review the details before creating this event."
        confirmText="Confirm and create"
        cancelText="Back to edit"
        accentColor="primary"
        @confirm=${this._onConfirmCreate}
        @cancel=${() => (this._showCreateConfirm = false)}
      ></janus-confirm-dialog>
    `;
  }

  private _renderDeleteConfirmDialog(draft: EventDraft) {
    return html`
      <janus-confirm-dialog
        .draft=${draft}
        .resolveResourceName=${(pId: string) => this._resolveResourceName(pId)}
        title="Delete event?"
        subtitle="Are you sure you want to delete this event? This action cannot be undone."
        confirmText="Delete Event"
        cancelText="Cancel"
        accentColor="red"
        @confirm=${this._onConfirmDelete}
        @cancel=${() => (this._showDeleteConfirm = false)}
      ></janus-confirm-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "janus-scheduler": JanusScheduler;
  }
}
