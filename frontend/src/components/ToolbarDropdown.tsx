import { useState, useEffect, useRef } from 'react';

interface ToolbarDropdownOption<T extends string> {
  value: T;
  label: string;
}

interface ToolbarDropdownProps<T extends string> {
  value: T;
  options: Array<ToolbarDropdownOption<T>>;
  onChange: (value: T) => void;
  /** Which edge the menu hugs — 'right' keeps it inside the viewport. */
  menuAlign?: 'left' | 'right';
}

/**
 * Compact toolbar dropdown (View / Sort style). Shows the active option on
 * the trigger and closes on outside click or Escape.
 */
export function ToolbarDropdown<T extends string>({
  value,
  options,
  onChange,
  menuAlign = 'left',
}: ToolbarDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const currentLabel = options.find((option) => option.value === value)?.label ?? value;

  return (
    <div className="toolbar-dropdown" ref={rootRef}>
      <button
        type="button"
        className="toolbar-dropdown__btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="toolbar-dropdown__value">{currentLabel}</span>
        <svg
          className="toolbar-dropdown__chevron"
          aria-hidden="true"
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
        <div
          className={[
            'toolbar-dropdown__menu',
            menuAlign === 'right' && 'toolbar-dropdown__menu--right',
          ]
            .filter(Boolean)
            .join(' ')}
          role="listbox"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`toolbar-dropdown__option ${option.value === value ? 'is-active' : ''}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ToolbarDropdown;
