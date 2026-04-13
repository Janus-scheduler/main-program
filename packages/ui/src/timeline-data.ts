import { TimelineResource } from "./timeline-types";

export const TODAY_STR = new Date().toISOString().split("T")[0];

export const SAMPLE: TimelineResource[] = [
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
];
