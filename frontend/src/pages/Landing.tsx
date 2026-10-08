import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import './landing.css';

const TYPING_PHRASES = [
  'worked on the login page for 2 hours',
  'finish API docs by Friday',
  'spent 45 min on the kanban drag feature',
  'review PR #395 tomorrow morning',
];

const TICKER_ITEMS: Array<{ badge: 'new' | 'updated'; text: string }> = [
  { badge: 'new', text: 'Voice-guided tour with auto-advance' },
  { badge: 'new', text: 'Focus mode timer with presets' },
  { badge: 'updated', text: 'Help Centre with SVG icons' },
  { badge: 'new', text: 'In-app bug report form' },
  { badge: 'updated', text: 'Kanban drag & drop' },
  { badge: 'new', text: 'iCalendar export' },
  { badge: 'updated', text: '15 colour themes' },
  { badge: 'new', text: 'Natural language entry parsing' },
];

const STATS = [
  { count: 6, suffix: '', label: 'Views & Layouts' },
  { count: 15, suffix: '', label: 'Colour Themes' },
  { count: 41, suffix: '+', label: 'Features Shipped' },
  { count: 100, suffix: '%', label: 'Client-Side' },
  { count: 0, suffix: '', label: 'Ads or Tracking' },
];

const ABOUT_CARDS = [
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    title: 'Plan visually',
    desc: 'Calendar, kanban and a zoomable timeline — different ways to see your work.',
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    title: 'Never miss a deadline',
    desc: 'Due-soon and overdue alerts by email and in the in-app bell.',
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: 'Own your data',
    desc: 'Export to JSON, CSV, Markdown or iCalendar anytime — no lock-in.',
  },
];

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    title: 'Calendar View',
    desc: 'See entries on their due dates. Drag to reschedule. Switch between month and week views instantly.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="8" y1="6" x2="8" y2="18" />
        <line x1="16" y1="6" x2="16" y2="18" />
      </svg>
    ),
    title: 'Kanban Board',
    desc: 'Drag cards between Up Next, In Motion and Done. Visual progress at a glance.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="3" y1="5" x2="15" y2="5" />
        <circle cx="17" cy="5" r="2" />
        <line x1="3" y1="12" x2="11" y2="12" />
        <circle cx="13" cy="12" r="2" />
        <line x1="3" y1="19" x2="19" y2="19" />
        <circle cx="21" cy="19" r="2" />
      </svg>
    ),
    title: 'Timeline View',
    desc: 'Zoomable Gantt chart with dependency arrows. See how tasks connect and overlap.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: 'Focus Timer',
    desc: 'Built-in Pomodoro timer with session tracking. Stay focused and log time automatically.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    title: 'Smart Notifications',
    desc: 'Due-soon and overdue alerts by email and in-app bell. Never miss a deadline again.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
    title: 'Import & Export',
    desc: 'Export to JSON, CSV, Markdown or iCalendar anytime. Your data, no lock-in.',
  },
];

const TEAM = [
  ['NN', 'Nasiphi Ntontela', 'Team Lead'],
  ['HB', 'Hlulani Baloyi', 'Developer'],
  ['SM', 'Siphesihle Merile', 'Developer'],
  ['SV', 'Sicelo Vanyelwa', 'Developer'],
  ['LM', 'Lupa Martins', 'Developer'],
  ['ZM', 'Zamokuhle Maziya', 'Developer'],
] as const;

function useReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll('.lp-reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

function useCounters() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const el = e.target as HTMLElement;
            const target = parseInt(el.dataset.count || '0');
            const suffix = el.dataset.suffix || '';
            if (target === 0) {
              el.textContent = '0' + suffix;
              observer.unobserve(el);
              return;
            }
            const duration = 1500;
            const start = performance.now();
            const step = (now: number) => {
              const progress = Math.min((now - start) / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              el.textContent = Math.round(eased * target) + suffix;
              if (progress < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.5 }
    );
    document.querySelectorAll('[data-count]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

/**
 * Mouse-following spotlight + 3D tilt for interactive cards.
 * Returns ref + style props to spread onto the card element.
 */
function useCardTilt() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [spotlight, setSpotlight] = useState({ x: 50, y: 50, opacity: 0 });
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setSpotlight({ x, y, opacity: 1 });
    // Tilt: max 8 degrees, based on cursor position relative to center
    const ry = ((e.clientX - rect.left) / rect.width - 0.5) * 16;
    const rx = (0.5 - (e.clientY - rect.top) / rect.height) * 16;
    setTilt({ rx, ry });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setSpotlight((s) => ({ ...s, opacity: 0 }));
    setTilt({ rx: 0, ry: 0 });
  }, []);

  const cardStyle: React.CSSProperties = {
    transform: `perspective(800px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
    transition: 'transform 0.15s ease-out',
  };

  return { cardRef, spotlight, cardStyle, handleMouseMove, handleMouseLeave };
}

function TypingDemo() {
  const [text, setText] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [active, setActive] = useState(false);
  const phraseIdx = useRef(0);
  const charIdx = useRef(0);
  const isDeleting = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const loop = useCallback(() => {
    const phrase = TYPING_PHRASES[phraseIdx.current];
    if (!isDeleting.current) {
      setText(phrase.substring(0, charIdx.current + 1));
      charIdx.current++;
      if (charIdx.current === phrase.length) {
        setActive(true);
        setShowResult(true);
        timerRef.current = setTimeout(() => {
          isDeleting.current = true;
          loop();
        }, 2500);
        return;
      }
      timerRef.current = setTimeout(loop, 50 + Math.random() * 40);
    } else {
      setText(phrase.substring(0, charIdx.current - 1));
      charIdx.current--;
      if (charIdx.current === 0) {
        isDeleting.current = false;
        setActive(false);
        setShowResult(false);
        phraseIdx.current = (phraseIdx.current + 1) % TYPING_PHRASES.length;
        timerRef.current = setTimeout(loop, 600);
        return;
      }
      timerRef.current = setTimeout(loop, 25);
    }
  }, []);

  useEffect(() => {
    timerRef.current = setTimeout(loop, 1000);
    return () => clearTimeout(timerRef.current);
  }, [loop]);

  return (
    <div className="lp-typing-demo">
      <div className="lp-typing-label">
        <span className="lp-typing-label-dot" />
        Try it — type naturally
      </div>
      <div className={`lp-typing-input-wrap${active ? ' active' : ''}`}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="lp-typing-icon"
        >
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        <span className="lp-typing-text">{text}</span>
        <span className="lp-typing-cursor" />
      </div>
      <div className={`lp-typing-result${showResult ? ' visible' : ''}`}>
        <div className="lp-typing-card">
          <div className="lp-typing-card-dot" />
          <div className="lp-typing-card-content">
            <div className="lp-typing-card-title">Login feature — 2 hours</div>
            <div className="lp-typing-card-meta">
              <span className="lp-typing-card-tag">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Due: Oct 10
              </span>
              <span className="lp-typing-card-tag">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                2h logged
              </span>
              <span className="lp-typing-card-project">Plannar project</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Shared interactive card with spotlight + 3D tilt + floating animation */
function InteractiveCard({
  className,
  children,
  delay,
}: {
  className: string;
  children: React.ReactNode;
  delay: number;
}) {
  const { cardRef, spotlight, cardStyle, handleMouseMove, handleMouseLeave } = useCardTilt();
  return (
    <div
      ref={cardRef}
      className={`${className} lp-reveal lp-d${delay} lp-card-interactive`}
      style={cardStyle}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Spotlight overlay */}
      <div
        className="lp-card-spotlight"
        style={{
          background: `radial-gradient(300px circle at ${spotlight.x}% ${spotlight.y}%, rgba(74, 60, 40, 0.06), transparent 60%)`,
          opacity: spotlight.opacity,
        }}
      />
      {children}
    </div>
  );
}

function AboutCard({
  card,
  delay,
}: {
  card: { icon: React.ReactNode; title: string; desc: string };
  delay: number;
}) {
  return (
    <InteractiveCard className="lp-about-card" delay={delay}>
      <div
        className="lp-about-card-icon lp-icon-float"
        style={{ animationDelay: `${delay * 0.3}s` }}
      >
        {card.icon}
      </div>
      <h3>{card.title}</h3>
      <p>{card.desc}</p>
    </InteractiveCard>
  );
}

function FeatureCard({
  card,
  delay,
}: {
  card: { icon: React.ReactNode; title: string; desc: string };
  delay: number;
}) {
  return (
    <InteractiveCard className="lp-feature-card" delay={delay}>
      <div className="lp-feature-icon lp-icon-float" style={{ animationDelay: `${delay * 0.2}s` }}>
        {card.icon}
      </div>
      <h3>{card.title}</h3>
      <p>{card.desc}</p>
    </InteractiveCard>
  );
}

export default function Landing() {
  useReveal();
  useCounters();

  // Hero video: alternate between two videos for seamless loop
  const [activeVideo, setActiveVideo] = useState<1 | 2>(1);
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);

  const handleVideo1End = useCallback(() => {
    setActiveVideo(2);
    video2Ref.current?.play();
  }, []);

  const handleVideo2End = useCallback(() => {
    setActiveVideo(1);
    video1Ref.current?.play();
  }, []);

  const tickerItems = [...TICKER_ITEMS, ...TICKER_ITEMS];

  return (
    <div className="lp-page">
      <div className="lp-bg-mesh" />
      <div className="lp-bg-grid" />

      <div className="lp-content">
        {/* Navigation */}
        <nav className="lp-nav">
          <div className="lp-nav-logo">
            <div className="lp-nav-logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
            Plannar
          </div>
          <div className="lp-nav-links">
            <a href="#lp-features">Features</a>
            <a href="#lp-team">Team</a>
            <Link to="/signin" className="lp-nav-cta">
              Sign In
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="lp-hero">
          <div className="lp-hero-split">
            <div className="lp-hero-content">
              <div className="lp-hero-badge lp-reveal">
                <span className="lp-hero-badge-dot" />
                Built by Codacaine Team
              </div>
              <h1 className="lp-reveal lp-d1">
                Your work,
                <br />
                <span className="lp-gradient-text">logged beautifully.</span>
              </h1>
              <p className="lp-reveal lp-d2">
                The Plannar turns scattered tasks, deadlines and notes into one calm, searchable
                workspace. Type naturally and let it organise itself.
              </p>
              <div className="lp-hero-actions lp-reveal lp-d3">
                <Link to="/signin" className="lp-btn lp-btn-primary">
                  Get Started
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
                <a href="#lp-features" className="lp-btn lp-btn-secondary">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="10 8 16 12 10 16 10 8" />
                  </svg>
                  See Features
                </a>
              </div>

              <TypingDemo />
            </div>

            <div className="lp-hero-image lp-reveal lp-d2">
              <div className="lp-hero-video-container">
                <video
                  ref={video1Ref}
                  src="/video1.mp4"
                  autoPlay
                  muted
                  playsInline
                  onEnded={handleVideo1End}
                  className="lp-hero-video"
                  style={{ opacity: activeVideo === 1 ? 1 : 0 }}
                />
                <video
                  ref={video2Ref}
                  src="/video2.mp4"
                  muted
                  playsInline
                  onEnded={handleVideo2End}
                  className="lp-hero-video"
                  style={{ opacity: activeVideo === 2 ? 1 : 0 }}
                />
              </div>
              <div className="lp-hero-video-overlay" />
            </div>
          </div>
        </section>

        {/* About — three highlight cards */}
        <section className="lp-section lp-about-section">
          <div className="lp-section-inner">
            <div className="lp-section-tag lp-reveal">About</div>
            <h2 className="lp-section-title lp-reveal lp-d1">Your work, logged beautifully.</h2>
            <p className="lp-section-lead lp-reveal lp-d2">
              The Plannar turns scattered tasks, deadlines and notes into one calm, searchable
              timeline. Type naturally — &ldquo;worked on the login feature for 2 hours&rdquo; — and
              it files itself under the right project with the right due date.
            </p>
            <div className="lp-about-grid">
              {ABOUT_CARDS.map((c, i) => (
                <AboutCard key={c.title} card={c} delay={i + 1} />
              ))}
            </div>
          </div>
        </section>

        {/* What's New Ticker */}
        <div className="lp-ticker-section">
          <div className="lp-ticker-track">
            {tickerItems.map((item, i) => (
              <div className="lp-ticker-item" key={i}>
                <span className={`lp-ticker-badge ${item.badge}`}>
                  {item.badge === 'new' ? 'New' : 'Updated'}
                </span>
                {item.text}
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <section id="lp-features" className="lp-section">
          <div className="lp-section-inner">
            <div className="lp-section-tag lp-reveal">Features</div>
            <h2 className="lp-section-title lp-reveal lp-d1">
              Everything you need,
              <br />
              nothing you don't.
            </h2>
            <p className="lp-section-lead lp-reveal lp-d2">
              One workspace for tracking time, managing projects, and staying on top of deadlines.
            </p>

            <div className="lp-features-grid">
              {FEATURES.map((f, i) => (
                <FeatureCard key={f.title} card={f} delay={(i % 3) + 1} />
              ))}
            </div>

            {/* Stats */}
            <div className="lp-stats">
              {STATS.map((s, i) => (
                <div className={`lp-stat lp-reveal lp-d${i}`} key={s.label}>
                  <div className="lp-stat-number" data-count={s.count} data-suffix={s.suffix}>
                    0
                  </div>
                  <div className="lp-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Team */}
        <section id="lp-team" className="lp-section">
          <div className="lp-section-inner">
            <div className="lp-section-tag lp-reveal">About Us</div>
            <h2 className="lp-section-title lp-reveal lp-d1">Built by team Codacaine.</h2>
            <p className="lp-section-lead lp-reveal lp-d2">
              Six students, one inspiration: turning ambition into momentum.
            </p>

            <div className="lp-team-grid">
              {TEAM.map(([initials, name, role], i) => (
                <div className={`lp-team-member lp-reveal lp-d${(i % 3) + 1}`} key={name}>
                  <div className="lp-team-avatar">{initials}</div>
                  <h3>{name}</h3>
                  <span>{role}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="lp-cta">
          <div className="lp-cta-box lp-reveal">
            <h2>Ready to get started?</h2>
            <p>Sign in and start logging your work in under a minute.</p>
            <Link to="/signin" className="lp-btn lp-btn-primary">
              Sign In Now
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </section>

        <footer className="lp-footer">&copy; 2026 Codacaine. Plannar — All rights reserved.</footer>
      </div>
    </div>
  );
}
