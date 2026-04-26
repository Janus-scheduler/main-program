import { MonthEvent } from "./month-grid-types";

// Helper: build a date string relative to today's month
function ds(day: number): string {
  const d = new Date();
  d.setDate(day);
  return d.toISOString().split("T")[0];
}

// Today's actual date number, used to pin "today" events
const todayDay = new Date().getDate();

export const MONTH_SAMPLE: MonthEvent[] = [
  // Today's events
  {
    id: "m1",
    title: "Design Sync",
    color: "orange",
    date: ds(todayDay),
    startTime: "08:00",
    endTime: "10:00",
  },

  // Earlier this month
  {
    id: "m2",
    title: "Strategy Workshop",
    color: "yellow",
    date: ds(Math.max(1, todayDay - 11)),
    startTime: "10:00",
    endTime: "13:00",
  },
  {
    id: "m3",
    title: "Client Call",
    color: "blue",
    date: ds(Math.max(1, todayDay - 9)),
    startTime: "11:00",
    endTime: "12:30",
  },

  // Later this month
  {
    id: "m4",
    title: "Patient X Scan",
    color: "purple",
    date: ds(Math.min(28, todayDay + 4)),
    startTime: "13:00",
    endTime: "15:00",
  },
  {
    id: "m5",
    title: "Scanner Use",
    color: "green",
    date: ds(Math.min(28, todayDay + 4)),
    startTime: "15:30",
    endTime: "17:00",
  },
];
