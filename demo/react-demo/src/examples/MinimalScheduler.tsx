/**
 * A complete scheduler with a custom layout, built with `useJanusScheduler`.
 *
 * This is the Tier-2 equivalent of `components/SchedulerView.tsx` (609 lines):
 * same five views, same editor modal, same drag/resize/create/save/delete
 * wiring, same navigation and undo — but the hook owns all of it, so what is
 * left here is only layout.
 *
 * The point of the hook is that this file is layout you control. Move the
 * topbar, drop a view, wrap anything in your own chrome — nothing about the
 * wiring changes.
 */
import {
  useJanusScheduler,
  Timeline,
  MonthGrid,
  DayGrid,
  WeekGrid,
  YearGrid,
  Scheduler,
  Topbar,
} from "@janus-scheduler/react";

const RESOURCES = [
  { id: "r1", name: "Alice", type: "person", email: "alice@example.com" },
  { id: "r2", name: "Bob", type: "person", email: "bob@example.com" },
  { id: "r3", name: "Room A", type: "room", email: "" },
];

const EVENTS = [
  {
    id: "e1",
    title: "Standup",
    startTime: "2026-09-02T09:00:00.000Z",
    endTime: "2026-09-02T09:30:00.000Z",
    resourceIds: ["r1"],
    status: "confirmed" as const,
  },
];

export function MinimalScheduler() {
  const janus = useJanusScheduler({
    resources: RESOURCES,
    events: EVENTS,
    onChange: ({ type, id }) => console.log("changed:", type, id),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Topbar {...janus.topbarProps} />

      <div style={{ flex: 1, minHeight: 0 }}>
        {janus.view === "Timeline" && <Timeline {...janus.timelineProps} />}
        {janus.view === "Month" && <MonthGrid {...janus.monthGridProps} />}
        {janus.view === "Day" && <DayGrid {...janus.dayGridProps} />}
        {janus.view === "Week" && <WeekGrid {...janus.weekGridProps} />}
        {janus.view === "Year" && <YearGrid {...janus.yearGridProps} />}
      </div>

      {janus.editor.isOpen && <Scheduler {...janus.editor.props} />}
    </div>
  );
}
