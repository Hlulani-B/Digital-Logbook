import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { FiMic } from "react-icons/fi";
import { addNaturalLanguageEntry } from "../functions/project/natural_language.js";

interface QuickEntryBarProps {
  onEntryCreated?: () => void;
  onVoiceOpen?: () => void;
  placeholder?: string;
}

export function QuickEntryBar({ onEntryCreated, onVoiceOpen, placeholder }: QuickEntryBarProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const [messageType, setMessageType] = useState(""); // "success" | "error"
  const inputRef = useRef(null);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 15000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 15000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || loading) return;

    setLoading(true);
    setMessage("");
    setToast("");

    const result = await addNaturalLanguageEntry(text.trim());
    setLoading(false);

    if (result.success) {
      setText("");
      const isProjectOnly = (result.data as Record<string, unknown>)?.project_only === true;
      if (isProjectOnly) {
        const projName = (result.data as Record<string, unknown>)?.project as string || "";
        setMessage(`Project "${projName}" created!`);
      } else {
        setMessage("Entry created!");
      }
      setMessageType("success");
      const comment = result.data?.comment || result.data?.data?.comment;
      if (comment) {
        setToast(comment);
      }
      if (onEntryCreated) onEntryCreated();
    } else {
      setMessage(result.message || "Failed to create entry");
      setMessageType("error");
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="quick-entry-bar">
      <form className="quick-entry-form" onSubmit={handleSubmit}>
        <div className="quick-entry-input-wrap">
          <svg className="quick-entry-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="quick-entry-input"
            placeholder={placeholder || 'Quick add: "Fixed login bug for ProjectX, urgent, due tomorrow"...'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          {/* Voice button */}
          {onVoiceOpen && (
            <button
              type="button"
              className="quick-entry-voice"
              onClick={onVoiceOpen}
              aria-label="Voice entry"
              title="Record a voice entry"
            >
              <FiMic size={16} />
            </button>
          )}
          <button
            type="submit"
            className="quick-entry-submit"
            disabled={loading || !text.trim()}
          >
            {loading ? (
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
      </form>
      {message && (
        <div className={`quick-entry-message ${messageType}`}>
          {message}
        </div>
      )}
      {toast && (
        <div className="quick-entry-toast">
          <svg className="toast-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
