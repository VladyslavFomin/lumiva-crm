import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Props = {
  text: string;
  /** User bubbles use light text on accent; assistant uses slate on white */
  variant: 'user' | 'assistant';
};

export function AiChatMarkdown({ text, variant }: Props) {
  if (!text.trim()) return null;

  const linkClass =
    variant === 'user'
      ? 'font-medium text-white/95 underline underline-offset-2 hover:text-white'
      : 'font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900';

  return (
    <div
      className={
        variant === 'user'
          ? 'ai-chat-md-user text-[0.9375rem] leading-relaxed'
          : 'ai-chat-md-assistant text-[0.9375rem] leading-relaxed text-slate-900'
      }
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ src, alt }) =>
            src ? (
              <img
                src={src}
                alt={alt || ''}
                className="my-2 max-h-72 max-w-full rounded-xl border border-white/20 object-contain shadow-md [.ai-chat-md-assistant_&]:border-slate-200"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : null,
          a: ({ href, children }) => (
            <a
              href={href}
              className={linkClass}
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          p: ({ children }) => (
            <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="my-2 list-disc pl-5 [li]:my-0.5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 list-decimal pl-5 [li]:my-0.5">{children}</ol>
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          code: ({ className, children }) => {
            const inline = !className;
            if (inline) {
              return (
                <code
                  className={
                    variant === 'user'
                      ? 'rounded bg-white/15 px-1 py-0.5 text-[0.9em]'
                      : 'rounded bg-slate-100 px-1 py-0.5 text-[0.9em] text-slate-800'
                  }
                >
                  {children}
                </code>
              );
            }
            return <code className={className}>{children}</code>;
          },
          pre: ({ children }) => (
            <pre
              className={
                variant === 'user'
                  ? 'my-2 overflow-x-auto rounded-xl bg-black/25 p-3 text-xs text-white/95'
                  : 'my-2 overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100'
              }
            >
              {children}
            </pre>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
