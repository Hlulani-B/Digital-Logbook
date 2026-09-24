import { useState } from 'react';
import type { FieldDefinition } from '@/lib/fieldSchema';
import { isNumericField } from '@/lib/fieldSchema';
import {
  activeFilterCount,
  defaultFilterState,
  type FieldFilters,
  type FieldFilterState,
  type NumericFilterMode,
} from '@/lib/entryFilters';

interface EntrySearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** The regular (non-AI) search bar used across the dashboard and project views. */
export function EntrySearchBar({ value, onChange, placeholder }: EntrySearchBarProps) {
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
    </div>
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
      <EntrySearchBar value={query} onChange={onQueryChange} placeholder={placeholder} />

      {showFilters && (
        <>
          <button
            type="button"
            className={`filter-toggle ${open ? 'is-open' : ''} ${count > 0 ? 'has-filters' : ''}`}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Filters{count > 0 ? ` (${count})` : ''}
            <svg
              className="filter-toggle__chevron"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

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
