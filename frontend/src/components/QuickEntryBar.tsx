import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import { FiMic } from 'react-icons/fi';
import { addNaturalLanguageEntry } from '../functions/project/natural_language.js';
import { getAiMessagesEnabled } from '@/functions/aiMessages';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface QuickEntryBarProps {
  onEntryCreated?: (info?: {
    entryId?: string;
    projectName?: string;
    title?: string;
    /**
     * Every entry the backend actually created for this submission.
     * Single-entry responses put one item in here; multi-project
     * responses put one item per created entry. Consumers should
     * iterate this list to populate "Recently created" — it's the
     * only shape that reliably covers every branch.
     */
    created?: Array<{ entryId?: string; projectName: string; title: string }>;
  }) => void;
  onVoiceOpen?: () => void;
  placeholder?: string;
}

function titleFromFields(
  fields: Record<string, unknown> | undefined,
  fallback: string
): string {
  if (fields) {
    const first = Object.values(fields).find(
      (v) => typeof v === 'string' && (v as string).length > 0
    );
    if (typeof first === 'string') return first.slice(0, 100);
  }
  return fallback;
}

export function QuickEntryBar({ onEntryCreated, onVoiceOpen, placeholder }: QuickEntryBarProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState('');
  const [messageType, setMessageType] = useState(''); // "success" | "error"
  const inputRef = useRef(null);
  const isOnline = useNetworkStatus();

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 30000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 30000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || loading) return;

    setLoading(true);
    setMessage('');
    setToast('');

    const result = await addNaturalLanguageEntry(text.trim());
    setLoading(false);

    if (result.success) {
      setText('');
      const data = result.data as Record<string, unknown>;
      const isProjectOnly = data?.project_only === true;
      const isMulti = data?.multi === true;

      // Extract project name / entry id / title for the single-match case,
      // and always build a `created[]` list covering every branch so the
      // "Recently created" section can track multi-match responses too.
      let projectName: string | undefined;
      let entryId: string | undefined;
      let title: string | undefined;
      const created: Array<{ entryId?: string; projectName: string; title: string }> = [];
      const rawSummary = (data?.summary as string) || text.trim();
      const fallbackTitle = rawSummary.slice(0, 100) || 'New entry';

      if (isMulti) {
        const results = (data?.results ?? {}) as {
          old?: Array<{ project_name?: string; fields?: Record<string, unknown>; entry_id?: string }>;
          new?: Array<{ project_name?: string; fields?: Record<string, unknown>; entry_id?: string }>;
        };
        for (const item of [...(results.old ?? []), ...(results.new ?? [])]) {
          if (!item.project_name) continue;
          created.push({
            entryId: item.entry_id,
            projectName: item.project_name,
            title: titleFromFields(item.fields, fallbackTitle),
          });
        }
        const total = created.length;
        setMessage(
          `Added ${total} ${total === 1 ? 'entry' : 'entries'} — see "Recently created" below.`
        );
      } else if (isProjectOnly) {
        projectName = (data?.project as string) || undefined;
        setMessage(`Project "${projectName}" created!`);
        if (projectName) {
          created.push({ projectName, title: `Project: ${projectName}` });
        }
      } else {
        projectName = (data?.project as string) || undefined;
        entryId = (data?.entry_id as string) || undefined;
        title = titleFromFields(
          data?.fields as Record<string, unknown> | undefined,
          fallbackTitle
        );
        setMessage('Entry created!');
        if (projectName && title) {
          created.push({ entryId, projectName, title });
        }
      }

      setMessageType('success');
      const comment = data?.comment || (data?.data as Record<string, unknown>)?.comment;
      if (comment && getAiMessagesEnabled()) {
        setToast(comment as string);
      }
      if (onEntryCreated) onEntryCreated({ entryId, projectName, title, created });
    } else {
      setMessage(result.message || 'Failed to create entry');
      setMessageType('error');
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="quick-entry-bar">
      <form className="quick-entry-form" onSubmit={handleSubmit}>
        <div className="quick-entry-input-wrap">
          <svg
            className="quick-entry-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="quick-entry-input"
            placeholder={
              isOnline
                ? placeholder || 'Write a task, e.g. "Fixed login bug for ProjectX, urgent, due tomorrow"...'
                : 'Offline — Quick add unavailable'
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading || !isOnline}
            title={
              !isOnline
                ? 'Quick add requires an internet connection'
                : 'Write what you worked on — the project, priority and due date will be picked up automatically. Example: "Fixed login bug for ProjectX, urgent, due tomorrow"'
            }
          />
          {/* Voice button */}
          {onVoiceOpen && (
            <button
              type="button"
              className="quick-entry-voice"
              onClick={onVoiceOpen}
              aria-label="Voice entry"
              title={!isOnline ? 'Voice input requires an internet connection' : 'Dictate your task using voice — speak naturally and the task will be created for you'}
              disabled={!isOnline}
              style={!isOnline ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
            >
              <FiMic size={16} />
            </button>
          )}
          <button
            type="submit"
            className="quick-entry-submit"
            disabled={loading || !text.trim() || !isOnline}
            title={
              !isOnline
                ? 'Quick add requires an internet connection'
                : loading
                  ? 'Creating your task...'
                  : 'Create the task — we will parse the text and organize it into the right project'
            }
          >
            {loading ? (
              <svg
                className="animate-spin"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
      </form>
      {message && <div className={`quick-entry-message ${messageType}`}>{message}</div>}
      {toast && (
        <div className="quick-entry-toast">
          <svg
            className="toast-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
