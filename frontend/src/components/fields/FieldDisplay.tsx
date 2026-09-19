import React from 'react';
import { SafeMarkdown } from './SafeMarkdown';
import type { FieldDefinition } from '@/lib/fieldSchema';

interface FieldDisplayProps {
  field: FieldDefinition;
  value: unknown;
}

export function FieldDisplay({ field, value }: FieldDisplayProps) {
  if (value === null || value === undefined || value === '') {
    return <div className="field-display field-display-empty">—</div>;
  }
  switch (field.data_type) {
    case 'text':
      return <div className="field-display">{String(value)}</div>;
    case 'markdown':
      return <SafeMarkdown value={String(value)} />;
    case 'integer':
    case 'float':
    case 'number':
      return <div className="field-display field-display-number">{String(value)}</div>;
    case 'date':
      return <div className="field-display field-display-date">{String(value)}</div>;
    case 'timestamp':
      return (
        <div className="field-display field-display-timestamp">
          {new Date(String(value)).toLocaleString()}
        </div>
      );
    case 'boolean':
      return <div className="field-display field-display-boolean">{value ? '✓ Yes' : '✗ No'}</div>;
    case 'select': {
      const option = field.options.find((o) => (o.value ?? o.label) === value);
      return (
        <div className="field-display field-display-select">{option?.label ?? String(value)}</div>
      );
    }
    case 'multiselect': {
      const ids = Array.isArray(value) ? value : [];
      const labels = ids.map((id) => field.options.find((o) => o.id === id)?.label ?? id);
      return (
        <div className="field-display field-display-multiselect">
          {labels.map((label, i) => (
            <span key={i} className="field-display-tag">
              {label}
            </span>
          ))}
        </div>
      );
    }
    case 'geolocation': {
      if (typeof value !== 'object' || value === null)
        return <div className="field-display">—</div>;
      const { latitude, longitude } = value as any;
      return (
        <div className="field-display field-display-geolocation">
          {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </div>
      );
    }
    case 'currency': {
      if (typeof value !== 'object' || value === null)
        return <div className="field-display">—</div>;
      const { amount, currency } = value as any;
      return (
        <div className="field-display field-display-currency">
          {currency} {amount}
        </div>
      );
    }
    case 'file':
    case 'image': {
      if (typeof value !== 'object' || value === null)
        return <div className="field-display">—</div>;
      const { attachmentId } = value as any;
      return (
        <div className="field-display field-display-attachment">
          <span>📎 {attachmentId.slice(0, 8)}...</span>
        </div>
      );
    }
    case 'entity_link': {
      const links = Array.isArray(value) ? value : [];
      if (links.length === 0) return <div className="field-display">—</div>;
      return (
        <div className="field-display field-display-entity-links">
          {links.map((link: string, i: number) => (
            <span key={i} className="field-display-tag">
              🔗 {link.slice(0, 8)}...
            </span>
          ))}
        </div>
      );
    }
    default:
      return <div className="field-display">Unsupported: {field.data_type}</div>;
  }
}
