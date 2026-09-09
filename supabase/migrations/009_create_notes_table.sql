-- Per-entry personalisation notes
-- Lets users attach text, image, pdf, or link notes to any entry.
-- Cascade delete ensures notes are cleaned up when the parent entry is removed.

CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  entry_id uuid NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type IN ('text', 'image', 'pdf', 'link')),
  value text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_entry_id ON public.notes(entry_id);
CREATE INDEX IF NOT EXISTS idx_notes_email ON public.notes(email);
