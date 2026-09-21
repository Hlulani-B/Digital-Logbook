import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import type { FieldDefinition, FieldOption } from '@/lib/fieldSchema';
import { uploadAndFinalize } from '@/lib/attachmentApi';
import { checkThresholds } from '@/lib/fieldValidation';
import type { AlertLevel } from '@/lib/fieldVisibility';
import { useAuth } from '@/context/AuthContext';
import { getAllEntries } from '@/functions/project/entries';
import { getEntryTitle } from '@/lib/calendar';

/** Small colored dot indicating threshold status */
function ThresholdIndicator({ level, message }: { level: AlertLevel; message?: string }) {
  if (level === 'ok') return null;
  const color = level === 'alert' ? '#dc2626' : '#eab308';
  return (
    <span
      className={`field-threshold-indicator field-threshold-${level}`}
      title={message || `Threshold ${level}`}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: color,
        marginLeft: 6,
        cursor: message ? 'help' : 'default',
      }}
    />
  );
}

/** Apply threshold border color to a field editor wrapper */
function thresholdBorderClass(level: AlertLevel): string {
  if (level === 'alert') return 'field-editor--alert';
  if (level === 'warning') return 'field-editor--warning';
  return '';
}

interface FieldEditorProps {
  field: FieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
  projectId?: number;
  entryId?: string;
}

export function TextFieldEditor({ field, value, onChange, error, disabled }: FieldEditorProps) {
  return (
    <div className="field-editor">
      <label className="field-label">
        {field.field_name}
        {field.is_required && <span className="field-required">*</span>}
      </label>
      <input
        type="text"
        className={`field-input ${error ? 'field-error' : ''}`}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={field.has_default ? `Default: ${field.default_value}` : ''}
      />
      {error && <div className="field-error-message">{error}</div>}
    </div>
  );
}

export function MarkdownFieldEditor({ field, value, onChange, error, disabled }: FieldEditorProps) {
  return (
    <div className="field-editor">
      <label className="field-label">
        {field.field_name}
        {field.is_required && <span className="field-required">*</span>}
      </label>
      <textarea
        className={`field-textarea ${error ? 'field-error' : ''}`}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={6}
        placeholder={
          field.has_default ? `Default: ${field.default_value}` : 'Supports Markdown formatting...'
        }
      />
      {error && <div className="field-error-message">{error}</div>}
    </div>
  );
}

export function IntegerFieldEditor({ field, value, onChange, error, disabled }: FieldEditorProps) {
  const threshold = checkThresholds(field, value);
  return (
    <div className={`field-editor ${thresholdBorderClass(threshold.level)}`}>
      <label className="field-label">
        {field.field_name}
        {field.is_required && <span className="field-required">*</span>}
        <ThresholdIndicator level={threshold.level} message={threshold.message} />
      </label>
      <input
        type="number"
        step="1"
        className={`field-input ${error ? 'field-error' : ''}`}
        value={typeof value === 'number' ? value : ''}
        onChange={(e) => {
          const parsed = parseInt(e.target.value, 10);
          onChange(Number.isNaN(parsed) ? null : parsed);
        }}
        disabled={disabled}
        min={field.rules.min as number}
        max={field.rules.max as number}
      />
      {error && <div className="field-error-message">{error}</div>}
    </div>
  );
}

export function FloatFieldEditor({ field, value, onChange, error, disabled }: FieldEditorProps) {
  const threshold = checkThresholds(field, value);
  return (
    <div className={`field-editor ${thresholdBorderClass(threshold.level)}`}>
      <label className="field-label">
        {field.field_name}
        {field.is_required && <span className="field-required">*</span>}
        <ThresholdIndicator level={threshold.level} message={threshold.message} />
      </label>
      <input
        type="number"
        step="any"
        className={`field-input ${error ? 'field-error' : ''}`}
        value={typeof value === 'number' ? value : ''}
        onChange={(e) => {
          const parsed = parseFloat(e.target.value);
          onChange(Number.isNaN(parsed) ? null : parsed);
        }}
        disabled={disabled}
        min={field.rules.min as number}
        max={field.rules.max as number}
      />
      {error && <div className="field-error-message">{error}</div>}
    </div>
  );
}

export function DateFieldEditor({ field, value, onChange, error, disabled }: FieldEditorProps) {
  const threshold = checkThresholds(field, value);
  return (
    <div className={`field-editor ${thresholdBorderClass(threshold.level)}`}>
      <label className="field-label">
        {field.field_name}
        {field.is_required && <span className="field-required">*</span>}
        <ThresholdIndicator level={threshold.level} message={threshold.message} />
      </label>
      <input
        type="date"
        className={`field-input ${error ? 'field-error' : ''}`}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
      />
      {error && <div className="field-error-message">{error}</div>}
    </div>
  );
}

export function TimestampFieldEditor({
  field,
  value,
  onChange,
  error,
  disabled,
}: FieldEditorProps) {
  const datetimeValue = typeof value === 'string' ? value.slice(0, 16) : '';
  const threshold = checkThresholds(field, value);
  return (
    <div className={`field-editor ${thresholdBorderClass(threshold.level)}`}>
      <label className="field-label">
        {field.field_name}
        {field.is_required && <span className="field-required">*</span>}
        <ThresholdIndicator level={threshold.level} message={threshold.message} />
      </label>
      <input
        type="datetime-local"
        className={`field-input ${error ? 'field-error' : ''}`}
        value={datetimeValue}
        onChange={(e) => {
          if (!e.target.value) {
            onChange(null);
            return;
          }
          const date = new Date(e.target.value);
          onChange(date.toISOString());
        }}
        disabled={disabled}
      />
      {error && <div className="field-error-message">{error}</div>}
    </div>
  );
}

export function BooleanFieldEditor({ field, value, onChange, error, disabled }: FieldEditorProps) {
  return (
    <div className="field-editor">
      <label className="field-label">
        {field.field_name}
        {field.is_required && <span className="field-required">*</span>}
      </label>
      <div className="field-checkbox">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <span>{value === true ? 'Yes' : 'No'}</span>
      </div>
      {error && <div className="field-error-message">{error}</div>}
    </div>
  );
}

export function SelectFieldEditor({ field, value, onChange, error, disabled }: FieldEditorProps) {
  return (
    <div className="field-editor">
      <label className="field-label">
        {field.field_name}
        {field.is_required && <span className="field-required">*</span>}
      </label>
      <select
        className={`field-select ${error ? 'field-error' : ''}`}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
      >
        <option value="">Select an option...</option>
        {field.options.map((option) => (
          <option key={option.id} value={option.value ?? option.label}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <div className="field-error-message">{error}</div>}
    </div>
  );
}

/** Build a tree from flat options array using parent_id */
function buildOptionTree(options: FieldOption[]): {
  roots: FieldOption[];
  children: Map<string, FieldOption[]>;
} {
  const children = new Map<string, FieldOption[]>();
  const roots: FieldOption[] = [];
  const idSet = new Set(options.map((o) => o.id));

  for (const option of options) {
    if (option.parent_id && idSet.has(option.parent_id)) {
      const list = children.get(option.parent_id) || [];
      list.push(option);
      children.set(option.parent_id, list);
    } else {
      roots.push(option);
    }
  }
  return { roots, children };
}

export function MultiSelectFieldEditor({
  field,
  value,
  onChange,
  error,
  disabled,
}: FieldEditorProps) {
  const selectedIds = Array.isArray(value) ? value : [];
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { roots, children } = useMemo(() => buildOptionTree(field.options), [field.options]);
  const hasTree = children.size > 0;

  const toggleOption = (optionId: string) => {
    const newIds = selectedIds.includes(optionId)
      ? selectedIds.filter((id) => id !== optionId)
      : [...selectedIds, optionId];
    onChange(newIds);
  };

  /** Selecting a parent toggles all descendants */
  const toggleOptionWithChildren = (optionId: string) => {
    const isSelected = selectedIds.includes(optionId);
    const descendantIds: string[] = [];
    const collect = (parentId: string) => {
      for (const child of children.get(parentId) || []) {
        descendantIds.push(child.id);
        collect(child.id);
      }
    };
    collect(optionId);

    if (isSelected) {
      onChange(selectedIds.filter((id) => id !== optionId && !descendantIds.includes(id)));
    } else {
      const newSet = new Set([...selectedIds, optionId, ...descendantIds]);
      onChange([...newSet]);
    }
  };

  const toggleCollapse = (optionId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return next;
    });
  };

  const renderOption = (option: FieldOption, depth: number = 0) => {
    const kids = children.get(option.id) || [];
    const isCollapsed = collapsed.has(option.id);
    const hasKids = kids.length > 0;

    return (
      <React.Fragment key={option.id}>
        <label className="field-checkbox-item" style={{ paddingLeft: `${depth * 1.2}em` }}>
          {hasKids && (
            <button
              type="button"
              className="field-tree-toggle"
              onClick={(e) => {
                e.preventDefault();
                toggleCollapse(option.id);
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0 0.2em',
                fontSize: '0.7em',
              }}
            >
              {isCollapsed ? '\u25B6' : '\u25BC'}
            </button>
          )}
          <input
            type="checkbox"
            checked={selectedIds.includes(option.id)}
            onChange={() =>
              hasTree ? toggleOptionWithChildren(option.id) : toggleOption(option.id)
            }
            disabled={disabled}
          />
          <span>{option.label}</span>
        </label>
        {!isCollapsed && kids.map((child) => renderOption(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="field-editor">
      <label className="field-label">
        {field.field_name}
        {field.is_required && <span className="field-required">*</span>}
      </label>
      <div className="field-checkbox-group">{roots.map((option) => renderOption(option))}</div>
      {error && <div className="field-error-message">{error}</div>}
    </div>
  );
}

export function GeolocationFieldEditor({
  field,
  value,
  onChange,
  error,
  disabled,
}: FieldEditorProps) {
  const latitude =
    typeof value === 'object' && value !== null && 'latitude' in value
      ? (value as any).latitude
      : '';
  const longitude =
    typeof value === 'object' && value !== null && 'longitude' in value
      ? (value as any).longitude
      : '';
  const updateCoord = (key: 'latitude' | 'longitude', val: string) => {
    const num = parseFloat(val);
    if (Number.isNaN(num)) return;
    onChange({ ...(typeof value === 'object' ? value : {}), [key]: num });
  };
  return (
    <div className="field-editor">
      <label className="field-label">
        {field.field_name}
        {field.is_required && <span className="field-required">*</span>}
      </label>
      <div className="field-geolocation">
        <div className="field-geolocation-row">
          <label>Latitude</label>
          <input
            type="number"
            step="any"
            min="-90"
            max="90"
            value={latitude}
            onChange={(e) => updateCoord('latitude', e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="field-geolocation-row">
          <label>Longitude</label>
          <input
            type="number"
            step="any"
            min="-180"
            max="180"
            value={longitude}
            onChange={(e) => updateCoord('longitude', e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>
      {error && <div className="field-error-message">{error}</div>}
    </div>
  );
}

export function CurrencyFieldEditor({ field, value, onChange, error, disabled }: FieldEditorProps) {
  const amount =
    typeof value === 'object' && value !== null && 'amount' in value ? (value as any).amount : '';
  const currency =
    typeof value === 'object' && value !== null && 'currency' in value
      ? (value as any).currency
      : 'USD';
  const threshold = checkThresholds(field, value);
  return (
    <div className={`field-editor ${thresholdBorderClass(threshold.level)}`}>
      <label className="field-label">
        {field.field_name}
        {field.is_required && <span className="field-required">*</span>}
        <ThresholdIndicator level={threshold.level} message={threshold.message} />
      </label>
      <div className="field-currency">
        <input
          type="text"
          className="field-currency-amount"
          value={amount}
          onChange={(e) => onChange({ amount: e.target.value, currency })}
          disabled={disabled}
          placeholder="0.00"
        />
        <select
          className="field-currency-code"
          value={currency}
          onChange={(e) => onChange({ amount, currency: e.target.value })}
          disabled={disabled}
        >
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
          <option value="ZAR">ZAR</option>
          <option value="JPY">JPY</option>
          <option value="CAD">CAD</option>
          <option value="AUD">AUD</option>
        </select>
      </div>
      {error && <div className="field-error-message">{error}</div>}
    </div>
  );
}

export function FileFieldEditor({
  field,
  value,
  onChange,
  error,
  disabled,
  projectId,
  entryId,
}: FieldEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const attachmentId =
    typeof value === 'object' && value !== null && 'attachmentId' in value
      ? (value as any).attachmentId
      : null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // If no entryId yet (creating new entry), store File object for later upload
    if (!projectId || !entryId) {
      onChange(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setUploading(true);
    try {
      const result = await uploadAndFinalize(projectId, field.id || '', entryId, file);
      onChange({ attachmentId: result.attachmentId });
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Check if value is a File object (selected during creation, not yet uploaded)
  const selectedFile = value instanceof File ? value : null;

  return (
    <div className="field-editor">
      <label className="field-label">
        {field.field_name}
        {field.is_required && <span className="field-required">*</span>}
      </label>
      <div className="field-file">
        {attachmentId ? (
          <div className="field-file-preview">
            <span>File attached: {attachmentId.slice(0, 8)}...</span>
            <button type="button" onClick={() => onChange(null)} disabled={disabled}>
              Remove
            </button>
          </div>
        ) : selectedFile ? (
          <div className="field-file-preview">
            <span>
              {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </span>
            <button type="button" onClick={() => onChange(null)} disabled={disabled}>
              Remove
            </button>
          </div>
        ) : (
          <>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
              disabled={disabled}
            />
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? 'Uploading...' : entryId ? 'Upload File' : 'Select File'}
            </button>
          </>
        )}
      </div>
      {error && <div className="field-error-message">{error}</div>}
    </div>
  );
}

export function ImageFieldEditor({
  field,
  value,
  onChange,
  error,
  disabled,
  projectId,
  entryId,
}: FieldEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const attachmentId =
    typeof value === 'object' && value !== null && 'attachmentId' in value
      ? (value as any).attachmentId
      : null;
  const selectedFile = value instanceof File ? value : null;

  // Update preview when selectedFile changes
  React.useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFile]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    // If no entryId yet (creating new entry), store File object for later upload
    if (!projectId || !entryId) {
      onChange(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setUploading(true);
    try {
      const result = await uploadAndFinalize(projectId, field.id || '', entryId, file);
      onChange({ attachmentId: result.attachmentId });
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="field-editor">
      <label className="field-label">
        {field.field_name}
        {field.is_required && <span className="field-required">*</span>}
      </label>
      <div className="field-image">
        {attachmentId ? (
          <div className="field-image-preview">
            <span>Image attached: {attachmentId.slice(0, 8)}...</span>
            <button type="button" onClick={() => onChange(null)} disabled={disabled}>
              Remove
            </button>
          </div>
        ) : previewUrl ? (
          <div className="field-image-preview">
            <img
              src={previewUrl}
              alt="Selected"
              style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain' }}
            />
            <button type="button" onClick={() => onChange(null)} disabled={disabled}>
              Remove
            </button>
          </div>
        ) : (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
              disabled={disabled}
            />
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? 'Uploading...' : entryId ? 'Upload Image' : 'Select Image'}
            </button>
          </>
        )}
      </div>
      {error && <div className="field-error-message">{error}</div>}
    </div>
  );
}

export function EntityLinkFieldEditor({
  field,
  value,
  onChange,
  error,
  disabled,
}: FieldEditorProps) {
  const { user } = useAuth();
  const links = Array.isArray(value) ? value : [];
  const [pickerOpen, setPickerOpen] = useState(false);
  const [availableEntries, setAvailableEntries] = useState<
    Array<{ id: string | number; title: string; project: string }>
  >([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pendingSelection, setPendingSelection] = useState<string[]>([]);

  const openPicker = useCallback(() => {
    setPendingSelection(links.map(String));
    setPickerSearch('');
    setPickerOpen(true);
  }, [links]);

  useEffect(() => {
    if (!pickerOpen || !user?.email) return;
    let cancelled = false;
    setPickerLoading(true);
    getAllEntries(user.email)
      .then((result) => {
        if (cancelled) return;
        setPickerLoading(false);
        if (result?.success && Array.isArray(result.data)) {
          setAvailableEntries(
            result.data
              .filter((e: any) => !e.archived && e.id != null)
              .map((e: any) => ({
                id: String(e.id),
                title: getEntryTitle(e as any) || `Entry ${e.id}`,
                project: e.project_name || '',
              }))
          );
        } else {
          setAvailableEntries([]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPickerLoading(false);
          setAvailableEntries([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pickerOpen, user?.email]);

  const toggleEntry = (entryId: string) => {
    setPendingSelection((prev) =>
      prev.includes(entryId) ? prev.filter((id) => id !== entryId) : [...prev, entryId]
    );
  };

  const confirmSelection = () => {
    onChange(pendingSelection);
    setPickerOpen(false);
  };

  const filteredEntries = useMemo(() => {
    if (!pickerSearch.trim()) return availableEntries;
    const q = pickerSearch.toLowerCase();
    return availableEntries.filter(
      (e) => e.title.toLowerCase().includes(q) || e.project.toLowerCase().includes(q)
    );
  }, [availableEntries, pickerSearch]);

  return (
    <div className="field-editor">
      <label className="field-label">
        {field.field_name}
        {field.is_required && <span className="field-required">*</span>}
      </label>
      <div className="field-entity-link">
        <div className="field-entity-link-list">
          {links.map((link: string, index: number) => (
            <div key={index} className="field-entity-link-item">
              <span>Entry: {String(link).slice(0, 8)}...</span>
              <button
                type="button"
                onClick={() => onChange(links.filter((_: string, i: number) => i !== index))}
                disabled={disabled}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={openPicker} disabled={disabled}>
          Link Entry
        </button>
      </div>
      {error && <div className="field-error-message">{error}</div>}

      {pickerOpen && (
        <div
          className="modal-overlay"
          onClick={() => setPickerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 480,
              maxHeight: '80vh',
              overflowY: 'auto',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              background: 'var(--surface, #fff)',
              borderRadius: 8,
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Link Entries</h3>
            <input
              type="text"
              placeholder="Search entries..."
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              className="field-input"
              style={{ width: '100%' }}
            />
            {pickerLoading ? (
              <p style={{ color: 'var(--text-muted, #666)', textAlign: 'center' }}>
                Loading entries...
              </p>
            ) : filteredEntries.length === 0 ? (
              <p style={{ color: 'var(--text-muted, #666)', textAlign: 'center' }}>
                No entries found.
              </p>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  maxHeight: 300,
                  overflowY: 'auto',
                }}
              >
                {filteredEntries.map((entry) => {
                  const isSelected = pendingSelection.includes(String(entry.id));
                  return (
                    <label
                      key={entry.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem',
                        borderRadius: 4,
                        cursor: 'pointer',
                        background: isSelected ? 'var(--accent-bg, #e8f4f8)' : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleEntry(String(entry.id))}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {entry.title}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #666)' }}>
                          {entry.project}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                justifyContent: 'flex-end',
                marginTop: '0.5rem',
              }}
            >
              <button type="button" className="btn-secondary" onClick={() => setPickerOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={confirmSelection}
                style={{
                  background: 'var(--accent, #2563eb)',
                  color: '#fff',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Link {pendingSelection.length} {pendingSelection.length === 1 ? 'entry' : 'entries'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function FieldEditor(props: FieldEditorProps) {
  const { field } = props;
  switch (field.data_type) {
    case 'text':
      return <TextFieldEditor {...props} />;
    case 'markdown':
      return <MarkdownFieldEditor {...props} />;
    case 'integer':
      return <IntegerFieldEditor {...props} />;
    case 'float':
    case 'number':
      return <FloatFieldEditor {...props} />;
    case 'date':
      return <DateFieldEditor {...props} />;
    case 'timestamp':
      return <TimestampFieldEditor {...props} />;
    case 'boolean':
      return <BooleanFieldEditor {...props} />;
    case 'select':
      return <SelectFieldEditor {...props} />;
    case 'multiselect':
      return <MultiSelectFieldEditor {...props} />;
    case 'geolocation':
      return <GeolocationFieldEditor {...props} />;
    case 'currency':
      return <CurrencyFieldEditor {...props} />;
    case 'file':
      return <FileFieldEditor {...props} />;
    case 'image':
      return <ImageFieldEditor {...props} />;
    case 'entity_link':
      return <EntityLinkFieldEditor {...props} />;
    default:
      return <div>Unsupported field type: {field.data_type}</div>;
  }
}
