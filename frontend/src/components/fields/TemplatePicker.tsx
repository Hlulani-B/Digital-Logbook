import { useState, useEffect } from 'react';
import { listTemplates, type Template } from '@/lib/templateApi';
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
          {filteredTemplates.length === 0 ? (
            <div className="template-picker-empty">
              {activeTab === 'personal'
                ? 'No personal templates yet. Create one from a project.'
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
