/* EntryBox.css — Notion-style card: bold title, top-right menu, colored tags, table-like fields */

.entry-box {
  position: relative;
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #e3e2e0);
  border-radius: 8px;
  padding: 1.1rem 1.3rem 1.3rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  font-family: var(--font-body, "Lora", serif);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.entry-box:hover {
  border-color: var(--text-muted, #9c9488);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.entry-box--editing {
  border-color: var(--text, #37352f);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
}

.entry-box--archived {
  opacity: 0.6;
}

/* ---------- Top-right three-dot menu ---------- */

.entry-box__menu-btn {
  position: absolute;
  top: 0.7rem;
  right: 0.7rem;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted, #9c9488);
  font-size: 1.1rem;
  line-height: 1;
  padding: 0.3rem 0.55rem;
  cursor: pointer;
  border-radius: 6px;
  z-index: 5;
}

.entry-box__menu-btn:hover {
  color: var(--text, #37352f);
  background: var(--bg, #f5f4f2);
}

.entry-box__menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #e3e2e0);
  border-radius: 8px;
  overflow: hidden;
  min-width: 140px;
  z-index: 10;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.14);
  text-align: left;
}

.entry-box__menu-item {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  padding: 0.55rem 0.9rem;
  font-family: var(--font-body, "Lora", serif);
  font-size: 0.85rem;
  color: var(--text, #37352f);
  cursor: pointer;
}

.entry-box__menu-item:hover {
  background: var(--bg, #f5f4f2);
}

.entry-box__menu-item--danger {
  color: #d1453b;
}

.entry-box__menu-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ---------- Header ---------- */

.entry-box__header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-right: 1.8rem; /* leave room for menu button */
}

.entry-box__project {
  font-family: var(--font-heading, "Playfair Display", serif);
  font-weight: 800;
  font-size: 1.15rem;
  color: var(--text, #1f1e1c);
  letter-spacing: 0.01em;
}

.entry-box__tags {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.entry-box__tag {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.22rem 0.6rem;
  border-radius: 5px;
  white-space: nowrap;
}

/* Status tags */
.status-up-next {
  background: #e9e9e7;
  color: #52504a;
}

.status-in-motion {
  background: #fdecc8;
  color: #a06b1a;
}

.status-done {
  background: #dbeddb;
  color: #2f7e3e;
}

/* Priority tags */
.priority-urgent-important {
  background: #fbe4e4;
  color: #c4453b;
}

.priority-urgent {
  background: #fdecd3;
  color: #b3711a;
}

.priority-low {
  background: #e3e9fb;
  color: #3a5fc4;
}

.priority-neutral {
  background: #ececea;
  color: #6b6a66;
}

/* ---------- Field/value table ---------- */

.entry-box__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.entry-box__row {
  border-top: 1px solid var(--border, #edece9);
}

.entry-box__row:first-child {
  border-top: none;
}

.entry-box__field-key {
  padding: 0.5rem 0.7rem 0.5rem 0;
  color: var(--text-muted, #8b8a85);
  font-weight: 600;
  width: 38%;
  vertical-align: top;
  white-space: nowrap;
}

.entry-box__field-value {
  padding: 0.5rem 0;
  color: var(--text, #37352f);
  word-break: break-word;
}

/* ---------- Editing state ---------- */

.entry-box__fields--editing {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.entry-box__field--editing {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.entry-box__field-input {
  font-family: var(--font-body, "Lora", serif);
  font-size: 0.85rem;
  background: var(--bg, #f7f6f3);
  border: 1px solid var(--border, #e3e2e0);
  border-radius: 6px;
  padding: 0.45rem 0.65rem;
  color: var(--text, #37352f);
}

.entry-box__field-input:focus {
  outline: none;
  border-color: var(--text, #37352f);
}

.entry-box__priority-select,
.entry-box__status-select {
  font-family: var(--font-body, "Lora", serif);
  font-size: 0.75rem;
  background: var(--bg, #f7f6f3);
  color: var(--text, #37352f);
  border: 1px solid var(--border, #e3e2e0);
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
}

/* ---------- Meta row ---------- */

.entry-box__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding-top: 0.7rem;
  border-top: 1px solid var(--border, #edece9);
}

.entry-box__meta-item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.entry-box__meta-label {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted, #9c9488);
}

.entry-box__meta-value {
  font-size: 0.8rem;
  color: var(--text, #37352f);
}

.entry-box__archived-tag {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-muted, #9c9488);
  border: 1px solid var(--border, #e3e2e0);
  border-radius: 999px;
  padding: 0.2rem 0.55rem;
  align-self: center;
}

/* ---------- Edit actions ---------- */

.entry-box__edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.3rem;
}

.entry-box__btn {
  font-family: var(--font-body, "Lora", serif);
  font-size: 0.82rem;
  font-weight: 600;
  border-radius: 6px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  border: 1px solid var(--border, #e3e2e0);
}

.entry-box__btn--cancel {
  background: transparent;
  color: var(--text-muted, #9c9488);
}

.entry-box__btn--save {
  background: var(--text, #37352f);
  color: var(--surface, #ffffff);
  border-color: var(--text, #37352f);
}

.entry-box__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ---------- Error ---------- */

.entry-box__error {
  font-size: 0.82rem;
  color: #d1453b;
}