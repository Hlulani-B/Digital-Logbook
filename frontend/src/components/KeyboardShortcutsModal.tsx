import { useState, useEffect } from 'react';
import type { KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';

interface KeyboardShortcutsModalProps {
  shortcuts: KeyboardShortcut[];
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal displaying all available keyboard shortcuts grouped by category.
 */
export function KeyboardShortcutsModal({
  shortcuts,
  isOpen,
  onClose,
}: KeyboardShortcutsModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Listen for custom event to show modal
  useEffect(() => {
    const handleShowEvent = () => setIsVisible(true);
    window.addEventListener('show-keyboard-help', handleShowEvent);
    return () => window.removeEventListener('show-keyboard-help', handleShowEvent);
  }, []);

  if (!isVisible && !isOpen) return null;

  // Group shortcuts by category
  const navigation = shortcuts.filter((s) => s.category === 'navigation');
  const actions = shortcuts.filter((s) => s.category === 'actions');
  const general = shortcuts.filter((s) => s.category === 'general');

  const handleClose = () => {
    setIsVisible(false);
    onClose();
  };

  const renderShortcutKey = (key: string) => {
    // Handle multi-key shortcuts like "G then D"
    if (key.includes(' then ')) {
      const parts = key.split(' then ');
      return (
        <span className="shortcut-key-group">
          {parts.map((part, i) => (
            <span key={i}>
              {i > 0 && <span className="shortcut-then">then</span>}
              <kbd className="shortcut-kbd">{part}</kbd>
            </span>
          ))}
        </span>
      );
    }

    // Handle combo shortcuts like "Ctrl+K"
    if (key.includes('+')) {
      const parts = key.split('+');
      return (
        <span className="shortcut-key-group">
          {parts.map((part, i) => (
            <span key={i}>
              {i > 0 && <span className="shortcut-plus">+</span>}
              <kbd className="shortcut-kbd">{part}</kbd>
            </span>
          ))}
        </span>
      );
    }

    // Single key
    return <kbd className="shortcut-kbd">{key}</kbd>;
  };

  const renderSection = (title: string, items: KeyboardShortcut[]) => {
    if (items.length === 0) return null;
    return (
      <div className="shortcut-section">
        <h4 className="shortcut-section-title">{title}</h4>
        <div className="shortcut-list">
          {items.map((shortcut, i) => (
            <div key={i} className="shortcut-item">
              <span className="shortcut-description">{shortcut.description}</span>
              <span className="shortcut-keys">{renderShortcutKey(shortcut.key)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="shortcut-modal-overlay" onClick={handleClose}>
      <div className="shortcut-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcut-modal-header">
          <h3>Keyboard Shortcuts</h3>
          <button className="shortcut-modal-close" onClick={handleClose}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="shortcut-modal-content">
          {renderSection('Navigation', navigation)}
          {renderSection('Actions', actions)}
          {renderSection('General', general)}
        </div>
        <div className="shortcut-modal-footer">
          <span>
            Press <kbd className="shortcut-kbd">?</kbd> to show this help
          </span>
        </div>
      </div>
    </div>
  );
}

export default KeyboardShortcutsModal;
