import { useState, useRef } from "react";
import "./Scheduler.css";

const CalendarIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const ClockIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const SearchIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const BellIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const TrashIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6M9 6V4h6v2" />
  </svg>
);

const XIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const UsersIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const TagIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const avatarPalette: { [key: string]: string } = {
  "John Doe": "orange",
  "Sarah Chen": "blue",
};

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
  const colorClass = avatarPalette[name]
    ? `avatar-${avatarPalette[name]}`
    : "avatar-orange";
  return <span className={`avatar ${colorClass}`}>{initials}</span>;
}

function formatDate(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(timeVal: string): string {
  if (!timeVal) return "";
  const [h, m] = timeVal.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

const COLORS = ["orange", "blue", "green", "yellow", "purple"];

export default function Scheduler({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("Strategy Workshop");
  const [date, setDate] = useState("2023-10-30");
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("15:00");
  const [participants, setParticipants] = useState(["John Doe", "Sarah Chen"]);
  const [participantInput, setParticipantInput] = useState("");
  const [description, setDescription] = useState(
    "Discussing the Q4 roadmap and resource allocation for upcoming projects.",
  );
  const [activeColor, setActiveColor] = useState("orange");

  const dateRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<HTMLInputElement>(null);
  const endTimeRef = useRef<HTMLInputElement>(null);

  const removeParticipant = (name: string) =>
    setParticipants((prev) => prev.filter((p) => p !== name));

  const handleParticipantKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && participantInput.trim()) {
      e.preventDefault();
      setParticipants((prev) => [...prev, participantInput.trim()]);
      setParticipantInput("");
    }
    if (e.key === "Backspace" && !participantInput && participants.length) {
      setParticipants((prev) => prev.slice(0, -1));
    }
  };

  const timeDisplay =
    startTime && endTime
      ? `${formatTime(startTime)} – ${formatTime(endTime)}`
      : "—";

  return (
    <div
      className="overlay"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="modal" role="dialog" aria-modal="true">
        {/* ── LEFT SIDEBAR ── */}
        <aside className="sidebar">
          <div className={`sidebar-accent color-${activeColor}`} />

          <div className="sidebar-top">
            <div className="sidebar-event-badge">Event</div>
            <h2 className="sidebar-title">{title || "Untitled Event"}</h2>
          </div>

          <div className="sidebar-meta">
            <div className="meta-item">
              <span className="meta-icon">
                <CalendarIcon />
              </span>
              <div>
                <div className="meta-label">Date</div>
                <div className="meta-value">
                  {date ? formatDate(date) : "—"}
                </div>
              </div>
            </div>

            <div className="meta-item">
              <span className="meta-icon">
                <ClockIcon />
              </span>
              <div>
                <div className="meta-label">Time</div>
                <div className="meta-value">{timeDisplay}</div>
              </div>
            </div>

            <div className="meta-item">
              <span className="meta-icon">
                <UsersIcon />
              </span>
              <div>
                <div className="meta-label">Participants</div>
                <div className="meta-value">
                  {participants.length}{" "}
                  {participants.length === 1 ? "person" : "people"}
                </div>
                <div className="avatar-stack">
                  {participants.slice(0, 4).map((name) => (
                    <Avatar key={name} name={name} />
                  ))}
                  {participants.length > 4 && (
                    <span className="avatar avatar-more">
                      +{participants.length - 4}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="meta-item">
              <span className="meta-icon">
                <TagIcon />
              </span>
              <div className="color-meta-block">
                <div className="meta-label">Color</div>
                <div className="swatches">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      className={`swatch swatch-${c}${activeColor === c ? " active" : ""}`}
                      onClick={() => setActiveColor(c)}
                      aria-label={`${c} color`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="meta-item">
              <span className="meta-icon">
                <BellIcon />
              </span>
              <div>
                <div className="meta-label">Reminder</div>
                <div className="meta-value">15 min before</div>
              </div>
            </div>
          </div>

          <div className="sidebar-footer">
            <button className="btn-delete">
              <TrashIcon /> Delete Event
            </button>
          </div>
        </aside>

        {/* ── RIGHT PANEL ── */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-heading">Edit Event</span>
            <button className="close-btn" onClick={onClose} aria-label="Close">
              <XIcon />
            </button>
          </div>

          <div className="panel-body">
            {/* Section: Basic Info */}
            <div className="form-section">
              <div className="section-label">Basic Info</div>

              <div className="form-group">
                <label htmlFor="event-title">Event Title</label>
                <input
                  id="event-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Add a title…"
                />
              </div>

              {/* Date */}
              <div className="form-group">
                <label>Date</label>
                <div
                  className="input-icon-wrap"
                  onClick={() => dateRef.current?.showPicker()}
                >
                  <span className="input-icon">
                    <CalendarIcon />
                  </span>
                  <input
                    ref={dateRef}
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="date-time-input"
                  />
                </div>
              </div>

              {/* Time row */}
              <div className="form-row">
                <div className="form-group">
                  <label>Start Time</label>
                  <div
                    className="input-icon-wrap"
                    onClick={() => startTimeRef.current?.showPicker()}
                  >
                    <span className="input-icon">
                      <ClockIcon />
                    </span>
                    <input
                      ref={startTimeRef}
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="date-time-input"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <div
                    className="input-icon-wrap"
                    onClick={() => endTimeRef.current?.showPicker()}
                  >
                    <span className="input-icon">
                      <ClockIcon />
                    </span>
                    <input
                      ref={endTimeRef}
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="date-time-input"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section: People */}
            <div className="form-section">
              <div className="section-label">People</div>
              <div className="form-group">
                <label>Participants</label>
                <button
                  className="participants-box"
                  type="button"
                  onClick={() =>
                    (
                      document.getElementById(
                        "participant-input",
                      ) as HTMLInputElement
                    )?.focus()
                  }
                >
                  {participants.map((name) => (
                    <span key={name} className="chip">
                      <Avatar name={name} />
                      {name}
                      <button
                        className="chip-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeParticipant(name);
                        }}
                        aria-label={`Remove ${name}`}
                      >
                        <XIcon />
                      </button>
                    </span>
                  ))}
                  <input
                    id="participant-input"
                    className="participant-inline-input"
                    type="text"
                    placeholder="Add people…"
                    value={participantInput}
                    onChange={(e) => setParticipantInput(e.target.value)}
                    onKeyDown={handleParticipantKey}
                  />
                  <span className="search-icon-wrap">
                    <SearchIcon />
                  </span>
                </button>
              </div>
            </div>

            {/* Section: Details */}
            <div className="form-section">
              <div className="section-label">Details</div>
              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description…"
                  rows={4}
                />
              </div>
            </div>
          </div>

          <div className="panel-footer">
            <button className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-save">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}
