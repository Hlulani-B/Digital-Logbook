import { useState, useEffect } from 'react';
import { listTemplates, createTemplate, type Template } from '@/lib/templateApi';
import './TemplatePicker.css';

interface TemplatePickerProps {
  onSelect: (template: Template) => void;
  onCancel: () => void;
}

export function TemplatePicker({ onSelect, onCancel }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Template['scope']>('built_in');
  const [retryCount, setRetryCount] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createFormError, setCreateFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTemplates([]);
    setError(null);
    setLoading(true);

    async function loadTemplates() {
      try {
        const results = await listTemplates(activeTab);
        if (!cancelled) setTemplates(results);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load templates');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTemplates();
    return () => {
      cancelled = true;
    };
  }, [activeTab, retryCount]);

  const filteredTemplates = templates.filter((tpl) => tpl.scope === activeTab);

  return (
    <div className="template-picker">
      <div className="template-picker-header">
        <h3>Choose a Template</h3>
        <button
          type="button"
          className="template-picker-close"
          aria-label="Close template picker"
          onClick={onCancel}
        >
          ×
        </button>
      </div>
      <div className="template-picker-tabs">
        <button
          type="button"
          className={`template-picker-tab ${activeTab === 'built_in' ? 'active' : ''}`}
          aria-pressed={activeTab === 'built_in'}
          onClick={() => setActiveTab('built_in')}
        >
          Built-in
        </button>
        <button
          type="button"
          className={`template-picker-tab ${activeTab === 'personal' ? 'active' : ''}`}
          aria-pressed={activeTab === 'personal'}
          onClick={() => setActiveTab('personal')}
        >
          Personal
        </button>
        <button
          type="button"
          className={`template-picker-tab ${activeTab === 'global' ? 'active' : ''}`}
          aria-pressed={activeTab === 'global'}
          onClick={() => setActiveTab('global')}
        >
          Global
        </button>
      </div>
      {loading && (
        <div className="template-picker-loading" role="status">
          Loading templates...
        </div>
      )}
      {error && (
        <div className="template-picker-error" role="alert">
          {error}
          <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
            Retry
          </button>
        </div>
      )}
      {!loading && !error && (
        <div className="template-picker-list">
          {activeTab === 'personal' && !showCreateForm && (
            <button
              type="button"
              className="template-picker-create-btn"
              onClick={() => setShowCreateForm(true)}
            >
              + Create Template
            </button>
          )}
          {showCreateForm && activeTab === 'personal' ? (
            <CreateTemplateForm
              onCancel={() => {
                setShowCreateForm(false);
                setCreateFormError(null);
              }}
              onSuccess={(template) => {
                setShowCreateForm(false);
                setRetryCount((c) => c + 1);
                onSelect(template);
              }}
              creating={creating}
              setCreating={setCreating}
              error={createFormError}
              setError={setCreateFormError}
            />
          ) : filteredTemplates.length === 0 ? (
            <div className="template-picker-empty">
              {activeTab === 'personal'
                ? 'No personal templates yet. Create one above.'
                : activeTab === 'global'
                  ? 'No global templates available.'
                  : 'No built-in templates available.'}
            </div>
          ) : (
            filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="template-picker-item"
                role="button"
                tabIndex={0}
                aria-label={template.name}
                onClick={() => onSelect(template)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(template);
                  }
                }}
              >
                <div className="template-picker-item-header">
                  <h4>{template.name}</h4>
                  {template.is_fork && <span className="template-picker-fork">Forked</span>}
                </div>
                {template.description && (
                  <p className="template-picker-description">{template.description}</p>
                )}
                <div className="template-picker-meta">
                  <span>{template.fields.length} fields</span>
                  {template.version > 1 && <span>v{template.version}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface CreateTemplateFormProps {
  onCancel: () => void;
  onSuccess: (template: Template) => void;
  creating: boolean;
  setCreating: (v: boolean) => void;
  error: string | null;
  setError: (v: string | null) => void;
}

interface TemplateFieldDraft {
  field_name: string;
  data_type: string;
  is_required: boolean;
}

function CreateTemplateForm({
  onCancel,
  onSuccess,
  creating,
  setCreating,
  error,
  setError,
}: CreateTemplateFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<TemplateFieldDraft[]>([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || fields.length === 0) return;

    setCreating(true);
    try {
      const template = await createTemplate({
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
      onSuccess(template);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setCreating(false);
    }
  };

  return (
    <form className="template-picker-create-form" onSubmit={handleSubmit}>
      <div className="template-picker-form-field">
        <label>Template Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Lab Report"
          required
        />
      </div>
      <div className="template-picker-form-field">
        <label>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          rows={2}
        />
      </div>
      <div className="template-picker-form-fields">
        <label>Fields *</label>
        {fields.length > 0 && (
          <div className="template-picker-fields-list">
            {fields.map((field, i) => (
              <div key={i} className="template-picker-field-item">
                <span>{field.field_name}</span>
                <span className="template-picker-field-type">{field.data_type}</span>
                {field.is_required && <span className="template-picker-field-required">*</span>}
                <button type="button" onClick={() => removeField(i)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="template-picker-add-field">
          <input
            type="text"
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            placeholder="Field name"
          />
          <select value={newFieldType} onChange={(e) => setNewFieldType(e.target.value)}>
            <option value="text">Text</option>
            <option value="markdown">Markdown</option>
            <option value="integer">Integer</option>
            <option value="float">Float</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="timestamp">Timestamp</option>
            <option value="boolean">Boolean</option>
            <option value="tags">Tags</option>
            <option value="checklist">Checklist</option>
            <option value="geolocation">Geolocation</option>
            <option value="currency">Currency</option>
            <option value="file">File</option>
            <option value="image">Image</option>
            <option value="entity_link">Entity Link</option>
          </select>
          <label className="template-picker-field-checkbox">
            <input
              type="checkbox"
              checked={newFieldRequired}
              onChange={(e) => setNewFieldRequired(e.target.checked)}
            />
            Required
          </label>
          <button type="button" onClick={addField}>
            Add
          </button>
        </div>
      </div>
      {error && <div className="template-picker-form-error">{error}</div>}
      <div className="template-picker-form-actions">
        <button type="button" onClick={onCancel} disabled={creating}>
          Cancel
        </button>
        <button type="submit" disabled={creating || !name.trim() || fields.length === 0}>
          {creating ? 'Creating...' : 'Create Template'}
        </button>
      </div>
    </form>
  );
}
