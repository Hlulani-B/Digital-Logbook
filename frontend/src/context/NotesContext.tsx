import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface EntryData {
  id: string;
  summary?: string | null;
  entries?: Record<string, unknown> | string | null;
  project_name?: string;
  status?: string;
  priority?: string | null;
  due_date?: string | null;
}

interface NotesContextType {
  notesEntry: EntryData | null;
  openNotes: (entry: EntryData) => void;
  closeNotes: () => void;
}

const NotesContext = createContext<NotesContextType | null>(null);

export function NotesProvider({ children }: { children: ReactNode }) {
  const [notesEntry, setNotesEntry] = useState<EntryData | null>(null);

  const openNotes = useCallback((entry: EntryData) => {
    setNotesEntry(entry);
  }, []);

  const closeNotes = useCallback(() => {
    setNotesEntry(null);
  }, []);

  return (
    <NotesContext.Provider value={{ notesEntry, openNotes, closeNotes }}>
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotes must be used within a NotesProvider');
  }
  return context;
}
