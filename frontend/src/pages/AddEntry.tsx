import React, { useState } from "react";
import { addEntry } from "../functions/project/entries.js";

const PRIORITY_LABELS: Record<string, string> = {
  "3": "No priority",
  "0": "Urgent and important",
  "1": "Urgent but not important",
  "2": "Not urgent, not important",
};

interface FieldRow {
  key: string;
  value: string;
}

interface AddEntryProps {
  user_email: string;
  project_name: string;
  onAdded?: (result: unknown) => void;
  onCancel?: () => void;
}

function parseFieldValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function AddEntry({ user_email, project_name, onAdded, onCancel }: AddEntryProps) {
  const [fields, setFields] = useState<FieldRow[]>([{ key: "", value: "" }]);
  const [dueDate, setDueDate] = useState("");
  const [priorityValue, setPriorityValue] = useState("3");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFieldKeyChange = (index: number, key: string) => {
    setFields((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], key };
      return next;
    });
  };

  const handleFieldValueChange = (index: number, value: string) => {
    setFields((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], value };
      return next;
    });
  };

  const handleAddFieldRow = () => {
    setFields((prev) => [...prev, { key: "", value: "" }]);
  };

  const handleRemoveFieldRow = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user_email || !project_name || saving) return;

    const cleanedFields = fields.filter((f) => f.key.trim() !== "");
    if (cleanedFields.length === 0) {
      setError("Add at least one field for this entry");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const entryObject: Record<string, unknown> = {};
      for (const { key, value } of cleanedFields) {
        entryObject[key.trim()] = parseFieldValue(value);
      }

      const result = await addEntry(
        user_email,
        project_name,
        entryObject,
        dueDate ? new Date(dueDate).toISOString() : null
      );

      if (result?.error) throw new Error(result.error);
      if (result?.success === false) throw new Error(result.message || "Failed to add entry");

      onAdded?.(result);

      setFields([{ key: "", value: "" }]);
      setDueDate("");
      setPriorityValue("3");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="add-entry" onSubmit={handleSubmit}>
      <div className="add-entry__header">
        <h2 className="add-entry__title">New Entry</h2>
        <span className="add-entry__project">{project_name}</span>
      </div>

      {error && <div className="add-entry__error">{error}</div>}

      <div className="add-entry__fields">
        <span className="add-entry__section-label">Fields</span>
        {fields.map((field, index) => (
          <div className="add-entry__field-row" key={index}>
            <input
              type="text"
              className="add-entry__field-input add-entry__field-input--key"
              placeholder="Field name (e.g. notes, topic_studied)"
              value={field.key}
              onChange={(e) => handleFieldKeyChange(index, e.target.value)}
              disabled={saving}
            />
            <input
              type="text"
              className="add-entry__field-input add-entry__field-input--value"
              placeholder="Value"
              value={field.value}
              onChange={(e) => handleFieldValueChange(index, e.target.value)}
              disabled={saving}
            />
            {fields.length > 1 && (
              <button
                type="button"
                className="add-entry__remove-field"
                onClick={() => handleRemoveFieldRow(index)}
                disabled={saving}
                aria-label="Remove field"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className="add-entry__add-field"
          onClick={handleAddFieldRow}
          disabled={saving}
        >
          + Add field
        </button>
      </div>

      <div className="add-entry__row">
        <div className="add-entry__group">
          <label className="add-entry__label" htmlFor="due-date">
            Due Date
          </label>
          <input
            id="due-date"
            type="date"
            className="add-entry__input"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={saving}
          />
        </div>

        <div className="add-entry__group">
          <label className="add-entry__label" htmlFor="priority">
            Priority
          </label>
          <select
            id="priority"
            className="add-entry__input"
            value={priorityValue}
            onChange={(e) => setPriorityValue(e.target.value)}
            disabled={saving}
          >
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="add-entry__actions">
        {onCancel && (
          <button
            type="button"
            className="add-entry__btn add-entry__btn--cancel"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="add-entry__btn add-entry__btn--submit"
          disabled={saving}
        >
          {saving ? "Adding..." : "Add Entry"}
        </button>
      </div>
    </form>
  );
}

export default AddEntry;