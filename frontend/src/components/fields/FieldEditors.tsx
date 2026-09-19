import React, { useRef } from 'react';
import type { FieldDefinition } from '@/lib/fieldSchema';
import { uploadAndFinalize } from '@/lib/attachmentApi';

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
  return (
    <div className="field-editor">
      <label className="field-label">
        {field.field_name}
        {field.is_required && <span className="field-required">*</span>}
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
  return (
    <div className="field-editor">
      <label className="field-label">
        {field.field_name}
        {field.is_required && <span className="field-required">*</span>}
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
  return (
    <div className="field-editor">
      <label className="field-label">
        {field.field_name}
        {field.is_required && <span className="field-required">*</span>}
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
  return (
    <div className="field-editor">
      <label className="field-label">
        {field.field_name}
        {field.is_required && <span className="field-required">*</span>}
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

export function MultiSelectFieldEditor({
  field,
  value,
  onChange,
  error,
  disabled,
}: FieldEditorProps) {
  const selectedIds = Array.isArray(value) ? value : [];
  const toggleOption = (optionId: string) => {
    const newIds = selectedIds.includes(optionId)
      ? selectedIds.filter((id) => id !== optionId)
      : [...selectedIds, optionId];
    onChange(newIds);
  };
  return (
    <div className="field-editor">
      <label className="field-label">
        {field.field_name}
        {field.is_required && <span className="field-required">*</span>}
      </label>
      <div className="field-checkbox-group">
        {field.options.map((option) => (
          <label key={option.id} className="field-checkbox-item">
            <input
              type="checkbox"
              checked={selectedIds.includes(option.id)}
              onChange={() => toggleOption(option.id)}
              disabled={disabled}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
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
  return (
    <div className="field-editor">
      <label className="field-label">
        {field.field_name}
        {field.is_required && <span className="field-required">*</span>}
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
    if (!file || !projectId || !entryId) return;
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
              {uploading ? 'Uploading...' : 'Upload File'}
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
  const attachmentId =
    typeof value === 'object' && value !== null && 'attachmentId' in value
      ? (value as any).attachmentId
      : null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId || !entryId) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
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
              {uploading ? 'Uploading...' : 'Upload Image'}
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
  const links = Array.isArray(value) ? value : [];
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
              <span>Entry: {link.slice(0, 8)}...</span>
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
        <button type="button" disabled={disabled}>
          Link Entry
        </button>
      </div>
      {error && <div className="field-error-message">{error}</div>}
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
