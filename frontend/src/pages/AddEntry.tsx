import React, { useState, useEffect } from "react";
import { addEntry } from "../functions/project/entries.js";
import { getFields } from "../functions/project/fields.js";

const PRIORITY_LABELS: Record<string, string> = {
  "3": "No priority",
  "0": "Urgent and important",
  "1": "Urgent but not important",
  "2": "Not urgent, not important",
};

interface FieldDef {
  field_name: string;
  data_type: string;
  is_required: boolean;
}

interface AddEntryProps {
  user_email: string;
  project_name: string;
  onAdded?: (result: unknown) => void;
  onCancel?: () => void;
}

function parseFieldValue(value: string, dataType: string): unknown {
  if (dataType === "number" || dataType === "integer" || dataType === "float") {
    const num = Number(value);
    return isNaN(num) ? value : num;
  }
  if (dataType === "boolean") {
    return value === "true";
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function inputTypeForDataType(dataType: string): string {
  switch (dataType) {
    case "number":
    case "integer":
    case "float":
      return "number";
    case "date":
      return "date";
    case "boolean":
      return "text";
    default:
      return "text";
  }
}

export function AddEntry({ user_email, project_name, onAdded, onCancel }: AddEntryProps) {
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [dueDate, setDueDate] = useState("");
  const [priorityValue, setPriorityValue] = useState("3");
  const [saving, setSaving] = useState(false);
  const [loadingFields, setLoadingFields] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load predefined fields for this project
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingFields(true);
      try {
        const result = await getFields(user_email, project_name);
        if (!cancelled) {
          const defs: FieldDef[] = (result?.data || []).map((f: any) => ({
            field_name: f.field_name,
            data_type: f.data_type || "text",
            is_required: !!f.is_required,
          }));
          setFields(defs);
          // Initialize empty values for each field
          const initial: Record<string, string> = {};
          for (const f of defs) {
            initial[f.field_name] = "";
          }
          setFieldValues(initial);
        }
      } catch (err) {
        if (!cancelled) setError("Failed to load fields");
      } finally {
        if (!cancelled) setLoadingFields(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user_email, project_name]);

  const handleValueChange = (fieldName: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user_email || !project_name || saving) return;

    // Validate required fields
    for (const f of fields) {
      if (f.is_required && !fieldValues[f.field_name]?.trim()) {
        setError(`"${f.field_name}" is required`);
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      const entryObject: Record<string, unknown> = {};
      for (const f of fields) {
        const val = fieldValues[f.field_name];
        if (val !== undefined && val.trim() !== "") {
          entryObject[f.field_name] = parseFieldValue(val, f.data_type);
        }
      }
      // Include priority in entry object
      entryObject["priority"] = priorityValue;

      const result = await addEntry(
        user_email,
        project_name,
        entryObject,
        dueDate ? new Date(dueDate).toISOString() : null
      );

      if (result?.error) throw new Error(result.error);
      if (result?.success === false) throw new Error(result.message || "Failed to add entry");

      onAdded?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add entry");
    } finally {
      setSaving(false);
    }
  };

  if (loadingFields) {
    return (
      <div className="add-entry">
        <div className="add-entry__header">
          <h2 className="add-entry__title">New Entry</h2>
          <span className="add-entry__project">{project_name}</span>
        </div>
        <div className="add-entry__loading">Loading fields...</div>
      </div>
    );
  }

  return (
    <form className="add-entry" onSubmit={handleSubmit}>
      <div className="add-entry__header">
        <h2 className="add-entry__title">New Entry</h2>
        <span className="add-entry__project">{project_name}</span>
      </div>

      {error && <div className="add-entry__error">{error}</div>}

      {fields.length > 0 && (
        <div className="add-entry__fields">
          <span className="add-entry__section-label">Fields</span>
          {fields.map((field) => (
            <div className="add-entry__field-row" key={field.field_name}>
              <label className="add-entry__field-label" htmlFor={`field-${field.field_name}`}>
                {field.field_name}
                {field.is_required && <span className="add-entry__required">*</span>}
              </label>
              <input
                id={`field-${field.field_name}`}
                type={inputTypeForDataType(field.data_type)}
                className="add-entry__field-input"
                placeholder={`Enter ${field.field_name}`}
                value={fieldValues[field.field_name] || ""}
                onChange={(e) => handleValueChange(field.field_name, e.target.value)}
                disabled={saving}
                required={field.is_required}
              />
            </div>
          ))}
        </div>
      )}

      {fields.length === 0 && (
        <p className="add-entry__no-fields">No fields defined for this project yet.</p>
      )}

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
          disabled={saving || loadingFields}
        >
          {saving ? "Adding..." : "Add Entry"}
        </button>
      </div>
    </form>
  );
}

export default AddEntry;
