import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { getAllEntries } from '@/functions/project/entries';
import { getProjectsByEmail } from '@/functions/project/project';
import { getArchives, getArchivedProjects } from '@/functions/project/archives';
import { addEntry } from '@/functions/project/entries';
import { addProject } from '@/functions/project/project';
import { archiveEntry } from '@/functions/project/archives';
import {
  buildExportBundle,
  exportToCSV,
  exportToICS,
  exportToJSON,
  exportToMarkdown,
  type RawEntryRow,
  type RawProjectRow,
} from '@/lib/export';
import { parseImport, type ImportResult } from '@/lib/import';
import './DataPortability.css';

export default function DataPortability() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  const userEmail = user?.email ?? '';

  // ── Export ──────────────────────────────────────────────────────────────────

  const handleExport = useCallback(
    async (format: 'json' | 'csv' | 'md' | 'ics') => {
      if (!userEmail) return;
      setExporting(true);
      setExportSuccess(null);
      setImportResult(null);
      setImportSuccess(false);

      try {
        // Fetch all data: projects + entries (active and archived)
        const [projectsRes, archivedProjectsRes, entriesRes, archivedEntriesRes] =
          await Promise.all([
            getProjectsByEmail(userEmail),
            getArchivedProjects(userEmail),
            getAllEntries(userEmail),
            getArchives(userEmail, null),
          ]);

        const activeProjects: RawProjectRow[] = (
          projectsRes?.data ??
          projectsRes?.projects ??
          []
        ).map((p: Record<string, unknown>) => ({
          project_name: p.project_name as string,
          description: (p.description as string) ?? '',
          archived: false,
        }));

        const archivedProjects: RawProjectRow[] = (
          archivedProjectsRes?.data ??
          archivedProjectsRes?.projects ??
          []
        ).map((p: Record<string, unknown>) => ({
          project_name: p.project_name as string,
          description: (p.description as string) ?? '',
          archived: true,
        }));

        const allProjects = [...activeProjects, ...archivedProjects];

        const activeEntries: RawEntryRow[] = (entriesRes?.data ?? []).map(
          (e: Record<string, unknown>) => ({
            project_name: e.project_name as string,
            entries: e.entries as Record<string, unknown>,
            due_date: (e.due_date as string) ?? null,
            priority: (e.priority as string) ?? null,
            status: (e.status as string) ?? 'up_next',
            started_at: (e.started_at as string) ?? null,
            ended_at: (e.ended_at as string) ?? null,
            duration: (e.duration as string) ?? null,
            archived: false,
          })
        );

        const archivedEntries: RawEntryRow[] = (archivedEntriesRes?.data ?? []).map(
          (e: Record<string, unknown>) => ({
            project_name: e.project_name as string,
            entries: e.entries as Record<string, unknown>,
            due_date: (e.due_date as string) ?? null,
            priority: (e.priority as string) ?? null,
            status: (e.status as string) ?? 'up_next',
            started_at: (e.started_at as string) ?? null,
            ended_at: (e.ended_at as string) ?? null,
            duration: (e.duration as string) ?? null,
            archived: true,
          })
        );

        const allEntries = [...activeEntries, ...archivedEntries];

        const bundle = buildExportBundle(userEmail, allProjects, allEntries);

        let content: string;
        let mimeType: string;
        let ext: string;

        switch (format) {
          case 'json':
            content = exportToJSON(bundle);
            mimeType = 'application/json';
            ext = 'json';
            break;
          case 'csv':
            content = exportToCSV(bundle);
            mimeType = 'text/csv';
            ext = 'csv';
            break;
          case 'md':
            content = exportToMarkdown(bundle);
            mimeType = 'text/markdown';
            ext = 'md';
            break;
          case 'ics':
            content = exportToICS(bundle);
            mimeType = 'text/calendar';
            ext = 'ics';
            break;
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `digital-logbook-export-${new Date().toISOString().slice(0, 10)}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setExportSuccess(
          `Exported ${bundle.projects.length} projects and ${bundle.entries.length} entries as ${ext.toUpperCase()}`
        );
      } catch (err) {
        console.error('[DataPortability] Export failed:', err);
        setExportSuccess(null);
      } finally {
        setExporting(false);
      }
    },
    [userEmail]
  );

  // ── Import ──────────────────────────────────────────────────────────────────

  const processImport = useCallback(
    async (file: File) => {
      if (!userEmail) return;
      setImporting(true);
      setImportResult(null);
      setImportSuccess(false);
      setExportSuccess(null);

      try {
        const text = await file.text();
        const result = parseImport(text, file.name);
        setImportResult(result);

        if (result.projects.length === 0 && result.entries.length === 0) {
          setImporting(false);
          return;
        }

        // Create projects first
        const createdProjects = new Set<string>();
        for (const project of result.projects) {
          const res = await addProject(userEmail, project.project_name, project.description);
          if (res?.success) {
            createdProjects.add(project.project_name);
          }
        }

        // Create entries
        const createdEntryIds: Array<{ projectName: string; entryId: string }> = [];
        for (const entry of result.entries) {
          const res = await addEntry(
            userEmail,
            entry.project_name,
            entry.entries ?? { title: entry.project_name },
            entry.due_date,
            entry.priority,
            entry.status,
            entry.started_at,
            entry.ended_at,
            entry.duration
          );
          if (res?.success && res?.data?.id) {
            createdEntryIds.push({
              projectName: entry.project_name,
              entryId: res.data.id,
            });
          }
        }

        // Archive entries that were archived in the export
        for (let i = 0; i < result.entries.length; i++) {
          const entry = result.entries[i];
          if (entry.archived && createdEntryIds[i]) {
            await archiveEntry(
              userEmail,
              createdEntryIds[i].projectName,
              createdEntryIds[i].entryId
            );
          }
        }

        setImportSuccess(true);
      } catch (err) {
        console.error('[DataPortability] Import failed:', err);
      } finally {
        setImporting(false);
      }
    },
    [userEmail]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processImport(file);
      // Reset so the same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [processImport]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processImport(file);
    },
    [processImport]
  );

  if (loading) {
    return (
      <div className="data-page">
        <div className="data-loading">
          <svg
            className="animate-spin"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
          </svg>
          Loading…
        </div>
      </div>
    );
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="data-page">
      <div className="data-page-header">
        <button className="btn-secondary" onClick={() => navigate('/dashboard')}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back
        </button>
        <div className="data-page-titles">
          <h1 className="data-page-title">Import & Export</h1>
          <p className="data-page-subtitle">Move your data in and out of the Digital Logbook</p>
        </div>
      </div>

      {/* ── Export section ── */}
      <div className="data-section">
        <h2>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export
        </h2>
        <p>
          Download all your projects and entries, including archived items. JSON, CSV, and Markdown
          exports are round-trip safe — importing them into an empty database reproduces the
          original data exactly. The iCalendar export opens in Google Calendar, Outlook, and Apple
          Calendar.
        </p>
        <div className="data-export-buttons">
          <button className="btn-primary" onClick={() => handleExport('json')} disabled={exporting}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            {exporting ? 'Exporting…' : 'Export as JSON'}
          </button>
          <button
            className="btn-secondary"
            onClick={() => handleExport('csv')}
            disabled={exporting}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            {exporting ? 'Exporting…' : 'Export as CSV'}
          </button>
          <button className="btn-secondary" onClick={() => handleExport('md')} disabled={exporting}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            {exporting ? 'Exporting…' : 'Export as Markdown'}
          </button>
          <button
            className="btn-secondary"
            onClick={() => handleExport('ics')}
            disabled={exporting}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {exporting ? 'Exporting…' : 'Export as iCalendar'}
          </button>
        </div>
        {exportSuccess && (
          <div className="data-success">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {exportSuccess}
          </div>
        )}
      </div>

      {/* ── Import section ── */}
      <div className="data-section">
        <h2>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Import
        </h2>
        <p>
          Upload a previously exported JSON, CSV, or Markdown file. Projects are created first, then
          entries. Invalid rows are reported and skipped.
        </p>
        <div
          className={`data-import-area${dragOver ? ' drag-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            id="data-import-file"
            ref={fileInputRef}
            type="file"
            accept=".json,.csv,.md,.markdown"
            onChange={handleFileChange}
          />
          <label htmlFor="data-import-file">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Choose a file or drop it here
          </label>
          <p>Supported formats: JSON, CSV, Markdown</p>
        </div>

        {importing && (
          <div className="data-loading">
            <svg
              className="animate-spin"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
            </svg>
            Importing data…
          </div>
        )}

        {importResult && !importing && (
          <div className="data-result">
            <h3>Import Report</h3>
            <div className="data-result-stats">
              <span className="success">✓ {importResult.projects.length} projects</span>
              <span className="success">✓ {importResult.entries.length} entries</span>
              {importResult.rejections.length > 0 && (
                <span className="warning">⚠ {importResult.rejections.length} rejected</span>
              )}
            </div>
            {importSuccess && (
              <div className="data-success">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Import complete
              </div>
            )}
            {importResult.rejections.length > 0 && (
              <div className="data-result-rejections">
                <h4>Rejected rows</h4>
                <ul>
                  {importResult.rejections.map((r, i) => (
                    <li key={i}>
                      <strong>Line {r.line}:</strong> {r.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
