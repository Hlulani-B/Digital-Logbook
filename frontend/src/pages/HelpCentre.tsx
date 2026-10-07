import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FiSearch, FiX, FiChevronRight, FiArrowLeft, FiMessageSquare } from 'react-icons/fi';
import { HELP_CATEGORIES, searchArticles } from '@/lib/helpContent';
import './HelpCentre.css';

// SVG icon components matching NavBar style
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  rocket: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  ),
  compass: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  ),
  shield: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  stethoscope: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  ),
  lock: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  'help-circle': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  'book-open': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  zap: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  mail: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
};

// Article icon components
const ARTICLE_ICONS: Record<string, React.ReactNode> = {
  welcome: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  ),
  'creating-first-entry': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  'understanding-projects': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  'using-focus-mode': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  'using-calendar': (
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
  ),
  'using-kanban': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  ),
  'using-timeline': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="2" y1="12" x2="22" y2="12" />
      <circle cx="6" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="18" cy="12" r="2" />
    </svg>
  ),
  'using-today': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
  'managing-notifications': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  'importing-exporting': (
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
  ),
  'changing-themes': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="13.5" cy="6.5" r=".5" />
      <circle cx="17.5" cy="10.5" r=".5" />
      <circle cx="8.5" cy="7.5" r=".5" />
      <circle cx="6.5" cy="12.5" r=".5" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
  ),
  'user-roles': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  'field-permissions': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  'entries-not-saving': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  ),
  'timer-not-working': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  'email-notifications': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  'mobile-display': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  ),
  'managing-account': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  'data-privacy': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  'is-free': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  'offline-usage': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  ),
  'natural-language': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  'how-many-projects': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  'attach-images': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  'key-terms': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  'latest-updates': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  'report-bug': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m8 2 1.88 1.88" />
      <path d="M14.12 3.88 16 2" />
      <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
      <path d="M12 20v-9" />
      <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
      <path d="M6 13H2" />
      <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
      <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
      <path d="M22 13h-4" />
      <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
    </svg>
  ),
  'send-feedback': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
};

export default function HelpCentre() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialArticle = searchParams.get('article');
  const initialCategory = searchParams.get('category');

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(
    initialCategory || HELP_CATEGORIES[0]?.id || ''
  );
  const [activeArticle, setActiveArticle] = useState<string | null>(initialArticle || null);
  const [mobileShowArticle, setMobileShowArticle] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const searchResults = useMemo(() => searchArticles(searchQuery), [searchQuery]);

  const currentCategory = HELP_CATEGORIES.find((c) => c.id === activeCategory);
  const currentArticle = useMemo(() => {
    if (!activeArticle || !currentCategory) return null;
    return currentCategory.articles.find((a) => a.id === activeArticle) || null;
  }, [activeArticle, currentCategory]);

  // Handle keyboard shortcut: / to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setSearchQuery('');
        searchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSelectArticle = (articleId: string, categoryId: string) => {
    setActiveArticle(articleId);
    setActiveCategory(categoryId);
    setMobileShowArticle(true);
    setSearchQuery('');
  };

  const handleBackToList = () => {
    setActiveArticle(null);
    setMobileShowArticle(false);
  };

  const handleCategoryChange = (catId: string) => {
    setActiveCategory(catId);
    setActiveArticle(null);
    setMobileShowArticle(false);
  };

  return (
    <div className="help-centre">
      {/* Header */}
      <header className="help-centre__header">
        <button
          className="help-centre__back"
          onClick={() => navigate('/dashboard')}
          title="Go back"
        >
          <FiArrowLeft size={20} />
        </button>
        <div className="help-centre__title-group">
          <h1 className="help-centre__title">Help Centre</h1>
          <p className="help-centre__subtitle">Find answers, guides, and support</p>
        </div>
      </header>

      {/* Search */}
      <div className="help-centre__search-bar">
        <FiSearch className="help-centre__search-icon" size={18} />
        <input
          ref={searchRef}
          type="text"
          className="help-centre__search-input"
          placeholder="Search help articles... (press / to focus)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="help-centre__search-clear" onClick={() => setSearchQuery('')}>
            <FiX size={16} />
          </button>
        )}
      </div>

      {/* Search Results */}
      {searchQuery && (
        <div className="help-centre__search-results">
          <p className="help-centre__results-count">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &ldquo;
            {searchQuery}&rdquo;
          </p>
          {searchResults.length === 0 ? (
            <div className="help-centre__no-results">
              <p>No articles found. Try different keywords.</p>
              <div className="help-centre__suggestions">
                <p>Popular searches:</p>
                <div className="help-centre__suggestion-tags">
                  {['focus mode', 'timer', 'export', 'notifications', 'mobile'].map((tag) => (
                    <button
                      key={tag}
                      className="help-centre__suggestion-tag"
                      onClick={() => setSearchQuery(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="help-centre__results-list">
              {searchResults.map((article) => (
                <button
                  key={article.id}
                  className="help-centre__result-item"
                  onClick={() => handleSelectArticle(article.id, article.categoryId)}
                >
                  <span className="help-centre__result-category">{article.categoryTitle}</span>
                  <span className="help-centre__result-title">
                    {ARTICLE_ICONS[article.id] && (
                      <span className="help-centre__article-icon">{ARTICLE_ICONS[article.id]}</span>
                    )}
                    {article.title}
                  </span>
                  <FiChevronRight size={16} className="help-centre__result-arrow" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      {!searchQuery && (
        <div className="help-centre__body">
          {/* Category sidebar */}
          <nav className={`help-centre__sidebar ${mobileShowArticle ? 'hidden-mobile' : ''}`}>
            {HELP_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                className={`help-centre__cat-btn ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => handleCategoryChange(cat.id)}
              >
                <span className="help-centre__cat-icon">{CATEGORY_ICONS[cat.icon]}</span>
                <span className="help-centre__cat-label">{cat.title}</span>
                <span className="help-centre__cat-count">{cat.articles.length}</span>
              </button>
            ))}

            {/* Quick actions at bottom of sidebar */}
            <div className="help-centre__sidebar-actions">
              <button
                className="help-centre__action-btn help-centre__action-btn--bug"
                onClick={() => navigate('/report-bug')}
              >
                <FiMessageSquare size={16} />
                Report a Bug
              </button>
            </div>
          </nav>

          {/* Article list / content */}
          <div className={`help-centre__content ${mobileShowArticle ? 'show-article-mobile' : ''}`}>
            {currentArticle ? (
              <article className="help-centre__article">
                <button className="help-centre__article-back" onClick={handleBackToList}>
                  <FiArrowLeft size={16} />
                  Back to {currentCategory?.title}
                </button>
                <h2 className="help-centre__article-title">
                  {ARTICLE_ICONS[currentArticle.id] && (
                    <span className="help-centre__article-icon">
                      {ARTICLE_ICONS[currentArticle.id]}
                    </span>
                  )}
                  {currentArticle.title}
                </h2>
                <div className="help-centre__article-body">
                  {currentArticle.content.split('\n\n').map((paragraph, i) => {
                    // Handle bold text and lists
                    const lines = paragraph.split('\n');
                    return (
                      <div key={i} className="help-centre__article-paragraph">
                        {lines.map((line, j) => {
                          if (line.startsWith('**') && line.endsWith('**')) {
                            return (
                              <p key={j} className="help-centre__article-bold">
                                {line.replace(/\*\*/g, '')}
                              </p>
                            );
                          }
                          if (line.startsWith('- **')) {
                            const match = line.match(/^- \*\*(.+?)\*\*\s*(.*)$/);
                            if (match) {
                              return (
                                <div key={j} className="help-centre__article-list-item">
                                  <span className="help-centre__article-bullet">•</span>
                                  <span>
                                    <strong>{match[1]}</strong> {match[2]}
                                  </span>
                                </div>
                              );
                            }
                          }
                          if (line.startsWith('- ')) {
                            return (
                              <div key={j} className="help-centre__article-list-item">
                                <span className="help-centre__article-bullet">•</span>
                                <span>{line.slice(2)}</span>
                              </div>
                            );
                          }
                          if (line.startsWith('**') && line.includes('**')) {
                            // Inline bold
                            const parts = line.split(/\*\*(.+?)\*\*/g);
                            return (
                              <p key={j}>
                                {parts.map((part, k) =>
                                  k % 2 === 1 ? <strong key={k}>{part}</strong> : part
                                )}
                              </p>
                            );
                          }
                          if (line.trim() === '') return null;
                          return <p key={j}>{line}</p>;
                        })}
                      </div>
                    );
                  })}
                </div>
              </article>
            ) : (
              <div className="help-centre__article-list">
                <h2 className="help-centre__category-title">
                  {CATEGORY_ICONS[currentCategory?.icon || '']} {currentCategory?.title}
                </h2>
                {currentCategory?.articles.map((article) => (
                  <button
                    key={article.id}
                    className="help-centre__article-card"
                    onClick={() => handleSelectArticle(article.id, currentCategory.id)}
                  >
                    <span className="help-centre__article-card-title">
                      {ARTICLE_ICONS[article.id] && (
                        <span className="help-centre__article-icon">
                          {ARTICLE_ICONS[article.id]}
                        </span>
                      )}
                      {article.title}
                    </span>
                    <FiChevronRight size={18} className="help-centre__article-card-arrow" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
