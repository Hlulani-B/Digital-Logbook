import ChecklistEntryCard from '../EntryTemplates/EntryChecklist';

type EntryStatus = 'up_next' | 'in_motion' | 'done_and_dusted';

interface BoardEntry {
  id: string;
  user_email: string;
  project_name: string;
  summary?: string | null;
  due_date?: string | null;
  status?: EntryStatus;
  entries?: Record<string, unknown> | string | null;
  started_at?: string | null;
  deleted?: boolean;
}

interface EntriesByDueDateBoardProps {
  entries: BoardEntry[];
  onUpdated?: () => void;
  onDelete?: (entryId: string) => void;
}

interface Column {
  key: string;
  label: string;
  entries: BoardEntry[];
}

const WEEKDAY_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getWeekdayName(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { weekday: 'long' });
}

function groupByWeekday(entries: BoardEntry[]): Column[] {
  const groups: Record<string, BoardEntry[]> = {};
  const noDueDate: BoardEntry[] = [];

  for (const entry of entries) {
    if (entry.deleted) continue;
    if (!entry.due_date) {
      noDueDate.push(entry);
      continue;
    }
    const weekday = getWeekdayName(entry.due_date.slice(0, 10));
    if (!groups[weekday]) groups[weekday] = [];
    groups[weekday].push(entry);
  }

  const sortedColumns: Column[] = WEEKDAY_ORDER
    .filter((day) => groups[day])
    .map((day) => ({
      key: day,
      label: day,
      entries: groups[day],
    }));

  if (noDueDate.length) {
    sortedColumns.push({ key: 'no-due-date', label: 'No due date', entries: noDueDate });
  }

  return sortedColumns;
}

export default function EntriesByDueDateBoard({ entries = [], onUpdated, onDelete }: EntriesByDueDateBoardProps) {
  const columns = groupByWeekday(entries);

  if (!entries.length) {
    return (
      <div className="checklist-empty">
        <p>No entries yet</p>
      </div>
    );
  }

  return (
    <div className="edb-board">
      {columns.map((column) => (
        <div className="edb-column" key={column.key}>
          <div className="edb-column-header">
            <span className="edb-column-label">{column.label}</span>
            <span className="edb-column-count">{column.entries.length}</span>
          </div>
          <div className="edb-column-body">
            {column.entries.map((entry) => (
              <ChecklistEntryCard
                key={entry.id}
                entry={entry}
                onUpdated={onUpdated}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
