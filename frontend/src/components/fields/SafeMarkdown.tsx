import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './fields.css';

export function safeMarkdownUrl(url: string): string | undefined {
  if (/[\u0000-\u0020\u007f\\]/.test(url)) return undefined;
  if (url.startsWith('#') || (url.startsWith('/') && !url.startsWith('//'))) return url;
  try {
    const parsed = new URL(url);
    return ['https:', 'http:', 'mailto:'].includes(parsed.protocol) &&
      !parsed.username &&
      !parsed.password
      ? url
      : undefined;
  } catch {
    return undefined;
  }
}

/** Max height (px) for truncated markdown preview before "Read more" kicks in. */
const MARKDOWN_TRUNCATE_PX = 200;

interface SafeMarkdownProps {
  value: string;
  /** When true (default), long content is collapsed with a "Read more" toggle. */
  truncated?: boolean;
}

export function SafeMarkdown({ value, truncated = true }: SafeMarkdownProps) {
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [needsTruncation, setNeedsTruncation] = useState(false);

  useEffect(() => {
    if (!truncated || !contentRef.current) {
      setNeedsTruncation(false);
      return;
    }
    setNeedsTruncation(contentRef.current.scrollHeight > MARKDOWN_TRUNCATE_PX);
  }, [value, truncated]);

  const showTruncated = truncated && needsTruncation && !expanded;

  return (
    <div className="cf-markdown-wrapper">
      <div
        ref={contentRef}
        className={`cf-markdown${showTruncated ? ' cf-markdown--truncated' : ''}`}
        style={showTruncated ? { maxHeight: MARKDOWN_TRUNCATE_PX } : undefined}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          skipHtml
          disallowedElements={['img', 'iframe', 'script', 'style', 'object', 'embed']}
          urlTransform={(url) => safeMarkdownUrl(url)}
          components={{
            a: ({ href, children }) =>
              href ? (
                <a href={href} rel="noopener noreferrer" target="_blank">
                  {children}
                </a>
              ) : (
                <span>{children}</span>
              ),
          }}
        >
          {value}
        </ReactMarkdown>
      </div>
      {showTruncated && (
        <button type="button" className="cf-markdown-readmore" onClick={() => setExpanded(true)}>
          Read more
        </button>
      )}
    </div>
  );
}
