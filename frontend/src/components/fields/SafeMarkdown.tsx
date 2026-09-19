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

export function SafeMarkdown({ value }: { value: string }) {
  return (
    <div className="cf-markdown">
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
  );
}
