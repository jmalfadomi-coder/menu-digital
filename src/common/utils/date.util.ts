/**
 * Returns true if a schedule window covers the given moment.
 * Used in both the public API (server-side) and can be
 * imported by client code that performs local schedule checks.
 */
export interface ScheduleWindow {
  dayOfWeek?: number | null;   // 0=Sun … 6=Sat; null = every day
  startTime?: string | null;   // 'HH:MM' 24h
  endTime?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  isActive: boolean;
}

export function isScheduleActive(
  schedules: ScheduleWindow[],
  now: Date = new Date(),
): boolean {
  if (!schedules || schedules.length === 0) return true;

  const currentDay = now.getDay();
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  const currentTime = `${hh}:${mm}`;

  return schedules.some((s) => {
    if (!s.isActive) return false;
    if (s.startDate && now < new Date(s.startDate)) return false;
    if (s.endDate && now > new Date(s.endDate)) return false;
    if (s.dayOfWeek != null && s.dayOfWeek !== currentDay) return false;
    if (s.startTime && currentTime < s.startTime) return false;
    if (s.endTime && currentTime > s.endTime) return false;
    return true;
  });
}

/** Format a Date to 'YYYY-MM-DD' in UTC */
export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Build an array of Date objects for each day in [start, end] inclusive */
export function dateRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(start);
  cur.setUTCHours(0, 0, 0, 0);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}
