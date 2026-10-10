import { useEffect, useState } from 'react';
import { FiArchive, FiRotateCcw } from 'react-icons/fi';
import { updateEntry, getEntries } from '@/functions/project/entries.js';
import { archiveEntry, unarchiveEntry } from '@/functions/project/archives.js';
import { getFields } from '@/functions/project/fields.js';
import { classifyEntryPayload } from '@/lib/entryPayload';
import { normalizeField, type FieldDefinition } from '@/lib/fieldSchema';

/*
  EntryQuickActions
  -----------------
  Pin / Calculate / Archive controls for the compact entry views (Checklist,
  Board and Table rows). The Cards view (EntryBox) keeps its own copies of
  these actions; this component deliberately reuses the same reserved entry
  keys — `_pinned` and `_calc_<field>` — so state stays consistent across
  every view. Writes go through updateEntry/archiveEntry, whose optimistic
  IndexedDB updates notify the page-level cache subscriptions, so hosts do
  not need to wire refresh callbacks (onUpdated is only a best-effort ping).
*/

function formatFieldKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Field schemas are fetched once per project and shared by every row. The
// short TTL keeps the schema picker fresh after a settings-panel change
// without letting a table with hundreds of rows spam the fields endpoint.
const FIELDS_TTL_MS = 30_000;
const fieldsCache = new Map<
  string,
  { at: number; promise: Promise<Record<string, FieldDefinition>> }
>();

function loadProjectFields(user_email: string, project_name: string) {
  const key = `${user_email}:${project_name}`;
  const hit = fieldsCache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < FIELDS_TTL_MS) return hit.promise;
  const promise = (async () => {
    const result = await getFields(user_email, project_name);
    const defs: Record<string, FieldDefinition> = {};
    if (result?.success === true && Array.isArray(result.data)) {
      for (const f of result.data) {
        const fieldDef = normalizeField(f);
        defs[fieldDef.field_name] = fieldDef;
      }
    }
    return defs;
  })().catch(() => {
    fieldsCache.delete(key);
    return {} as Record<string, FieldDefinition>;
  });
  fieldsCache.set(key, { at: now, promise });
  return promise;
}

export interface QuickActionEntry {
  id: string;
  user_email?: string;
  project_name?: string;
  entries?: unknown;
  archived?: boolean;
}

interface EntryQuickActionsProps {
  entry: QuickActionEntry;
  /** Fires after the archive state flips so hosts can drop/keep the row. */
  onArchiveToggled?: (entryId: string, archived: boolean) => void;
  /** Fires after any successful write so hosts can refresh derived state. */
  onUpdated?: () => void;
  /** Icon-only buttons for narrow hosts (table cells). */
  compact?: boolean;
  className?: string;
}

export function EntryQuickActions({
  entry,
  onArchiveToggled,
  onUpdated,
  compact = false,
  className,
}: EntryQuickActionsProps) {
  const { id, user_email, project_name, archived = false } = entry;
  const payloadState = classifyEntryPayload(entry.entries);
  const opaque = payloadState.kind === 'opaque';
  const parsedEntries = payloadState.kind === 'object' ? payloadState.value : {};

  const [fieldDefs, setFieldDefs] = useState<Record<string, FieldDefinition>>({});
  const [error, setError] = useState<string | null>(null);

  // Pin — reserved `_pinned` key in the entries payload (same as EntryBox).
  const [pinPending, setPinPending] = useState(false);
  const [pinOverride, setPinOverride] = useState<boolean | null>(null);
  const isPinned = pinOverride !== null ? pinOverride : parsedEntries._pinned === true;

  const [archiving, setArchiving] = useState(false);

  // Calculate — number fields only (same gate as the Cards view). Results are
  // stored on the entry under `_calc_<field>` and rendered as small chips.
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcFieldChoice, setCalcFieldChoice] = useState('');
  const [refEntries, setRefEntries] = useState<any[]>([]);
  const [calcOverride, setCalcOverride] = useState<
    Record<string, { type: string; value: number }>
  >({});

  useEffect(() => {
    if (!user_email || !project_name) return;
    let cancelled = false;
    loadProjectFields(user_email, project_name).then((defs) => {
      if (!cancelled) setFieldDefs(defs);
    });
    return () => {
      cancelled = true;
    };
  }, [user_email, project_name]);

  const numberFields = Object.values(fieldDefs)
    .filter((f) => f.data_type === 'number')
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((f) => f.field_name);

  const payloadCalc = Object.fromEntries(
    Object.entries(parsedEntries).filter(([key]) => key.startsWith('_calc_'))
  ) as Record<string, { type: string; value: number }>;
  const calcResults = { ...payloadCalc, ...calcOverride };

  const togglePin = async () => {
    if (!user_email || !project_name || pinPending || opaque) return;
    const next = !isPinned;
    setPinPending(true);
    setError(null);
    setPinOverride(next);
    const newEntries: Record<string, unknown> = { ...parsedEntries };
    if (next) newEntries._pinned = true;
    else delete newEntries._pinned;
    try {
      const result = await updateEntry(user_email, project_name, id, newEntries);
      if (result?.success !== true) throw new Error(result?.message || 'Failed to update pin');
      onUpdated?.();
    } catch (err) {
      setPinOverride(null);
      setError(err instanceof Error ? err.message : 'Failed to update pin');
    } finally {
      setPinPending(false);
    }
  };

  const toggleArchive = async () => {
    if (!user_email || !project_name || archiving) return;
    setArchiving(true);
    setError(null);
    try {
      const result = archived
        ? await unarchiveEntry(user_email, project_name, id)
        : await archiveEntry(user_email, project_name, id);
      if (result?.success === false)
        throw new Error(result.message || 'Failed to update archive state');
      onArchiveToggled?.(id, !archived);
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update archive state');
    } finally {
      setArchiving(false);
    }
  };

  const openCalc = async () => {
    if (!user_email || !project_name) return;
    setCalcOpen(true);
    setError(null);
    setCalcFieldChoice((prev) => (numberFields.includes(prev) ? prev : numberFields[0] || ''));
    try {
      const result = await getEntries(user_email, project_name);
      if (result?.data) setRefEntries(result.data);
    } catch {}
  };

  const runCalc = (type: 'sum' | 'average') => {
    const field = calcFieldChoice;
    if (!field || !user_email || !project_name) return;
    const values = refEntries
      .map((e: any) => {
        const data = typeof e.entries === 'object' && e.entries ? e.entries : {};
        const val = Number(data[field]);
        return isNaN(val) ? null : val;
      })
      .filter((v): v is number => v !== null);
    setCalcOpen(false);
    if (values.length === 0) return;
    const result =
      type === 'sum'
        ? values.reduce((a, b) => a + b, 0)
        : values.reduce((a, b) => a + b, 0) / values.length;
    const key = `_calc_${field}`;
    const newEntries = { ...parsedEntries, [key]: { type, value: result } };
    setCalcOverride((prev) => ({ ...prev, [key]: { type, value: result } }));
    updateEntry(user_email, project_name, id, newEntries).then((res) => {
      if (res?.success === true) onUpdated?.();
    });
  };

  const showPin = !opaque && !archived;
  const showCalc = !opaque && numberFields.length > 0;

  return (
    <div
      className={`entry-quick-actions${compact ? ' entry-quick-actions--compact' : ''}${
        className ? ` ${className}` : ''
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {showPin && (
        <button
          type="button"
          className={`entry-quick-actions__btn${isPinned ? ' is-pinned' : ''}`}
          onClick={togglePin}
          disabled={pinPending}
          aria-pressed={isPinned}
          title={isPinned ? 'Unpin — back to the normal order' : 'Pin to the top of the list'}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill={isPinned ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="17" x2="12" y2="22" />
            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z" />
          </svg>
          {!compact && (isPinned ? 'Pinned' : 'Pin')}
        </button>
      )}

      {showCalc && (
        <button
          type="button"
          className="entry-quick-actions__btn"
          onClick={openCalc}
          title="Calculate sum or average across the project"
        >
          <span aria-hidden="true">Σ</span>
          {!compact && 'Calculate'}
        </button>
      )}

      <button
        type="button"
        className="entry-quick-actions__btn"
        onClick={toggleArchive}
        disabled={archiving}
        title={archived ? 'Unarchive entry' : 'Archive entry'}
      >
        {archived ? <FiRotateCcw size={12} /> : <FiArchive size={12} />}
        {!compact && (archived ? 'Unarchive' : 'Archive')}
      </button>

      {Object.entries(calcResults).map(([key, result]) => (
        <span
          key={key}
          className="entry-quick-actions__calc-chip"
          title={`${result.type === 'sum' ? 'Sum' : 'Average'} of ${formatFieldKey(
            key.slice(6)
          )} across the project`}
        >
          {result.type === 'sum' ? 'Σ' : 'μ'} {formatFieldKey(key.slice(6))}:{' '}
          {Number(result.value).toFixed(2)}
        </span>
      ))}

      {error && (
        <span className="entry-quick-actions__error" role="alert">
          {error}
        </span>
      )}

      {calcOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setCalcOpen(false);
          }}
        >
          <div
            className="ref-picker-modal ref-picker-modal--small"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ref-picker-header">
              <h3>Calculate</h3>
              <button type="button" className="ref-picker-close" onClick={() => setCalcOpen(false)}>
                ×
              </button>
            </div>
            <div className="entry-quick-actions__calc-body">
              <label className="entry-quick-actions__calc-label" htmlFor={`calc-field-${id}`}>
                Number field
              </label>
              <select
                id={`calc-field-${id}`}
                className="entry-quick-actions__calc-select"
                value={calcFieldChoice}
                onChange={(e) => setCalcFieldChoice(e.target.value)}
              >
                {numberFields.map((field) => (
                  <option key={field} value={field}>
                    {formatFieldKey(field)}
                  </option>
                ))}
              </select>
              <div className="calc-picker-actions">
                <button
                  type="button"
                  className="calc-picker-btn"
                  disabled={!calcFieldChoice}
                  onClick={() => runCalc('sum')}
                >
                  Sum
                </button>
                <button
                  type="button"
                  className="calc-picker-btn"
                  disabled={!calcFieldChoice}
                  onClick={() => runCalc('average')}
                >
                  Average
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EntryQuickActions;
