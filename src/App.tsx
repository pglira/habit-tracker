import {
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { type Backup, exportBackup, readBackup, restoreBackup } from './backup';
import {
  BACKUP_APP,
  COLORS,
  type Data,
  type Day,
  type Habit,
  type HabitFields,
  type Month,
  addDays,
  addHabit,
  addMonths,
  fromDay,
  isDataKey,
  isDone,
  loadData,
  monthDays,
  monthOf,
  moveHabit,
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
  // True while the day view shows drag handles to change the order of the habits.
  const [reorder, setReorder] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
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
          {view === 'day' && data.habits.length > 1 && (
            <button
              className={reorder ? 'icon active' : 'icon'}
              onClick={() => {
                setSwiped(null);
                setReorder((r) => !r);
              }}
              aria-pressed={reorder}
              aria-label="Change order"
              title="Change order"
            >
              <Icon name={reorder ? 'check' : 'sort'} />
            </button>
          )}
          <button
            className="icon"
            onClick={nextTheme}
            aria-label={THEME_LABELS[theme]}
            title={THEME_LABELS[theme]}
          >
            <Icon name={THEME_ICONS[theme]} />
          </button>
          <button className="icon" onClick={() => setBackupOpen(true)} aria-label="Backup" title="Backup">
            <Icon name="backup" />
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
          <button
            key={v}
            role="tab"
            aria-selected={v === view}
            onClick={() => {
              setView(v);
              setReorder(false);
            }}
          >
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
          {reorder ? (
            <ReorderList habits={data.habits} onMove={(from, to) => setData((x) => moveHabit(x, from, to))} />
          ) : (
            <ul>
              {data.habits.map((habit) => {
                const done = isDone(data, habit.id, day);
                const started = day >= habit.start;
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
                      disabled={!started}
                      onClick={() => toggle(habit.id, day)}
                    >
                      <span className="text">
                        <span className="name">{habit.name}</span>
                        <span className="meta">
                          {started
                            ? `Score ${percent(totalScore(data, habit))}`
                            : `Starts ${dayLabel(habit.start)}`}
                        </span>
                      </span>
                      <span className="box">{done && <Icon name="check" size={28} />}</span>
                    </button>
                  </SwipeRow>
                );
              })}
            </ul>
          )}
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

      {backupOpen && <BackupSheet onClose={() => setBackupOpen(false)} />}

      {sheet && (
        <HabitForm
          key={sheet.id ?? 'new'}
          name={sheetHabit?.name ?? ''}
          color={sheetHabit?.color ?? nextColor(data.habits)}
          start={sheetHabit?.start ?? today()}
          onCancel={close}
          onSave={(fields) => {
            setData((x) => (sheetHabit ? updateHabit(x, sheetHabit.id, fields) : addHabit(x, fields)));
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
// or not done on that day. Days before the start of the habit and days after
// today are disabled.
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
              disabled={d > now || d < habit.start}
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

interface ReorderListProps {
  habits: Habit[];
  onMove: (from: number, to: number) => void;
}

// The habits with a drag handle on each row. Drag a handle up or down to move
// the habit. The arrow keys move the habit of the focused handle.
function ReorderList({ habits, onMove }: ReorderListProps) {
  // The dragged habit, the pointer position at which its row is at rest, and
  // the current pointer position.
  const [drag, setDrag] = useState<{ id: string; origin: number; y: number } | null>(null);
  const rows = useRef<HTMLUListElement>(null);

  // The distance between the tops of two rows in pixels.
  const step = () => {
    const ul = rows.current;
    const li = ul?.firstElementChild as HTMLElement | null;
    if (!ul || !li) return 1;
    return li.offsetHeight + parseFloat(getComputedStyle(ul).rowGap || '0');
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!drag) return;
    const index = habits.findIndex((h) => h.id === drag.id);
    const s = step();
    let origin = drag.origin;
    let to = index;
    while (e.clientY - origin > s / 2 && to < habits.length - 1) {
      origin += s;
      to++;
    }
    while (e.clientY - origin < -s / 2 && to > 0) {
      origin -= s;
      to--;
    }
    if (to !== index) onMove(index, to);
    setDrag({ id: drag.id, origin, y: e.clientY });
  };

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : -1;
    if (to < 0 || to >= habits.length) return;
    e.preventDefault();
    onMove(index, to);
  };

  return (
    <ul ref={rows} className="reorder">
      {habits.map((habit, index) => (
        <li
          key={habit.id}
          className={`habit${drag?.id === habit.id ? ' dragged' : ''}`}
          style={
            {
              '--color': habit.color,
              transform: drag?.id === habit.id ? `translateY(${drag.y - drag.origin}px)` : undefined,
            } as CSSProperties
          }
        >
          <span className="info">
            <span className="text">
              <span className="name">{habit.name}</span>
            </span>
            <button
              className="handle"
              aria-label={`Move ${habit.name}`}
              title="Drag to move"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setDrag({ id: habit.id, origin: e.clientY, y: e.clientY });
              }}
              onPointerMove={onPointerMove}
              onPointerUp={() => setDrag(null)}
              onPointerCancel={() => setDrag(null)}
              onKeyDown={(e) => onKeyDown(e, index)}
            >
              <Icon name="grip" size={24} />
            </button>
          </span>
        </li>
      ))}
    </ul>
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

// Export all data of the app to a backup file, or replace all data with the
// data of a backup file. The import needs a second tap to replace the data.
function BackupSheet({ onClose }: { onClose: () => void }) {
  const [backup, setBackup] = useState<Backup | null>(null);
  const [error, setError] = useState('');

  const importFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear the input so that the same file can be selected again.
    e.target.value = '';
    if (!file) return;
    try {
      setBackup(readBackup(await file.text(), BACKUP_APP));
      setError('');
    } catch (err) {
      setBackup(null);
      setError(err instanceof Error ? err.message : 'The file is not a valid backup.');
    }
  };

  return (
    <SheetFrame title="Backup" onCancel={onClose} onSubmit={onClose}>
      <p className="hint">Export all data to a file. Import the file on the new phone.</p>
      <div className="file-buttons">
        <button
          type="button"
          className="file-button"
          onClick={() => exportBackup(BACKUP_APP, isDataKey)}
          title="Export all data to a file"
        >
          <Icon name="download" size={18} />
          Export
        </button>
        <label className="file-button" title="Import all data from a file">
          <Icon name="upload" size={18} />
          Import
          <input type="file" accept="application/json,.json" hidden onChange={importFile} />
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      {backup && (
        <button
          type="button"
          className="replace"
          onClick={() => {
            restoreBackup(backup, isDataKey);
            location.reload();
          }}
        >
          Tap to replace all data
          <small>Backup of {new Date(backup.exported).toLocaleString()}</small>
        </button>
      )}
      <div className="buttons">
        <button type="submit" className="primary">
          Close
        </button>
      </div>
    </SheetFrame>
  );
}

interface HabitFormProps {
  name: string;
  color: string;
  start: Day;
  onSave: (fields: HabitFields) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

function HabitForm(props: HabitFormProps) {
  const [name, setName] = useState(props.name);
  const [color, setColor] = useState(props.color);
  const [start, setStart] = useState(props.start);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <SheetFrame
      title={props.onDelete ? 'Edit habit' : 'New habit'}
      onCancel={props.onCancel}
      onSubmit={() => props.onSave({ name: name.trim() || 'Habit', color, start: start || props.start })}
    >
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Habit" />
      </label>
      <label>
        Start day
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
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
