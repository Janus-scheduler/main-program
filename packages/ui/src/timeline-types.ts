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
