/* Lumiva Crew — иллюстрированные анимированные персонажи ИИ-сотрудников (SVG).
 * Портировано из Claude Design (ai-employees-v3.html, components/aie3-people.jsx). Персонаж
 * определяется ролью; роли, которых не было в макете (seo/reviews/chat/messenger), дорисованы
 * в той же системе. Анимации — в ai-employees-v3.css (.ch.live …). */
import React, { useId, useRef } from 'react';
import './ai-characters.css';

type Palette = { bg: string; d: string };
type CharDef = {
  skin: string;
  hair: 'pomp' | 'bun' | 'afro' | 'long' | 'bob' | 'short' | 'quiff' | 'buns2';
  hc: string;
  hs: string;
  glasses?: 'round';
  lens?: [string, string];
  headset?: boolean;
  visor?: boolean;
  beard?: boolean;
  stache?: boolean;
  suit: [string, string];
  collar: string;
  item: 'clip' | 'tablet' | 'phone';
};

export type AiMood = 'on' | 'pause' | 'setup' | 'idle';

export const AI_ROLE_PALETTE: Record<string, Palette> = {
  lead_manager: { bg: '#ffe1d2', d: '#ff6a33' },
  sales_manager: { bg: '#d3f1df', d: '#1f9d63' },
  marketing_manager: { bg: '#ffe8c4', d: '#ef8600' },
  support_manager: { bg: '#fff0b3', d: '#cf9b00' },
  project_manager: { bg: '#ccecee', d: '#10979a' },
  email_assistant: { bg: '#e7dffe', d: '#7457f2' },
  marketing_analyst: { bg: '#dbe5ff', d: '#3a6ff0' },
  smm_manager: { bg: '#ffd7ea', d: '#e2458f' },
  crm_analyst: { bg: '#e3e6ee', d: '#56627a' },
  reservation_assistant: { bg: '#e6f4c2', d: '#6f9a0c' },
  seo_manager: { bg: '#dff4e6', d: '#2e9e66' },
  reviews_manager: { bg: '#ffdcdc', d: '#e04848' },
  chat_operator: { bg: '#d6f1ff', d: '#2a9fd6' },
  messenger_operator: { bg: '#dcf6df', d: '#2fae4a' },
};

const CHARS: Record<string, CharDef> = {
  lead_manager: { skin: '#f0b48e', hair: 'pomp', hc: '#f3eee4', hs: '#d6cdbd', glasses: 'round', lens: ['#b06cff', '#ff5fa8'], headset: true, suit: ['#ff9447', '#e2601b'], collar: '#4a8be0', item: 'clip' },
  sales_manager: { skin: '#8a5a3e', hair: 'bun', hc: '#221b1d', hs: '#3a2e2f', suit: ['#33bb80', '#178a56'], collar: '#f4f1ea', item: 'tablet' },
  marketing_analyst: { skin: '#a8694a', hair: 'afro', hc: '#221b1d', hs: '#3b2d2c', visor: true, suit: ['#ffc847', '#e49a0c'], collar: '#4a8be0', item: 'tablet' },
  support_manager: { skin: '#f6d0b5', hair: 'long', hc: '#ff7fb3', hs: '#e45a95', headset: true, suit: ['#86b7ff', '#4a83e6'], collar: '#ffd166', item: 'phone' },
  email_assistant: { skin: '#f2c1a0', hair: 'bob', hc: '#1f1b1d', hs: '#3a3134', glasses: 'round', lens: ['#6fe0ff', '#7a8cff'], suit: ['#b39aff', '#7b5cf0'], collar: '#ff8fb8', item: 'clip' },
  project_manager: { skin: '#d99a72', hair: 'short', hc: '#4a3022', hs: '#6a4632', beard: true, suit: ['#3cc9c6', '#12989a'], collar: '#ff8a3d', item: 'clip' },
  marketing_manager: { skin: '#f2c1a0', hair: 'quiff', hc: '#d9692b', hs: '#b54f1a', suit: ['#ffa64d', '#e07b12'], collar: '#4a8be0', item: 'phone' },
  smm_manager: { skin: '#d99a72', hair: 'buns2', hc: '#3a2a24', hs: '#5a4036', visor: true, suit: ['#ff8cc0', '#e14c90'], collar: '#ffd166', item: 'phone' },
  crm_analyst: { skin: '#e8b892', hair: 'short', hc: '#b9bec7', hs: '#9aa0ab', glasses: 'round', lens: ['#e9f1ff', '#c9d6ee'], stache: true, suit: ['#97a3b9', '#5c6880'], collar: '#ffc23d', item: 'tablet' },
  reservation_assistant: { skin: '#a8694a', hair: 'short', hc: '#1f1b1d', hs: '#3a3134', stache: true, headset: true, suit: ['#bfe055', '#86ad1f'], collar: '#4a8be0', item: 'clip' },
  seo_manager: { skin: '#e8b892', hair: 'quiff', hc: '#2a2224', hs: '#463a3c', glasses: 'round', lens: ['#9fdc3c', '#5fd0ff'], suit: ['#7fd6a4', '#2e9e66'], collar: '#ffd166', item: 'tablet' },
  reviews_manager: { skin: '#f6d0b5', hair: 'bob', hc: '#7a3b22', hs: '#5a2a16', suit: ['#ff8a8a', '#e04848'], collar: '#ffd166', item: 'phone' },
  chat_operator: { skin: '#c98a64', hair: 'long', hc: '#2a1d1a', hs: '#3a2a24', headset: true, suit: ['#6fd3ff', '#2a9fd6'], collar: '#ff8fb8', item: 'clip' },
  messenger_operator: { skin: '#f0b48e', hair: 'short', hc: '#5a3a24', hs: '#7a5236', headset: true, suit: ['#7ee08a', '#2fae4a'], collar: '#4a8be0', item: 'phone' },
};

export function AiCharacter({ role = 'lead_manager', mood = 'on' }: { role?: string; mood?: AiMood }) {
  const c = CHARS[role] || CHARS.lead_manager;
  const id = 'ch' + useId().replace(/:/g, '');
  const sleep = mood === 'pause';
  const dl = `${(role.length * 0.53) % 2.5}s`;
  const capFront: Record<CharDef['hair'], React.ReactNode> = {
    pomp: (
      <>
        <path d="M70 92C58 50 86 24 118 27c30 3 40 30 24 44-6-10-22-15-38-11-14 4-23 15-26 32z" fill={c.hc} stroke={c.hs} strokeWidth="1.5" />
        <path d="M80 70c6-16 22-26 44-24" stroke={c.hs} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M92 40c12-8 32-8 42 2" stroke="#fff" strokeOpacity=".6" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M72 90c-2-12 2-22 8-28" stroke={c.hs} strokeWidth="3" fill="none" strokeLinecap="round" />
      </>
    ),
    bun: <path d="M71 96C66 62 84 50 100 50c18 0 34 12 29 46-3-18-13-28-29-29-16 1-26 11-29 29z" fill={c.hc} />,
    afro: <path d="M72 92c-2-22 10-34 28-34s30 12 28 34c-6-14-16-20-28-20s-22 6-28 20z" fill={c.hc} />,
    long: <path d="M70 104C64 64 82 50 100 50c20 0 36 14 30 54-4-20-12-30-22-34-10 8-26 10-38 34z" fill={c.hc} />,
    bob: <path d="M68 114C60 66 80 48 100 48c22 0 42 18 32 66h-6c2-18-1-30-8-38-10 6-28 8-40 0-6 8-8 20-6 38z" fill={c.hc} />,
    short: <path d="M72 92C70 62 86 54 100 54c16 0 30 8 28 38-4-14-14-20-28-20s-24 6-28 20z" fill={c.hc} />,
    quiff: (
      <>
        <path d="M72 92C70 62 86 54 100 54c16 0 30 8 28 38-4-14-14-20-28-20s-24 6-28 20z" fill={c.hc} />
        <path d="M86 62c2-22 30-28 42-12-10-2-22 2-30 14z" fill={c.hc} />
        <path d="M96 52c8-6 18-6 26-2" stroke="#fff" strokeOpacity=".35" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </>
    ),
    buns2: <path d="M71 96C66 62 84 50 100 50c18 0 34 12 29 46-3-18-13-28-29-29-16 1-26 11-29 29z" fill={c.hc} />,
  };
  const capBack: Partial<Record<CharDef['hair'], React.ReactNode>> = {
    bun: (
      <>
        <circle cx="100" cy="46" r="15" fill={c.hc} />
        <path d="M92 40a10 10 0 0 1 12-4" stroke="#fff" strokeOpacity=".25" strokeWidth="2.5" fill="none" />
      </>
    ),
    afro: <circle cx="100" cy="76" r="47" fill={c.hc} />,
    long: <path d="M66 90c-6 50-4 80 6 98h56c10-18 12-48 6-98z" fill={c.hs} />,
    buns2: (
      <>
        <circle cx="70" cy="60" r="13" fill={c.hc} />
        <circle cx="130" cy="60" r="13" fill={c.hc} />
      </>
    ),
  };
  const lens = c.lens || ['#fff', '#fff'];
  return (
    <svg
      className={'ch' + (mood === 'on' ? ' live' : '') + (sleep ? ' sleep' : '')}
      viewBox="0 0 200 240"
      preserveAspectRatio="xMidYMax meet"
      style={{ '--dl': dl } as React.CSSProperties}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id + 's'} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c.suit[0]} />
          <stop offset="1" stopColor={c.suit[1]} />
        </linearGradient>
        <radialGradient id={id + 'k'} cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor="#fff" stopOpacity=".28" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id + 'l'} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={lens[0]} />
          <stop offset="1" stopColor={lens[1]} />
        </linearGradient>
        <linearGradient id={id + 'v'} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ff5fa8" />
          <stop offset=".5" stopColor="#ff9a5a" />
          <stop offset="1" stopColor="#5fd0ff" />
        </linearGradient>
        <linearGradient id={id + 'c'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.collar} />
          <stop offset="1" stopColor={c.collar} stopOpacity=".75" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="238" rx="80" ry="6" fill="#000" opacity=".06" />
      <g className="ch-body">
        {c.hair === 'long' && <g className="ch-hair">{capBack.long}</g>}
        <circle cx="50" cy="182" r="32" fill={`url(#${id}s)`} />
        <circle cx="150" cy="182" r="32" fill={`url(#${id}s)`} />
        <path d="M22 240c0-44 12-70 40-80 12-5 24-8 38-8s26 3 38 8c28 10 40 36 40 80z" fill={`url(#${id}s)`} />
        <path d="M22 240c0-44 12-70 40-80 12-5 24-8 38-8s26 3 38 8c28 10 40 36 40 80z" fill={`url(#${id}k)`} />
        <path d="M84 154l16 44 16-44z" fill="#f3efe7" />
        <path d="M100 198v42" stroke={c.suit[1]} strokeWidth="2" />
        <g stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".9">
          <path d="M30 178l16-11" />
          <path d="M36 186l16-11" />
          <path d="M170 178l-16-11" />
          <path d="M164 186l-16-11" />
        </g>
        <path d="M152 204l14-3 4 12-9 9-10-6z" fill={c.collar} opacity=".9" />
        <path d="M155 208l10-2" stroke="#fff" strokeWidth="1.5" />
        <rect x="66" y="208" width="14" height="3" rx="1.5" fill={c.collar} />
        <g className="ch-head">
          {c.hair !== 'long' && <g className="ch-hair">{capBack[c.hair]}</g>}
          <path d="M89 112h22v40H89z" fill={c.skin} />
          <path d="M89 112h22v14c-8 5-14 5-22 0z" fill="#000" opacity=".12" />
          <ellipse cx="100" cy="153" rx="40" ry="10" fill="none" stroke={`url(#${id}c)`} strokeWidth="9" />
          <ellipse cx="73" cy="94" rx="4.5" ry="7" fill={c.skin} />
          <ellipse cx="127" cy="94" rx="4.5" ry="7" fill={c.skin} />
          <ellipse cx="100" cy="89" rx="27" ry="33" fill={c.skin} />
          <ellipse cx="100" cy="89" rx="27" ry="33" fill={`url(#${id}k)`} />
          {c.beard && <path d="M74 98c2 24 14 32 26 32s24-8 26-32c-6 13-14 16-26 16s-20-3-26-16z" fill={c.hc} />}
          <g className="ch-face">
            {sleep ? (
              <g stroke="#2a1d1a" strokeWidth="2" strokeLinecap="round" fill="none">
                <path d="M85 93q4 3 8 0" />
                <path d="M107 93q4 3 8 0" />
              </g>
            ) : (
              <g className="ch-eyes" fill="#2a1d1a">
                <ellipse cx="89" cy="92" rx="2.7" ry="3.3" />
                <ellipse cx="111" cy="92" rx="2.7" ry="3.3" />
                <circle cx="90" cy="90.8" r=".9" fill="#fff" />
                <circle cx="112" cy="90.8" r=".9" fill="#fff" />
              </g>
            )}
            <g stroke={c.hs} strokeWidth="2.4" strokeLinecap="round" fill="none">
              <path d="M83 83q6-3 12 0" />
              <path d="M105 83q6-3 12 0" />
            </g>
            <path d="M100 95q-3 8 1 10" stroke="#000" strokeOpacity=".18" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            {c.stache && <path d="M89 108q11-7 22 0q-11 3-22 0z" fill={c.hc} />}
            <path d={sleep ? 'M95 111q5 1 10 0' : 'M93 109q7 5 14 0'} stroke="#a8473d" strokeWidth="2" fill="none" strokeLinecap="round" />
            <circle cx="83" cy="103" r="4.5" fill="#ff7f6a" opacity=".28" />
            <circle cx="117" cy="103" r="4.5" fill="#ff7f6a" opacity=".28" />
          </g>
          <g className="ch-hair">{capFront[c.hair]}</g>
          {c.glasses && (
            <g>
              <circle cx="89" cy="92" r="8.5" fill={`url(#${id}l)`} opacity=".88" stroke="#efe9f3" strokeWidth="1.6" />
              <circle cx="111" cy="92" r="8.5" fill={`url(#${id}l)`} opacity=".88" stroke="#efe9f3" strokeWidth="1.6" />
              <path d="M97.5 92h5" stroke="#efe9f3" strokeWidth="1.6" />
              <path className="ch-shine" d="M84 88l5-4M106 88l5-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
            </g>
          )}
          {c.visor && (
            <g>
              <rect x="75" y="84" width="50" height="15" rx="7.5" fill={`url(#${id}v)`} stroke="#fff" strokeOpacity=".7" strokeWidth="1.2" />
              <rect className="ch-shine" x="80" y="87" width="18" height="3" rx="1.5" fill="#fff" opacity=".7" />
            </g>
          )}
          {c.headset && (
            <g>
              <path d="M69 94C66 52 134 52 131 94" stroke="#2b5aa3" strokeWidth="4.5" fill="none" strokeLinecap="round" />
              <rect x="63" y="85" width="10" height="19" rx="5" fill="#3b74c9" />
              <rect x="127" y="85" width="10" height="19" rx="5" fill="#3b74c9" />
              <path d="M68 102c1 12 10 15 20 12" stroke="#2b5aa3" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <circle className="ch-led" cx="89" cy="113.5" r="2.4" fill="#9fdc3c" />
            </g>
          )}
        </g>
        {c.item === 'clip' && (
          <g className="ch-item">
            <g transform="rotate(-14 138 210)">
              <rect x="112" y="180" width="54" height="68" rx="4" fill="#2c58a6" />
              <rect x="114" y="182" width="50" height="64" rx="3" fill="none" stroke="#fff" strokeOpacity=".18" />
              <rect x="129" y="175" width="20" height="9" rx="2" fill="#d8c6a2" />
              <path d="M122 198h22M122 206h30M122 214h18" stroke="#fff" strokeOpacity=".35" strokeWidth="2" strokeLinecap="round" />
            </g>
            <ellipse cx="121" cy="216" rx="10" ry="8" fill={c.skin} />
            <path d="M104 222c4-8 10-12 18-12" stroke={c.suit[1]} strokeWidth="9" strokeLinecap="round" fill="none" />
          </g>
        )}
        {c.item === 'tablet' && (
          <g className="ch-item">
            <g transform="rotate(10 70 206)">
              <rect x="42" y="184" width="60" height="44" rx="6" fill="#1d2230" />
              <rect x="46" y="188" width="52" height="36" rx="3" fill="#2b3448" />
              <g fill="#9fdc3c">
                <rect x="52" y="210" width="6" height="9" rx="1" />
                <rect x="62" y="204" width="6" height="15" rx="1" />
                <rect x="72" y="198" width="6" height="21" rx="1" />
                <rect x="82" y="206" width="6" height="13" rx="1" fill="#6ea8ff" />
              </g>
            </g>
            <ellipse cx="94" cy="222" rx="10" ry="8" fill={c.skin} />
          </g>
        )}
        {c.item === 'phone' && (
          <g className="ch-item">
            <g transform="rotate(-8 140 204)">
              <rect x="128" y="182" width="24" height="42" rx="5" fill="#1d2230" />
              <rect x="131" y="186" width="18" height="33" rx="2.5" fill="#3a4766" />
              <circle cx="140" cy="198" r="5" fill="#ff7fb3" opacity=".8" />
            </g>
            <ellipse cx="134" cy="216" rx="9" ry="7.5" fill={c.skin} />
          </g>
        )}
      </g>
      {sleep && (
        <text className="ch-z" x="140" y="54" fontSize="16" fontWeight="700" fill="#8a8a95" fontFamily="sans-serif">
          z
        </text>
      )}
    </svg>
  );
}

/** Портрет: цветной фон роли + персонаж с лёгким параллаксом за курсором. */
export function AiPortrait({
  role,
  mood = 'on',
  height = 230,
  children,
  className,
}: {
  role: string;
  mood?: AiMood;
  height?: number;
  children?: React.ReactNode;
  className?: string;
}) {
  const p = AI_ROLE_PALETTE[role] || AI_ROLE_PALETTE.lead_manager;
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--px', `${((e.clientX - r.left) / r.width - 0.5) * 10}px`);
    el.style.setProperty('--py', `${((e.clientY - r.top) / r.height - 0.5) * 6}px`);
  };
  const out = () => {
    ref.current?.style.setProperty('--px', '0px');
    ref.current?.style.setProperty('--py', '0px');
  };
  return (
    <div
      ref={ref}
      className={'e3-por m-' + mood + (className ? ' ' + className : '')}
      style={{ '--pbg': p.bg, '--pd': p.d, height } as React.CSSProperties}
      onMouseMove={move}
      onMouseLeave={out}
    >
      <div className="e3-por-bg">
        <span className="e3-por-orb" />
      </div>
      <div className="e3-por-fig">
        <AiCharacter role={role} mood={mood} />
      </div>
      {children}
    </div>
  );
}

/** Маленький аватар: голова персонажа в круге. */
export function AiCharacterMono({ role, size = 32 }: { role: string; size?: number }) {
  const p = AI_ROLE_PALETTE[role] || AI_ROLE_PALETTE.lead_manager;
  return (
    <span className="e3-mono" style={{ width: size, height: size, background: p.bg }}>
      <AiCharacter role={role} mood="idle" />
    </span>
  );
}

export function moodForStatus(status: string): AiMood {
  if (status === 'active') return 'on';
  if (status === 'paused' || status === 'disabled') return 'pause';
  return 'setup';
}
