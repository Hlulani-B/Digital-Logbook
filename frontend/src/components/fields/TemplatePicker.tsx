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
  const [activeTab, setActiveTab] = useState<'built_in' | 'personal' | 'global'>('built_in');

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      setLoading(true);
      const all = await listTemplates('all');
      setTemplates(all);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }

  const filteredTemplates = templates.filter((tpl) => tpl.scope === activeTab);

  return (
    <div className="template-picker">
      <div className="template-picker-header">
        <h3>Choose a Template</h3>
        <button type="button" className="template-picker-close" onClick={onCancel}>
          ×
        </button>
      </div>
      <div className="template-picker-tabs">
        <button
          type="button"
          className={`template-picker-tab ${activeTab === 'built_in' ? 'active' : ''}`}
          onClick={() => setActiveTab('built_in')}
        >
          Built-in
        </button>
        <button
          type="button"
          className={`template-picker-tab ${activeTab === 'personal' ? 'active' : ''}`}
          onClick={() => setActiveTab('personal')}
        >
          Personal
        </button>
        <button
          type="button"
          className={`template-picker-tab ${activeTab === 'global' ? 'active' : ''}`}
          onClick={() => setActiveTab('global')}
        >
          Global
        </button>
      </div>
      {loading && <div className="template-picker-loading">Loading templates...</div>}
      {error && <div className="template-picker-error">{error}</div>}
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
                onClick={() => onSelect(template)}
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
