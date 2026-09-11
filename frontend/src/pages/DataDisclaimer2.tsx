import { useEffect, useState, useCallback } from 'react';
import { FiShield, FiDatabase, FiCpu, FiLock } from 'react-icons/fi';
import { NavBar } from '../components/NavBar.tsx';
import { Header } from '../components/Header.tsx';
import { cacheGet, cacheSubscribe, CACHE_STORES } from '@/lib/cache';
import { useAuth } from '@/context/AuthContext';

/**
 * DataDisclaimer2 — accessible from the NavBar drawer at any time.
 * Full-page layout with NavBar + Header.
 * Transparently explains how the user's data is stored, what the AI does with it,
 * and what rights they have. No accept/continue — just informational.
 */
export function DataDisclaimer2() {
  const { user } = useAuth();
  const email = user?.email;
  const [projects, setProjects] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    if (!email) return;
    const [p, e] = await Promise.all([
      cacheGet(CACHE_STORES.PROJECTS, email),
      cacheGet(CACHE_STORES.ALL_ENTRIES, email),
    ]);
    if (p?.data || p?.projects) setProjects(p.data || p.projects || []);
    if (e?.data) setEntries(Array.isArray(e.data) ? e.data : []);
  }, [email]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Subscribe to cache changes — re-render NavBar/Header when data arrives
  useEffect(() => {
    if (!email) return;
    const unsubs = [
      cacheSubscribe(CACHE_STORES.PROJECTS, email, () => loadData()),
      cacheSubscribe(CACHE_STORES.ALL_ENTRIES, email, () => loadData()),
    ];
    return () => unsubs.forEach((u) => u());
  }, [email, loadData]);

  return (
    <div className="dash-layout">
      <div className="bg-mesh" />
      <NavBar projects={projects} entries={entries} />
      <main className="dash-main">
        <Header title="Data & AI Disclaimer" />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            maxWidth: 720,
            margin: '0 auto',
            padding: '1.5rem 1rem',
            textAlign: 'left',
          }}
        >
          {/* Intro */}
          <p style={{ fontSize: '0.95rem', color: 'var(--text-dim)', lineHeight: 1.7, margin: 0 }}>
            We want you to know exactly what happens with your information.
            No surprises — here's the honest picture.
          </p>

          {/* Data Storage */}
          <div className="disclaimer-section">
            <div className="disclaimer-section-header">
              <FiDatabase size={18} />
              <span>Where your data lives</span>
            </div>
            <ul className="disclaimer-list">
              <li>
                Your entries, projects, and profile are stored in a <strong>Supabase</strong>{' '}
                cloud database (PostgreSQL). Supabase is an open-source backend hosted on
                infrastructure in dedicated data centres.
              </li>
              <li>
                A copy of your data is also cached <strong>locally in your browser</strong>{' '}
                (IndexedDB) so the app works fast and offline. This cache stays on your device
                and is never sent anywhere except back to your own account.
              </li>
              <li>
                The app is hosted on <strong>Render</strong> (free tier). Your data in transit
                is encrypted via HTTPS.
              </li>
            </ul>
          </div>

          {/* AI Usage */}
          <div className="disclaimer-section">
            <div className="disclaimer-section-header">
              <FiCpu size={18} />
              <span>How AI is used</span>
            </div>
            <ul className="disclaimer-list">
              <li>
                When you type a quick entry, the text is sent to an <strong>AI model</strong>{' '}
                to parse it into structured data (project, priority, due date). This is the
                only automated AI processing that happens.
              </li>
              <li>
                The AI <strong>reads your entry text and project names</strong> to understand
                context. It does <strong>not</strong> have access to your password, email, or
                any other personal data.
              </li>
              <li>
                AI-generated comments and greetings are <strong>optional</strong> — you can
                turn them off at any time in Settings → Preferences → AI Messages.
              </li>
              <li>
                We do <strong>not</strong> train any external AI model on your data. The AI
                provider processes your text per-request and does not retain it for model
                training.
              </li>
              <li>
                <strong>Quick Add is not perfect.</strong> The AI may misread your intent —
                for example it could assign an entry to the wrong project, guess the wrong
                priority, or parse a due date incorrectly. <strong>Always verify</strong>{' '}
                that the entry was filed in the right place after using Quick Add. You can
                edit any entry to fix mistakes.
              </li>
            </ul>
          </div>

          {/* Privacy & Control */}
          <div className="disclaimer-section">
            <div className="disclaimer-section-header">
              <FiLock size={18} />
              <span>Your rights &amp; control</span>
            </div>
            <ul className="disclaimer-list">
              <li>
                You can <strong>export all your data</strong> at any time via Settings →
                Data Portability (JSON format).
              </li>
              <li>
                You can <strong>delete your account</strong> permanently from Settings →
                Account. There is a 30-day grace period in case you change your mind.
              </li>
              <li>
                Your data is <strong>yours</strong>. We will never sell it, share it with
                advertisers, or use it for anything other than running this app.
              </li>
            </ul>
          </div>

          {/* Transparency note */}
          <div
            style={{
              padding: '0.85rem 1.1rem',
              borderRadius: 'var(--radius-xs, 8px)',
              background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.15)',
              fontSize: '0.85rem',
              lineHeight: 1.7,
              color: 'var(--text-secondary)',
            }}
          >
            <FiShield
              size={14}
              style={{ verticalAlign: 'middle', marginRight: 6, marginBottom: 2 }}
            />
            <strong>Open source:</strong> this app's code is publicly auditable. Anyone can
            inspect exactly what happens with your data.
          </div>
        </div>
      </main>
    </div>
  );
}

export default DataDisclaimer2;
