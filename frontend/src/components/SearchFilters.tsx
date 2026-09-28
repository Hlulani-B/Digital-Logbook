import { useState, type ReactNode } from 'react';
import type { FieldDefinition } from '@/lib/fieldSchema';
import { isNumericField } from '@/lib/fieldSchema';
import {
  activeFilterCount,
  activeProjectFilterCount,
  defaultFilterState,
  defaultProjectFilters,
  type FieldFilters,
  type FieldFilterState,
  type NumericFilterMode,
  type ProjectFilters,
} from '@/lib/entryFilters';

interface EntrySearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Extra control rendered inside the bar, at its end (e.g. the filter icon). */
  trailing?: ReactNode;
}

/** The regular (non-AI) search bar used across the dashboard and project views. */
export function EntrySearchBar({ value, onChange, placeholder, trailing }: EntrySearchBarProps) {
  return (
    <div className="feed-search-bar">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="feed-search-input"
      />
      {trailing}
    </div>
  );
}

interface FilterIconButtonProps {
  open: boolean;
  count: number;
  onToggle: () => void;
}

/** Small funnel button at the end of the search bar — toggles the filter panel. */
function FilterIconButton({ open, count, onToggle }: FilterIconButtonProps) {
  return (
    <button
      type="button"
      className={`search-filter-btn ${open ? 'is-open' : ''} ${count > 0 ? 'has-filters' : ''}`}
      onClick={onToggle}
      aria-expanded={open}
      aria-label={count > 0 ? `Filters (${count} active)` : 'Filters'}
      title={count > 0 ? `${count} filter${count === 1 ? '' : 's'} active` : 'Filters'}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </svg>
      {count > 0 && <span className="search-filter-btn__count">{count}</span>}
    </button>
  );
}

interface SearchFilterBlockProps {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder?: string;
  /** The project's fields. The filter button only renders when fields are supplied. */
  fields?: FieldDefinition[];
  filters?: FieldFilters;
  onFiltersChange?: (filters: FieldFilters) => void;
}

/**
 * Search bar with a Filters button underneath. Clicking the button expands a
 * panel listing the project's fields: numeric fields get above/below/between
 * range options, text fields get a contains input.
 */
export function SearchFilterBlock({
  query,
  onQueryChange,
  placeholder,
  fields,
  filters,
  onFiltersChange,
}: SearchFilterBlockProps) {
  const [open, setOpen] = useState(false);
  const activeFilters = filters ?? {};
  const count = activeFilterCount(activeFilters);
  const showFilters = Array.isArray(fields) && fields.length > 0 && !!onFiltersChange;

  const updateField = (field: FieldDefinition, patch: Partial<FieldFilterState>) => {
    if (!onFiltersChange) return;
    const current = activeFilters[field.field_name] ?? defaultFilterState(field);
    onFiltersChange({ ...activeFilters, [field.field_name]: { ...current, ...patch } });
  };

  return (
    <div className="search-filter-block">
      <EntrySearchBar
        value={query}
        onChange={onQueryChange}
        placeholder={placeholder}
        trailing={
          showFilters ? (
            <FilterIconButton open={open} count={count} onToggle={() => setOpen((v) => !v)} />
          ) : undefined
        }
      />

      {showFilters && (
        <>
          {open && (
            <div className="filter-panel">
              <div className="filter-panel__head">
                <span className="filter-panel__title">Filter by field</span>
                {count > 0 && (
                  <button
                    type="button"
                    className="filter-panel__clear"
                    onClick={() => onFiltersChange({})}
                  >
                    Clear all
                  </button>
                )}
              </div>

              {fields.map((field) => {
                const state = activeFilters[field.field_name] ?? defaultFilterState(field);
                const numeric = isNumericField(field.data_type);
                return (
                  <div className="filter-row" key={field.field_name}>
                    <label className="filter-row__label" title={field.field_name}>
                      {field.field_name}
                    </label>
                    <div className="filter-row__controls">
                      {numeric ? (
                        <>
                          <select
                            className="filter-select"
                            value={state.mode}
                            onChange={(e) =>
                              updateField(field, { mode: e.target.value as NumericFilterMode })
                            }
                            aria-label={`${field.field_name} filter type`}
                          >
                            <option value="above">Above</option>
                            <option value="below">Below</option>
                            <option value="between">Between</option>
                          </select>
                          {state.mode === 'between' ? (
                            <>
                              <input
                                className="filter-input filter-input--num"
                                type="number"
                                placeholder="Min"
                                value={state.min}
                                onChange={(e) => updateField(field, { min: e.target.value })}
                                aria-label={`${field.field_name} minimum`}
                              />
                              <span className="filter-row__dash">–</span>
                              <input
                                className="filter-input filter-input--num"
                                type="number"
                                placeholder="Max"
                                value={state.max}
                                onChange={(e) => updateField(field, { max: e.target.value })}
                                aria-label={`${field.field_name} maximum`}
                              />
                            </>
                          ) : (
                            <input
                              className="filter-input filter-input--num"
                              type="number"
                              placeholder="Value"
                              value={state.value}
                              onChange={(e) => updateField(field, { value: e.target.value })}
                              aria-label={`${field.field_name} value`}
                            />
                          )}
                        </>
                      ) : (
                        <input
                          className="filter-input"
                          type="text"
                          placeholder={`Contains text in ${field.field_name}...`}
                          value={state.value}
                          onChange={(e) =>
                            updateField(field, { mode: 'contains', value: e.target.value })
                          }
                          aria-label={`${field.field_name} contains`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface ProjectFilterBlockProps {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder?: string;
  /** Every project offered in the project filter (derived from the loaded entries). */
  projectNames: string[];
  filters: ProjectFilters;
  onFiltersChange: (filters: ProjectFilters) => void;
}

/**
 * Search bar for the all-entries feed. Entries there are mixed across projects,
 * so instead of per-project field filters the panel narrows the feed by
 * project-level criteria: the project's name, its entry count and its field count.
 */
export function ProjectFilterBlock({
  query,
  onQueryChange,
  placeholder,
  projectNames,
  filters,
  onFiltersChange,
}: ProjectFilterBlockProps) {
  const [open, setOpen] = useState(false);
  const count = activeProjectFilterCount(filters);

  const patchCount = (key: 'entryCount' | 'fieldCount', patch: Partial<FieldFilterState>) => {
    onFiltersChange({ ...filters, [key]: { ...filters[key], ...patch } });
  };

  return (
    <div className="search-filter-block">
      <EntrySearchBar
        value={query}
        onChange={onQueryChange}
        placeholder={placeholder}
        trailing={
          <FilterIconButton open={open} count={count} onToggle={() => setOpen((v) => !v)} />
        }
      />

      {open && (
        <div className="filter-panel">
          <div className="filter-panel__head">
            <span className="filter-panel__title">Filter entries</span>
            {count > 0 && (
              <button
                type="button"
                className="filter-panel__clear"
                onClick={() => onFiltersChange(defaultProjectFilters())}
              >
                Clear all
              </button>
            )}
          </div>
          <p className="filter-panel__note">
            Entry count and field count apply to each entry's project.
          </p>

          <div className="filter-row">
            <label className="filter-row__label" htmlFor="project-filter-name">
              Project name
            </label>
            <div className="filter-row__controls">
              <select
                id="project-filter-name"
                className="filter-select"
                value={filters.projectName}
                onChange={(e) => onFiltersChange({ ...filters, projectName: e.target.value })}
                aria-label="Project name filter"
              >
                <option value="">All projects</option>
                {projectNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <CountFilterRow
            id="entry-count"
            label="Entry count"
            hint="Number of entries in the entry's project"
            state={filters.entryCount}
            onChange={(patch) => patchCount('entryCount', patch)}
          />
          <CountFilterRow
            id="field-count"
            label="Field count"
            hint="Number of fields defined on the entry's project"
            state={filters.fieldCount}
            onChange={(patch) => patchCount('fieldCount', patch)}
          />
        </div>
      )}
    </div>
  );
}

interface CountFilterRowProps {
  id: string;
  label: string;
  hint: string;
  state: FieldFilterState;
  onChange: (patch: Partial<FieldFilterState>) => void;
}

/** One numeric criterion (above / below / between) in the entries filter panel. */
function CountFilterRow({ id, label, hint, state, onChange }: CountFilterRowProps) {
  return (
    <div className="filter-row" title={hint}>
      <label className="filter-row__label" htmlFor={`${id}-mode`}>
        {label}
      </label>
      <div className="filter-row__controls">
        <select
          id={`${id}-mode`}
          className="filter-select"
          value={state.mode}
          onChange={(e) => onChange({ mode: e.target.value as NumericFilterMode })}
          aria-label={`${label} filter type`}
        >
          <option value="above">Above</option>
          <option value="below">Below</option>
          <option value="between">Between</option>
        </select>
        {state.mode === 'between' ? (
          <>
            <input
              className="filter-input filter-input--num"
              type="number"
              placeholder="Min"
              value={state.min}
              onChange={(e) => onChange({ min: e.target.value })}
              aria-label={`${label} minimum`}
            />
            <span className="filter-row__dash">–</span>
            <input
              className="filter-input filter-input--num"
              type="number"
              placeholder="Max"
              value={state.max}
              onChange={(e) => onChange({ max: e.target.value })}
              aria-label={`${label} maximum`}
            />
          </>
        ) : (
          <input
            className="filter-input filter-input--num"
            type="number"
            placeholder="Value"
            value={state.value}
            onChange={(e) => onChange({ value: e.target.value })}
            aria-label={`${label} value`}
          />
        )}
      </div>
    </div>
  );
}
