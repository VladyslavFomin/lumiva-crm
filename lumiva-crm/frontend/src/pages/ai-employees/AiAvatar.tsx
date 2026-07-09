import { cn } from '../../lib/cn';

export const AI_AVATAR_ACCENTS = ['ink', 'slate', 'green', 'amber', 'blue', 'rose', 'violet'] as const;
export const AI_AVATAR_STYLES = ['mono', 'rings', 'grid', 'facet', 'dots'] as const;
export type AiAvatarAccent = (typeof AI_AVATAR_ACCENTS)[number];
export type AiAvatarStyle = (typeof AI_AVATAR_STYLES)[number];

const STROKE_BY_ACCENT: Record<AiAvatarAccent, string> = {
  ink: 'rgba(255,255,255,0.28)',
  slate: 'rgba(47,58,74,0.16)',
  green: 'rgba(23,92,61,0.16)',
  amber: 'rgba(122,74,9,0.16)',
  blue: 'rgba(33,75,138,0.16)',
  rose: 'rgba(154,31,49,0.16)',
  violet: 'rgba(74,58,134,0.16)',
};

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function deriveAvatarAccent(seed: string): AiAvatarAccent {
  return AI_AVATAR_ACCENTS[hashString(seed) % AI_AVATAR_ACCENTS.length];
}

export function deriveAvatarStyle(seed: string): AiAvatarStyle {
  return AI_AVATAR_STYLES[hashString(`${seed}-style`) % AI_AVATAR_STYLES.length];
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'AI'
  );
}

export function AiAvatar({
  name = '',
  accent = 'ink',
  avStyle = 'mono',
  size = 'md',
  src = null,
  className,
}: {
  name?: string;
  accent?: AiAvatarAccent;
  avStyle?: AiAvatarStyle;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  src?: string | null;
  className?: string;
}) {
  const initials = initialsOf(name);
  const stroke = STROKE_BY_ACCENT[accent] || 'rgba(0,0,0,0.1)';
  return (
    <span className={cn('ai-av', `sz-${size}`, className)} data-accent={accent}>
      {src ? (
        <img
          src={src}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <>
          {avStyle === 'rings' && (
            <svg viewBox="0 0 100 100" fill="none" stroke={stroke} strokeWidth={3}>
              <circle cx="50" cy="50" r="42" />
              <circle cx="50" cy="50" r="30" />
              <circle cx="50" cy="50" r="18" />
            </svg>
          )}
          {avStyle === 'grid' && (
            <svg viewBox="0 0 100 100" stroke={stroke} strokeWidth={2}>
              <path d="M25 8V92M50 8V92M75 8V92M8 25H92M8 50H92M8 75H92" />
            </svg>
          )}
          {avStyle === 'facet' && (
            <svg viewBox="0 0 100 100" fill="none" stroke={stroke} strokeWidth={2.5}>
              <path d="M50 6L90 50 50 94 10 50z" />
              <path d="M50 26L74 50 50 74 26 50z" />
            </svg>
          )}
          {avStyle === 'dots' && (
            <svg viewBox="0 0 100 100" fill={stroke}>
              {[22, 50, 78].flatMap((y) => [22, 50, 78].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={4} />))}
            </svg>
          )}
          <span className="mono">{initials}</span>
        </>
      )}
    </span>
  );
}
