import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTemplate } from '@/lib/templateApi';
import './CreateTemplate.css';

interface TemplateFieldDraft {
  field_name: string;
  data_type: string;
  is_required: boolean;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text', icon: '📝' },
  { value: 'markdown', label: 'Markdown', icon: '📄' },
  { value: 'integer', label: 'Integer', icon: '🔢' },
  { value: 'float', label: 'Float', icon: '' },
  { value: 'number', label: 'Number', icon: '🔢' },
  { value: 'date', label: 'Date', icon: '📅' },
  { value: 'timestamp', label: 'Timestamp', icon: '⏰' },
  { value: 'boolean', label: 'Boolean', icon: '✓' },
  { value: 'tags', label: 'Tags', icon: '🏷️' },
  { value: 'checklist', label: 'Checklist', icon: '☑️' },
  { value: 'geolocation', label: 'Geolocation', icon: '📍' },
  { value: 'currency', label: 'Currency', icon: '💰' },
  { value: 'file', label: 'File', icon: '📎' },
  { value: 'image', label: 'Image', icon: '🖼️' },
  { value: 'entity_link', label: 'Entity Link', icon: '🔗' },
];

export function CreateTemplate() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<TemplateFieldDraft[]>([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addField = () => {
    if (!newFieldName.trim()) return;
    setFields([
      ...fields,
      {
        field_name: newFieldName.trim(),
        data_type: newFieldType,
        is_required: newFieldRequired,
      },
    ]);
    setNewFieldName('');
    setNewFieldType('text');
    setNewFieldRequired(false);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= fields.length) return;
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    setFields(newFields);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || fields.length === 0) return;

    setCreating(true);
    setError(null);
    try {
      await createTemplate({
        name: name.trim(),
        description: description.trim() || undefined,
        fields: fields.map((f, i) => ({
          ...f,
          is_unique: false,
          rules: {},
          has_default: false,
          options: [],
          display_order: i,
        })),
        scope: 'personal',
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="create-template-page">
      <div className="create-template-header">
        <button className="create-template-back" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1>Create Template</h1>
        <p className="create-template-subtitle">Build a reusable template for your projects</p>
      </div>

      <form className="create-template-form" onSubmit={handleSubmit}>
        <div className="create-template-card">
          <h2>Template Details</h2>
          <div className="form-group">
            <label htmlFor="template-name">
              Template Name <span className="required">*</span>
            </label>
            <input
              id="template-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Lab Report, Meeting Notes, Field Observation"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="template-description">Description</label>
            <textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of what this template is for..."
              rows={3}
            />
          </div>
        </div>

        <div className="create-template-card">
          <div className="card-header">
            <h2>
              Fields <span className="required">*</span>
            </h2>
            <span className="field-count">
              {fields.length} field{fields.length !== 1 ? 's' : ''}
            </span>
          </div>

          {fields.length > 0 && (
            <div className="fields-list">
              {fields.map((field, i) => {
                const fieldType = FIELD_TYPES.find((t) => t.value === field.data_type);
                return (
                  <div key={i} className="field-item">
                    <div className="field-item-header">
                      <span className="field-number">{i + 1}</span>
                      <span className="field-name">{field.field_name}</span>
                      {field.is_required && <span className="field-required-badge">Required</span>}
                    </div>
                    <div className="field-item-meta">
                      <span className="field-type-badge">
                        {fieldType?.icon} {fieldType?.label}
                      </span>
                    </div>
                    <div className="field-item-actions">
                      <button
                        type="button"
                        className="field-action-btn"
                        onClick={() => moveField(i, 'up')}
                        disabled={i === 0}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="field-action-btn"
                        onClick={() => moveField(i, 'down')}
                        disabled={i === fields.length - 1}
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="field-action-btn remove"
                        onClick={() => removeField(i)}
                        title="Remove field"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="add-field-section">
            <h3>Add New Field</h3>
            <div className="add-field-row">
              <input
                type="text"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                placeholder="Field name"
                className="field-name-input"
              />
              <select
                value={newFieldType}
                onChange={(e) => setNewFieldType(e.target.value)}
                className="field-type-select"
              >
                {FIELD_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </option>
                ))}
              </select>
              <label className="field-required-checkbox">
                <input
                  type="checkbox"
                  checked={newFieldRequired}
                  onChange={(e) => setNewFieldRequired(e.target.checked)}
                />
                <span>Required</span>
              </label>
              <button type="button" className="add-field-btn" onClick={addField}>
                + Add Field
              </button>
            </div>
          </div>
        </div>

        {error && <div className="create-template-error">{error}</div>}

        <div className="create-template-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(-1)}
            disabled={creating}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={creating || !name.trim() || fields.length === 0}
          >
            {creating ? 'Creating...' : 'Create Template'}
          </button>
        </div>
      </form>
    </div>
  );
}
