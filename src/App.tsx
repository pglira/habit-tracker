import { type CSSProperties, type ReactNode, useEffect, useState } from 'react';
import {
  COLORS,
  type Data,
  type Day,
  type Habit,
  type Month,
  addDays,
  addHabit,
  addMonths,
  fromDay,
  isDone,
  loadData,
  monthDays,
  monthOf,
  nextColor,
  removeHabit,
  saveData,
  score,
  toggleDone,
  today,
  totalScore,
  updateHabit,
} from './habits';
import { Icon, type IconName } from './icons';
import { SwipeRow } from './SwipeRow';
import { type Theme, useTheme } from './theme';

const THEME_ICONS: Record<Theme, IconName> = { auto: 'auto', light: 'sun', dark: 'moon' };
const THEME_LABELS: Record<Theme, string> = {
  auto: 'Theme: system',
  light: 'Theme: light',
  dark: 'Theme: dark',
};

type View = 'day' | 'month';

// The open sheet: a habit form, with id null for a new habit.
type Sheet = { id: string | null } | null;

const percent = (value: number | null) => (value === null ? '–' : `${value} %`);

export default function App() {
  const [data, setData] = useState<Data>(loadData);
  const [view, setView] = useState<View>('day');
  const [day, setDay] = useState<Day>(today);
  const [month, setMonth] = useState<Month>(() => monthOf(today()));
  const [sheet, setSheet] = useState<Sheet>(null);
  // The id of the habit whose row shows the swipe actions.
  const [swiped, setSwiped] = useState<string | null>(null);
  const [theme, nextTheme] = useTheme();

  useEffect(() => saveData(data), [data]);

  const close = () => setSheet(null);
  const toggle = (id: string, d: Day) => setData((x) => toggleDone(x, id, d));
  const sheetHabit = sheet ? data.habits.find((h) => h.id === sheet.id) : undefined;

  return (
    <main>
      <header>
        <h1>Habits</h1>
        <div className="header-buttons">
          <button
            className="icon"
            onClick={nextTheme}
            aria-label={THEME_LABELS[theme]}
            title={THEME_LABELS[theme]}
          >
            <Icon name={THEME_ICONS[theme]} />
          </button>
          <button
            className="add"
            onClick={() => setSheet({ id: null })}
            aria-label="Add habit"
            title="Add habit"
          >
            <Icon name="plus" size={24} />
          </button>
        </div>
      </header>

      <div className="tabs" role="tablist">
        {(['day', 'month'] as View[]).map((v) => (
          <button key={v} role="tab" aria-selected={v === view} onClick={() => setView(v)}>
            {v === 'day' ? 'Day' : 'Month'}
          </button>
        ))}
      </div>

      {data.habits.length === 0 && <p className="empty">No habits. Tap + to add a habit.</p>}

      {view === 'day' && data.habits.length > 0 && (
        <>
          <Pager
            label={dayLabel(day)}
            onPrev={() => setDay((d) => addDays(d, -1))}
            onNext={() => setDay((d) => addDays(d, 1))}
            nextDisabled={day >= today()}
            onLabel={() => setDay(today())}
          />
          <ul>
            {data.habits.map((habit) => {
              const done = isDone(data, habit.id, day);
              return (
                <SwipeRow
                  key={habit.id}
                  className={`habit${done ? ' done' : ''}`}
                  style={{ '--color': habit.color } as CSSProperties}
                  open={swiped === habit.id}
                  onOpen={() => setSwiped(habit.id)}
                  onClose={() => setSwiped(null)}
                  onEdit={() => {
                    setSwiped(null);
                    setSheet({ id: habit.id });
                  }}
                  onDelete={() => {
                    setSwiped(null);
                    setData((x) => removeHabit(x, habit.id));
                  }}
                >
                  <button
                    className="info"
                    role="checkbox"
                    aria-checked={done}
                    onClick={() => toggle(habit.id, day)}
                  >
                    <span className="text">
                      <span className="name">{habit.name}</span>
                      <span className="meta">Score {percent(totalScore(data, habit))}</span>
                    </span>
                    <span className="box">{done && <Icon name="check" size={28} />}</span>
                  </button>
                </SwipeRow>
              );
            })}
          </ul>
        </>
      )}

      {view === 'month' && data.habits.length > 0 && (
        <>
          <Pager
            label={monthLabel(month)}
            onPrev={() => setMonth((m) => addMonths(m, -1))}
            onNext={() => setMonth((m) => addMonths(m, 1))}
            nextDisabled={monthDays(month).at(-1)! >= today()}
            onLabel={() => setMonth(monthOf(today()))}
          />
          <ul>
            {data.habits.map((habit) => (
              <MonthCard
                key={habit.id}
                data={data}
                habit={habit}
                month={month}
                onToggle={(d) => toggle(habit.id, d)}
                onEdit={() => setSheet({ id: habit.id })}
              />
            ))}
          </ul>
        </>
      )}

      {sheet && (
        <HabitForm
          key={sheet.id ?? 'new'}
          name={sheetHabit?.name ?? ''}
          color={sheetHabit?.color ?? nextColor(data.habits)}
          onCancel={close}
          onSave={(name, color) => {
            setData((x) =>
              sheetHabit ? updateHabit(x, sheetHabit.id, name, color) : addHabit(x, name, color),
            );
            close();
          }}
          onDelete={
            sheetHabit
              ? () => {
                  setData((x) => removeHabit(x, sheetHabit.id));
                  close();
                }
              : undefined
          }
        />
      )}
    </main>
  );
}

function dayLabel(day: Day): string {
  const now = today();
  if (day === now) return 'Today';
  if (day === addDays(now, -1)) return 'Yesterday';
  return fromDay(day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function monthLabel({ year, month }: Month): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

interface PagerProps {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  nextDisabled: boolean;
  // Go back to the current day or month.
  onLabel: () => void;
}

function Pager({ label, onPrev, onNext, nextDisabled, onLabel }: PagerProps) {
  return (
    <div className="pager">
      <button className="icon" onClick={onPrev} aria-label="Previous" title="Previous">
        <Icon name="left" />
      </button>
      <button className="pager-label" onClick={onLabel}>
        {label}
      </button>
      <button className="icon" onClick={onNext} disabled={nextDisabled} aria-label="Next" title="Next">
        <Icon name="right" />
      </button>
    </div>
  );
}

// Weekday names for the columns of the month grid, Monday first.
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

interface MonthCardProps {
  data: Data;
  habit: Habit;
  month: Month;
  onToggle: (day: Day) => void;
  onEdit: () => void;
}

// The days of one month for one habit. A tap on a day marks the habit as done
// or not done on that day. Days after today are disabled.
function MonthCard({ data, habit, month, onToggle, onEdit }: MonthCardProps) {
  const days = monthDays(month);
  const now = today();
  // Empty cells before the first day, so that the first day is in the column
  // of its weekday.
  const offset = (fromDay(days[0]).getDay() + 6) % 7;

  return (
    <li className="month-card" style={{ '--color': habit.color } as CSSProperties}>
      <div className="month-head">
        <button className="month-name" onClick={onEdit} aria-label={`Edit ${habit.name}`}>
          {habit.name}
        </button>
        <span className="month-score">{percent(score(data, habit, days[0], days.at(-1)!))}</span>
      </div>
      <div className="grid">
        {WEEKDAYS.map((w) => (
          <span key={w} className="weekday">
            {w}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {days.map((d, i) => {
          const done = isDone(data, habit.id, d);
          return (
            <button
              key={d}
              className={`cell${done ? ' done' : ''}${d === now ? ' today' : ''}`}
              disabled={d > now}
              role="checkbox"
              aria-checked={done}
              aria-label={fromDay(d).toLocaleDateString()}
              onClick={() => onToggle(d)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </li>
  );
}

function SheetFrame(props: {
  title: string;
  onCancel: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <div className="backdrop" onClick={props.onCancel}>
      <form
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          props.onSubmit();
        }}
      >
        <h2>{props.title}</h2>
        {props.children}
      </form>
    </div>
  );
}

interface HabitFormProps {
  name: string;
  color: string;
  onSave: (name: string, color: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

function HabitForm(props: HabitFormProps) {
  const [name, setName] = useState(props.name);
  const [color, setColor] = useState(props.color);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <SheetFrame
      title={props.onDelete ? 'Edit habit' : 'New habit'}
      onCancel={props.onCancel}
      onSubmit={() => props.onSave(name.trim() || 'Habit', color)}
    >
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Habit" />
      </label>
      <div className="colors" role="radiogroup" aria-label="Color">
        {COLORS.map((c, i) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c === color}
            aria-label={`Color ${i + 1}`}
            className="swatch"
            style={{ background: c }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <div className="buttons">
        {props.onDelete && (
          <button
            type="button"
            className="delete"
            onClick={() => (confirmDelete ? props.onDelete?.() : setConfirmDelete(true))}
          >
            {confirmDelete ? 'Tap to delete' : 'Delete'}
          </button>
        )}
        <button type="button" onClick={props.onCancel}>
          Cancel
        </button>
        <button type="submit" className="primary">
          Save
        </button>
      </div>
    </SheetFrame>
  );
}
