import fs from "node:fs";
import path from "node:path";
import type { CalendarState } from "../../types/index.js";
import type { CalendarStateStore } from "./types.js";

/**
 * Default {@link CalendarStateStore} — a plain JSON file next to the server
 * process (`janus-calendar-state.json` in `process.cwd()` unless a path is
 * given). Not encrypted: it holds no secrets, only the calendar id, sync token,
 * and webhook channel ids.
 */
export class FileCalendarStateStore implements CalendarStateStore {
  private readonly file: string;

  constructor(filePath?: string) {
    this.file =
      filePath ?? path.join(process.cwd(), "janus-calendar-state.json");
  }

  get(): Promise<CalendarState | null> {
    try {
      if (!fs.existsSync(this.file)) return Promise.resolve(null);
      return Promise.resolve(
        JSON.parse(fs.readFileSync(this.file, "utf-8")) as CalendarState,
      );
    } catch {
      return Promise.resolve(null);
    }
  }

  set(state: CalendarState): Promise<void> {
    fs.writeFileSync(this.file, JSON.stringify(state, null, 2), "utf-8");
    return Promise.resolve();
  }

  clear(): Promise<void> {
    if (fs.existsSync(this.file)) fs.unlinkSync(this.file);
    return Promise.resolve();
  }
}
