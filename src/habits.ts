// A day is a local date in the form 'YYYY-MM-DD'. The keys sort in date order.
export type Day = string;

// A goal of a number of done days in each week or in each month. A week
// starts on Monday.
export type Period = 'week' | 'month';

export interface Goal {
  count: number;
  period: Period;
}

// The largest goal count for each period.
export const MAX_COUNT: Record<Period, number> = { week: 7, month: 31 };

export interface Habit {
  id: string;
  name: string;
  color: string;
  // The day on which the user added the habit.
  created: Day;
  // The first day of the habit. Only days from this day on count.
  start: Day;
  // Missing when the goal is every day.
  goal?: Goal;
}

export interface Data {
  habits: Habit[];
  // The days on which a habit is done, by the id of the habit.
  done: Record<string, Day[]>;
}

const STORAGE_KEY = 'habits.v1';

// The name of the app in a backup file.
export const BACKUP_APP = 'habit-tracker';

// The storage keys of all data of the app. The theme is not data.
export const isDataKey = (key: string) => key === STORAGE_KEY;

// Colors that the user can select for a habit.
export const COLORS = [
  '#43a047',
  '#1e88e5',
  '#8e24aa',
  '#d81b60',
  '#f4511e',
  '#fb8c00',
  '#00897b',
  '#6d4c41',
];

const EMPTY: Data = { habits: [], done: {} };

// Give each habit a start day. A habit without one starts on the day of
// creation, or on an earlier day that is marked as done.
function withStart(data: Data): Data {
  const habits = data.habits.map((h) => {
    if (h.start) return h;
    const first = data.done[h.id]?.reduce((a, b) => (b < a ? b : a), h.created);
    return { ...h, start: first ?? h.created };
  });
  return { ...data, habits };
}

export function loadData(): Data {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? withStart({ ...EMPTY, ...(JSON.parse(raw) as Partial<Data>) }) : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function saveData(data: Data): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage is full or blocked; the data stays in memory only.
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toDay(date: Date): Day {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDay(day: Day): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(): Day {
  return toDay(new Date());
}

export function addDays(day: Day, n: number): Day {
  const date = fromDay(day);
  date.setDate(date.getDate() + n);
  return toDay(date);
}

// A month as the year and the month index from 0 to 11.
export interface Month {
  year: number;
  month: number;
}

export function monthOf(day: Day): Month {
  const date = fromDay(day);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function addMonths({ year, month }: Month, n: number): Month {
  const date = new Date(year, month + n, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

// All days of a month, first day first.
export function monthDays({ year, month }: Month): Day[] {
  const count = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => toDay(new Date(year, month, i + 1)));
}

// Return the first color that no habit uses, or cycle through COLORS when all
// colors are in use.
export function nextColor(habits: Habit[]): string {
  const used = new Set(habits.map((h) => h.color));
  return COLORS.find((c) => !used.has(c)) ?? COLORS[habits.length % COLORS.length];
}

export function isDone(data: Data, id: string, day: Day): boolean {
  return data.done[id]?.includes(day) ?? false;
}

// The number of days from `a` to `b`, both included.
function length(a: Day, b: Day): number {
  return Math.round((fromDay(b).getTime() - fromDay(a).getTime()) / 86_400_000) + 1;
}

// The first and the last day of the week or the month that contains `day`.
export function periodOf(day: Day, period: Period): [Day, Day] {
  if (period === 'month') {
    const days = monthDays(monthOf(day));
    return [days[0], days.at(-1)!];
  }
  const first = addDays(day, -((fromDay(day).getDay() + 6) % 7));
  return [first, addDays(first, 6)];
}

// The number of days from `from` to `to` (both included) on which the habit
// is done.
export function countDone(data: Data, habit: Habit, from: Day, to: Day): number {
  return (data.done[habit.id] ?? []).filter((d) => from <= d && d <= to).length;
}

// The percentage of the goal that the habit reaches from `from` to `to` (both
// included). Only days from the start of the habit to today count. The result
// is null when no day counts.
//
// Without a goal, the score is the percentage of the days on which the habit
// is done. Today counts only when the habit is done, because the day is not
// over yet.
//
// With a goal, each week or month counts with its goal count. A period that is
// only partly in the range or after the start counts with the same part of its
// goal count. A period that is not over yet counts only with the done days, up
// to its goal count.
export function score(data: Data, habit: Habit, from: Day, to: Day): number | null {
  if (habit.goal) return goalScore(data, habit, habit.goal, from, to);
  const now = today();
  const start = habit.start;
  const first = from < start ? start : from;
  const last = to < now ? to : addDays(now, -1);
  const done = new Set(data.done[habit.id]);
  let total = 0;
  let count = 0;
  for (let day = first; day <= last; day = addDays(day, 1)) {
    total++;
    if (done.has(day)) count++;
  }
  if (first <= now && now <= to && done.has(now)) {
    total++;
    count++;
  }
  return total === 0 ? null : Math.round((100 * count) / total);
}

function goalScore(data: Data, habit: Habit, goal: Goal, from: Day, to: Day): number | null {
  const now = today();
  const first = from < habit.start ? habit.start : from;
  let target = 0;
  let reached = 0;
  for (let day = first; day <= to && day <= now;) {
    const [start, end] = periodOf(day, goal.period);
    const last = end < to ? end : to;
    const part = (goal.count * length(day, last)) / length(start, end);
    const done = Math.min(countDone(data, habit, day, last), part);
    reached += done;
    target += last < now ? part : done;
    day = addDays(last, 1);
  }
  return target === 0 ? null : Math.round((100 * reached) / target);
}

// The score from the start of the habit to today.
export function totalScore(data: Data, habit: Habit): number | null {
  return score(data, habit, habit.start, today());
}

// The fields of a habit that the user edits.
export type HabitFields = Pick<Habit, 'name' | 'color' | 'start' | 'goal'>;

export function addHabit(data: Data, fields: HabitFields): Data {
  const habit: Habit = { id: crypto.randomUUID(), created: today(), ...fields };
  return { ...data, habits: [...data.habits, habit] };
}

export function updateHabit(data: Data, id: string, fields: HabitFields): Data {
  return { ...data, habits: data.habits.map((h) => (h.id === id ? { ...h, ...fields } : h)) };
}

// Move the habit at index `from` to index `to`.
export function moveHabit(data: Data, from: number, to: number): Data {
  const habits = [...data.habits];
  const [habit] = habits.splice(from, 1);
  habits.splice(to, 0, habit);
  return { ...data, habits };
}

export function removeHabit(data: Data, id: string): Data {
  const { [id]: _, ...done } = data.done;
  return { habits: data.habits.filter((h) => h.id !== id), done };
}

export function toggleDone(data: Data, id: string, day: Day): Data {
  const days = data.done[id] ?? [];
  const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort();
  return { ...data, done: { ...data.done, [id]: next } };
}
