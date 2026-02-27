import { useState } from "react";
import "./Scheduler.css";

const CalendarIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const ClockIcon = () => (
  <svg
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
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
);

const XIcon = () => (
  <svg
    width="16"
    height="16"
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

/* ── Avatar Placeholders ────────────────────── */
const avatarColors: { [key: string]: string } = {
  "John Doe": "",
  "Sarah Chen": "blue",
};

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
  const cls = avatarColors[name]
    ? `chip-avatar-placeholder ${avatarColors[name]}`
    : "chip-avatar-placeholder";
  return <span className={cls}>{initials}</span>;
}

/* ── Color Swatches ─────────────────────────── */
const COLORS = ["orange", "blue", "green", "yellow", "purple"];

/* ── Main Component ─────────────────────────── */
export default function Scheduler({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("Strategy Workshop");
  const [date, setDate] = useState("Oct 30, 2023");
  const [timeRange, setTimeRange] = useState("2:00 PM - 3:00 PM");
  const [participants, setParticipants] = useState(["John Doe", "Sarah Chen"]);
  const [participantInput, setParticipantInput] = useState("");
  const [description, setDescription] = useState(
    "Discussing the Q4 roadmap and resource allocation for upcoming projects.",
  );
  const [activeColor, setActiveColor] = useState("orange");

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

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* ── Header ── */}
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="header-icon">
              <CalendarIcon />
            </div>
            <h2 className="modal-title" id="modal-title">
              Edit Event
            </h2>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <XIcon />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="modal-body">
          {/* Event Title */}
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

          {/* Date & Time */}
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <div className="input-wrap has-icon">
                <span className="input-icon">
                  <CalendarIcon />
                </span>
                <input
                  type="text"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  placeholder="Select date"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Time</label>
              <div className="input-wrap has-icon">
                <span className="input-icon">
                  <ClockIcon />
                </span>
                <input
                  type="text"
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  placeholder="Select time"
                />
              </div>
            </div>
          </div>

          {/* Participants */}
          <div className="form-group">
            <label>Participants</label>
            <button
              className="participants-box"
              onClick={() => {
                const input = document.getElementById(
                  "participant-input",
                ) as HTMLInputElement;
                input?.focus();
              }}
              type="button"
              aria-label="Add participants"
            >
              {participants.map((name) => (
                <span key={name} className="participant-chip">
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
                    ×
                  </button>
                </span>
              ))}
              <input
                id="participant-input"
                className="participants-input"
                type="text"
                placeholder="Add people…"
                value={participantInput}
                onChange={(e) => setParticipantInput(e.target.value)}
                onKeyDown={handleParticipantKey}
              />
              <span className="search-icon-participants">
                <SearchIcon />
              </span>
            </button>
          </div>

          {/* Description */}
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

          {/* Color & Reminder */}
          <div className="color-reminder-row">
            <div className="color-row">
              <span className="color-label">Event Color</span>
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={`color-swatch ${c}${activeColor === c ? " active" : ""}`}
                  onClick={() => setActiveColor(c)}
                  aria-label={`${c} color`}
                />
              ))}
            </div>
            <div className="reminder-badge">
              <BellIcon />
              15 min before
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="modal-footer">
          <button className="btn btn-delete">
            <TrashIcon />
            Delete Event
          </button>
          <div className="footer-right">
            <button className="btn btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-save">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}
