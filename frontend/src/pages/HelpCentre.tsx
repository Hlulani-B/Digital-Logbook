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
                  <span className="help-centre__result-title">{article.title}</span>
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
                <h2 className="help-centre__article-title">{currentArticle.title}</h2>
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
                    <span className="help-centre__article-card-title">{article.title}</span>
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
