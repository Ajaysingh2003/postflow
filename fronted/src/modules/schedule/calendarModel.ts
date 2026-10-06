import type { Variant } from "@/modules/studio/types";

export type CalendarView = "day" | "week" | "month";
export type CalendarEntry = { post_title: string; time: string; variant: Variant };
export type CalendarPage = { items: CalendarEntry[]; next_cursor: number | null };

/** SQLite responses omit the offset; the backend stores all timestamps in UTC. */
export function utcDate(value: string) {
  return new Date(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`);
}

export function calendarTime(value: string) {
  return utcDate(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function calendarRange(date: Date, view: CalendarView) {
  let start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (view === "month") start.setDate(1);
  if (view !== "day") start = addDays(start, -((start.getDay() + 6) % 7));
  const days = view === "month" ? 42 : view === "week" ? 7 : 1;
  return { start, end: addDays(start, days), days: Array.from({ length: days }, (_, i) => addDays(start, i)) };
}

export function moveCalendar(date: Date, view: CalendarView, direction: number) {
  if (view !== "month") return addDays(date, direction * (view === "week" ? 7 : 1));
  return new Date(date.getFullYear(), date.getMonth() + direction, 1);
}

export function localDateTime(date: Date) {
  return `${dateKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** Reject invalid, past, and nonexistent local times during a DST clock change. */
export function scheduleInstant(value: string, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.getTime() > now && localDateTime(date) === value ? date.toISOString() : null;
}

/** Cards in the same time range share columns instead of covering one another. */
export function layoutDay(entries: CalendarEntry[]) {
  const sorted = entries.map((entry) => {
    const time = utcDate(entry.time);
    return { entry, minute: time.getHours() * 60 + time.getMinutes() };
  }).sort((a, b) => a.minute - b.minute || a.entry.variant.id.localeCompare(b.entry.variant.id));
  const result: { entry: CalendarEntry; minute: number; lane: number; lanes: number }[] = [];
  let group: typeof result = [];
  let ends: number[] = [];
  const flush = () => { for (const item of group) item.lanes = ends.length; result.push(...group); group = []; ends = []; };
  for (const item of sorted) {
    // Keep the complete card visible for posts near midnight.
    const minute = Math.min(item.minute, 1440 - 100);
    if (group.length && ends.every((end) => end <= minute)) flush();
    let lane = ends.findIndex((end) => end <= minute);
    if (lane < 0) lane = ends.length;
    ends[lane] = minute + 100;
    group.push({ ...item, minute, lane, lanes: 1 });
  }
  flush();
  return result;
}
