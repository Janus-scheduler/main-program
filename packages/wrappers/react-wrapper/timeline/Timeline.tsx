import { useEffect, useRef, useState } from "react";
import "./Timeline.css";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface TimelineEvent {
  id: string;
  title: string;
  startTime: string; // "HH:MM" 24h
  endTime: string; // "HH:MM" 24h
  color: "orange" | "blue" | "yellow" | "purple" | "green";
  date?: string;
}

export interface TimelineResource {
  id: string;
  name: string;
  subtitle: string;
  avatarType: "initials" | "icon";
  avatarIcon?: "room" | "equipment";
  groupLabel?: string;
  events: TimelineEvent[];
}

// ── Icons ──────────────────────────────────────────────────────────────────────
const RoomIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
  </svg>
);

const EquipmentIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="18"
    height="18"
  >
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

const ChevronLeft = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="16"
    height="16"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRight = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="16"
    height="16"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const SearchIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="18"
    height="18"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const BellIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="18"
    height="18"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const UserIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="28"
    height="28"
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="9" r="3" />
    <path d="M6.168 18.849A4 4 0 0 1 10 17h4a4 4 0 0 1 3.832 1.849" />
  </svg>
);

const PlusIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    width="22"
    height="22"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const SparkleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
    <path
      d="M12 2l2.09 6.41L20.5 10l-6.41 2.09L12 18.5l-2.09-6.41L3.5 10l6.41-2.09L12 2z"
      fill="#f97316"
    />
    <path
      d="M5 3l.75 2.25L8 6l-2.25.75L5 9l-.75-2.25L2 6l2.25-.75L5 3z"
      fill="#f97316"
      opacity="0.5"
    />
  </svg>
);

// Sidebar icons
const GridIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const PeopleIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="18"
    height="18"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const DoorIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="18"
    height="18"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </svg>
);

const SettingsIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="18"
    height="18"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

// ── Constants ──────────────────────────────────────────────────────────────────
const HOUR_START = 0;
const HOUR_WIDTH = 80; // px per hour — narrower so scroll kicks in naturally
//const ROW_HEIGHT    = 72;   // px per resource row
//const HEADER_H      = 40;   // px for hour header row
//const GROUP_LABEL_H = 32;   // px for group label rows

// Full 24-hour axis — total width 1920px, wider than any screen → scroll always available
const VISIBLE_HOURS = Array.from({ length: 24 }, (_, i) => i); // 0, 1, 2 … 23

// ── Helpers ────────────────────────────────────────────────────────────────────
function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const AVATAR_PALETTE = [
  "#f97316",
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
];
function avatarColor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + (c.codePointAt(0) ?? 0)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function eventStyle(ev: TimelineEvent) {
  const left = ((toMin(ev.startTime) - HOUR_START * 60) / 60) * HOUR_WIDTH + 2;
  const width =
    ((toMin(ev.endTime) - toMin(ev.startTime)) / 60) * HOUR_WIDTH - 6;
  return { left, width };
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0]; // "YYYY-MM-DD"
}

function nowLeft() {
  const now = new Date();
  return (
    ((now.getHours() * 60 + now.getMinutes() - HOUR_START * 60) / 60) *
    HOUR_WIDTH
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function Avatar({ resource }: { readonly resource: TimelineResource }) {
  if (resource.avatarType === "initials") {
    return (
      <span
        className="tl-avatar tl-avatar--initials"
        style={{ background: avatarColor(resource.id) }}
      >
        {getInitials(resource.name)}
      </span>
    );
  }
  return (
    <span
      className={`tl-avatar tl-avatar--icon tl-avatar--${resource.avatarIcon}`}
    >
      {resource.avatarIcon === "room" && <RoomIcon />}
      {resource.avatarIcon === "equipment" && <EquipmentIcon />}
      {resource.avatarIcon === "equipment" && <EquipmentIcon />}
    </span>
  );
}

function EventBlock({
  ev,
  onClick,
}: {
  readonly ev: TimelineEvent;
  readonly onClick: () => void;
}) {
  const { left, width } = eventStyle(ev);
  return (
    <button
      className={`tl-event tl-event--${ev.color}`}
      style={{ left, width }}
      onClick={onClick}
    >
      <span className="tl-event__title">{ev.title}</span>
      <span className="tl-event__time">
        {fmt12(ev.startTime)} – {fmt12(ev.endTime)}
      </span>
    </button>
  );
}

// ── Sample data ────────────────────────────────────────────────────────────────
const TODAY_STR = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"

const SAMPLE: TimelineResource[] = [
  {
    id: "alex",
    name: "Alex Rivera",
    subtitle: "Consultant",
    avatarType: "initials",
    groupLabel: "STAFF",
    events: [
      {
        id: "e1",
        title: "Design Sync",
        startTime: "08:00",
        endTime: "10:00",
        color: "orange",
        date: TODAY_STR,
      },
      {
        id: "e2",
        title: "Client Call",
        startTime: "11:00",
        endTime: "12:30",
        color: "blue",
        date: TODAY_STR,
      },
    ],
  },
  {
    id: "sam",
    name: "Sam Smith",
    subtitle: "Lead Technician",
    avatarType: "initials",
    events: [],
  },
  {
    id: "conf",
    name: "Conference Room A",
    subtitle: "Level 2, Wing B",
    avatarType: "icon",
    avatarIcon: "room",
    groupLabel: "ROOMS",
    events: [
      {
        id: "e3",
        title: "Strategy Workshop",
        startTime: "10:00",
        endTime: "13:00",
        color: "yellow",
        date: TODAY_STR,
      },
    ],
  },
  {
    id: "diag",
    name: "Diagnostic Suite 1",
    subtitle: "Main Level",
    avatarType: "icon",
    avatarIcon: "room",
    events: [
      {
        id: "e4",
        title: "Patient X Scan",
        startTime: "13:00",
        endTime: "15:00",
        color: "purple",
        date: TODAY_STR,
      },
    ],
  },
  {
    id: "mri",
    name: "MRI Scanner XR-300",
    subtitle: "Fixed Asset #992",
    avatarType: "icon",
    avatarIcon: "equipment",
    groupLabel: "EQUIPMENT",
    events: [
      {
        id: "e5",
        title: "Scanner Use: Patient X",
        startTime: "13:00",
        endTime: "15:00",
        color: "purple",
        date: TODAY_STR,
      },
    ],
  },
];

interface TimelineProps {
  resources?: TimelineResource[];
  onEventClick?: (ev: TimelineEvent) => void;
  onAddEvent?: () => void;
}

// ── Main component ─────────────────────────────────────────────────────────────
function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function ResourceEventRow({
  r,
  onEventClick,
}: {
  readonly r: TimelineResource;
  readonly onEventClick?: (ev: TimelineEvent) => void;
}) {
  return (
    <div className="tl-event-row">
      {VISIBLE_HOURS.map((h) => (
        <div
          key={h}
          className="tl-vline"
          style={{ left: (h - HOUR_START) * HOUR_WIDTH }}
        />
      ))}
      {r.events.map((ev) => (
        <EventBlock key={ev.id} ev={ev} onClick={() => onEventClick?.(ev)} />
      ))}
    </div>
  );
}

export default function Timeline({
  resources = SAMPLE,
  onEventClick,
  onAddEvent,
}: Readonly<TimelineProps>) {
  const [view, setView] = useState<"Timeline" | "Month">("Timeline");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [aiPrompt, setAiPrompt] = useState("");

  function goToPrevDay() {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  }

  function goToNextDay() {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  // Sync vertical scroll between resource column and grid
  const resourceColRef = useRef<HTMLDivElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);

  function onGridScroll() {
    if (resourceColRef.current && gridScrollRef.current)
      resourceColRef.current.scrollTop = gridScrollRef.current.scrollTop;
  }

  // On mount: scroll horizontally so 8:00 AM is the first visible hour
  useEffect(() => {
    if (gridScrollRef.current) {
      gridScrollRef.current.scrollLeft = 8 * HOUR_WIDTH; // 8 hours × 80px
    }
  }, []);

  const activeDateStr = toDateStr(currentDate);

  // Filter resources — only show events matching current date
  const filteredResources = resources.map((r: TimelineResource) => ({
    ...r,
    events: r.events.filter(
      (ev: TimelineEvent) => !ev.date || ev.date === activeDateStr,
    ),
  }));

  // Build grouped list
  const groups: { label: string; items: TimelineResource[] }[] = [];
  let cur: (typeof groups)[0] | null = null;
  for (const r of filteredResources) {
    if (r.groupLabel) {
      cur = { label: r.groupLabel, items: [r] };
      groups.push(cur);
    } else if (cur) cur.items.push(r);
    else {
      cur = { label: "", items: [r] };
      groups.push(cur);
    }
  }

  const totalW = VISIBLE_HOURS.length * HOUR_WIDTH;
  const nl = nowLeft();

  return (
    <div className="tl-shell">
      {/* ══ Top Bar ══════════════════════════════════════════════════════════ */}
      <header className="tl-topbar">
        <div className="tl-brand">
          <span className="tl-brand__icon">J</span>
          <span className="tl-brand__name">Janus</span>
        </div>

        <nav className="tl-nav">
          <button
            className="tl-nav__arrow"
            aria-label="Previous"
            onClick={goToPrevDay}
          >
            <ChevronLeft />
          </button>
          <button className="tl-nav__today" onClick={goToToday}>
            Today
          </button>
          <button
            className="tl-nav__arrow"
            aria-label="Next"
            onClick={goToNextDay}
          >
            <ChevronRight />
          </button>
          <span className="tl-nav__date">{formatDate(currentDate)}</span>
          {/* Short date — shown only on small screens */}
          <span className="tl-nav__date--short">
            {currentDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        </nav>

        <div className="tl-topbar__right">
          <div className="tl-view-toggle">
            {(["Timeline", "Month"] as const).map((v) => (
              <button
                key={v}
                className={`tl-view-toggle__btn${view === v ? " active" : ""}`}
                onClick={() => setView(v)}
              >
                {v}
              </button>
            ))}
          </div>
          <button className="tl-icon-btn" aria-label="Search">
            <SearchIcon />
          </button>
          <button
            className="tl-icon-btn tl-icon-btn--bell"
            aria-label="Notifications"
          >
            <BellIcon />
            <span className="tl-bell-dot" />
          </button>
          <button className="tl-icon-btn" aria-label="Account">
            <UserIcon />
          </button>
        </div>
      </header>

      {/* ══ Body ════════════════════════════════════════════════════════════ */}
      <div className="tl-body">
        {/* ── Left sidebar ── */}
        <aside className="tl-sidebar">
          <div className="tl-sidebar__nav">
            {[
              { label: "Dashboard", icon: <GridIcon />, active: true },
              { label: "People", icon: <PeopleIcon />, active: false },
              { label: "Rooms", icon: <DoorIcon />, active: false },
              { label: "Equipment", icon: <EquipmentIcon />, active: false },
              { label: "Settings", icon: <SettingsIcon />, active: false },
            ].map((item) => (
              <button
                key={item.label}
                className={`tl-sidebar__item${item.active ? " active" : ""}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="tl-sidebar__footer">
            <span className="tl-sidebar__version">Janus v3.4</span>
            <span className="tl-sidebar__status">All systems operational</span>
          </div>
        </aside>

        {/* ── Right area: timeline panel + AI bar below ── */}
        <div className="tl-right">
          {/* Timeline panel */}
          <div className="tl-panel">
            {/*
            TWO-COLUMN LAYOUT:
            Left  = fixed resource names column
            Right = horizontally scrollable time grid
            Both scroll vertically in sync
          */}
            <div className="tl-grid-wrap">
              {/* Fixed resource names column — scrolls vertically, hidden scrollbar */}
              <div className="tl-res-col" ref={resourceColRef}>
                {/* Header cell — aligns with hour header */}
                <div className="tl-res-col__header">RESOURCE</div>

                {groups.map((g) => (
                  <div key={g.label || "_nogroup"}>
                    {g.label && (
                      <div className="tl-res-group-label">{g.label}</div>
                    )}
                    {g.items.map((r) => (
                      <div key={r.id} className="tl-res-row">
                        <Avatar resource={r} />
                        <div className="tl-res-info">
                          <span className="tl-res-name">{r.name}</span>
                          <span className="tl-res-sub">{r.subtitle}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Scrollable time grid */}
              <div
                className="tl-time-scroll"
                ref={gridScrollRef}
                onScroll={onGridScroll}
              >
                <div className="tl-time-inner" style={{ width: totalW }}>
                  {/* Hour headers */}
                  <div className="tl-hour-header">
                    {VISIBLE_HOURS.map((h) => (
                      <div
                        key={h}
                        className="tl-hour-cell"
                        style={{ width: HOUR_WIDTH }}
                      >
                        {`${h.toString().padStart(2, "0")}:00`}
                      </div>
                    ))}
                  </div>

                  {/* "Now" vertical line */}
                  {nl > 0 && nl < totalW && (
                    <div className="tl-now-line" style={{ left: nl }}>
                      <span className="tl-now-dot" />
                    </div>
                  )}

                  {/* Event rows — mirrors resource column exactly */}
                  {groups.map((g) => (
                    <div key={g.label || "_nogroup"}>
                      {g.label && <div className="tl-group-spacer" />}
                      {g.items.map((r) => (
                        <ResourceEventRow
                          key={r.id}
                          r={r}
                          onEventClick={onEventClick}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* end tl-panel */}

            {/* ══ AI floating card — sits at bottom of right area ══ */}
            <div className="tl-ai-wrap">
              <div className="tl-ai-card">
                <SparkleIcon />
                <input
                  className="tl-ai-card__input"
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Try 'Schedule a design sync with Alex tomorrow at 10am in Room A'"
                />
                <button className="tl-ai-card__btn">Schedule</button>
              </div>
            </div>
          </div>
          {/* end tl-right */}
        </div>
        {/* end tl-body */}

        {/* ══ FAB ════════════════════════════════════════════════════════════ */}
        <button className="tl-fab" onClick={onAddEvent} aria-label="Add event">
          <PlusIcon />
        </button>
      </div>
    </div>
  );
}
