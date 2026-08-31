import * as fs from "node:fs/promises";
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

  async get(): Promise<CalendarState | null> {
    try {
      const raw = await fs.readFile(this.file, "utf-8");
      return JSON.parse(raw) as CalendarState;
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        console.error(
          "[FileCalendarStateStore] Failed to read calendar state:",
          err,
        );
      }
      return null;
    }
  }

  async set(state: CalendarState): Promise<void> {
    await fs.writeFile(this.file, JSON.stringify(state, null, 2), "utf-8");
  }

  async clear(): Promise<void> {
    try {
      await fs.unlink(this.file);
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }
}
