// src/pages/contacts/CrmListShared.tsx
// Общие UI-примитивы для редизайна страниц "Контакты" и "Компании" (портировано из
// Claude Design components/crm-lists-shared.jsx). Используется вместе с ../contacts/crm-lists-design.css
// (класс .px-scope на корне страницы).
import { AiAssigneeChips } from '../../components/ai/AiAssigneeChips';
import type { AiAssignee } from '../../api/aiEmployees';
import React from 'react';
import { useTranslation } from 'react-i18next';

export const cl = (...a: Array<string | false | null | undefined>): string => a.filter(Boolean).join(' ');

export const initials = (n: string): string =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export const money = (n: number): string => n.toLocaleString('ru-RU');

/**
 * Лиды/проекты у одной компании или контакта могут быть в разных валютах (currency
 * задаётся per-lead/per-project, а не тенантом целиком) — суммировать их напрямую в одно
 * число некорректно (см. баг: "222 ₺" на самом деле было 222 EUR + 0 TRY). Группируем по
 * валюте и показываем каждую сумму со своим кодом валюты вместо одного смешанного числа.
 */
export const sumByCurrency = <T,>(
  items: T[],
  amountOf: (item: T) => number,
  currencyOf: (item: T) => string,
): Record<string, number> => {
  const map: Record<string, number> = {};
  items.forEach((item) => {
    const cur = currencyOf(item) || '—';
    map[cur] = (map[cur] || 0) + (Number(amountOf(item)) || 0);
  });
  return map;
};

export const mergeByCurrency = (
  ...maps: Array<Record<string, number> | null | undefined>
): Record<string, number> => {
  const out: Record<string, number> = {};
  maps.forEach((m) => {
    if (!m) return;
    Object.entries(m).forEach(([cur, v]) => {
      out[cur] = (out[cur] || 0) + v;
    });
  });
  return out;
};

export const fmtByCurrency = (byCur: Record<string, number> | null | undefined): string => {
  if (!byCur) return '0';
  const entries = Object.entries(byCur).filter(([, v]) => v !== 0);
  if (entries.length === 0) return '0';
  return entries
    .sort((a, b) => b[1] - a[1])
    .map(([cur, v]) => `${money(v)} ${cur}`)
    .join(' + ');
};

export const Ic: React.FC<{
  d: React.ReactNode;
  size?: number;
  sw?: number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ d, size = 16, sw = 1.6, className, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
    style={style}
  >
    {d}
  </svg>
);

export const LIC = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  import: (
    <>
      <path d="M12 16V4" />
      <path d="M8 8l4-4 4 4" />
      <path d="M4 20h16" />
    </>
  ),
  dl: (
    <>
      <path d="M12 4v11" />
      <path d="M8 11l4 4 4-4" />
      <path d="M4 20h16" />
    </>
  ),
  chev: <path d="M6 9l6 6 6-6" />,
  chevR: <path d="M9 6l6 6-6 6" />,
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  check: <path d="M4 12l5 5L20 6" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 14h10l1-14" />
    </>
  ),
  pen: (
    <>
      <path d="M4 20h4l11-11-4-4L4 16z" />
      <path d="M14 6l4 4" />
    </>
  ),
  table: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 9v11" />
    </>
  ),
  cards: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </>
  ),
  merge: (
    <>
      <path d="M6 3v6a6 6 0 006 6h6" />
      <path d="M18 3v6" />
      <path d="M15 12l3 3-3 3" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20c0-4 3-7 7-7s7 3 7 7" />
      <path d="M16 4.5a3.5 3.5 0 010 7" />
    </>
  ),
  bolt: <path d="M13 2L5 14h6l-1 8 8-12h-6z" />,
  note: (
    <>
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </>
  ),
};

export const Chk: React.FC<{ on?: boolean; ind?: boolean; onClick: () => void }> = ({ on, ind, onClick }) => (
  <button
    type="button"
    className={cl('cl-chk', on && 'on', ind && 'ind')}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    role="checkbox"
    aria-checked={!!on}
  >
    {on && !ind && <Ic d={LIC.check} size={11} sw={2.6} />}
  </button>
);

export const Own: React.FC<{ name?: string | null; ai?: AiAssignee[] | null }> = ({ name, ai }) => {
  const { t } = useTranslation();
  const hasAi = !!ai?.length;
  if (!name && hasAi) {
    return (
      <div className="cl-own" style={{ flexWrap: 'wrap' }}>
        <AiAssigneeChips items={ai} />
      </div>
    );
  }
  return name ? (
    <div className="cl-own" style={hasAi ? { flexWrap: 'wrap' } : undefined}>
      <div className="a">{initials(name)}</div>
      <div className="n">{name}</div>
      {hasAi ? <AiAssigneeChips items={ai} /> : null}
    </div>
  ) : (
    <div className="cl-own none">
      <div className="a">?</div>
      <div className="n" style={{ color: 'var(--fg-4)' }}>
        {t('crm.crmShared.notAssigned')}
      </div>
    </div>
  );
};

export const Tags: React.FC<{ list?: string[] | null }> = ({ list }) =>
  list && list.length ? (
    <div className="cl-tags">
      {list.slice(0, 3).map((t) => (
        <span key={t} className="cl-tag">
          {t}
        </span>
      ))}
      {list.length > 3 && <span className="cl-tag">+{list.length - 3}</span>}
    </div>
  ) : (
    <span className="cl-dash">—</span>
  );

export const Search: React.FC<{ v: string; set: (v: string) => void; ph: string }> = ({ v, set, ph }) => (
  <div className="cl-search">
    <Ic d={LIC.search} size={14} />
    <input value={v} onChange={(e) => set(e.target.value)} placeholder={ph} />
    {v && (
      <button type="button" className="x" onClick={() => set('')}>
        ×
      </button>
    )}
  </div>
);

export const Seg: React.FC<{
  v: string;
  set: (v: string) => void;
  opts: Array<[string, string, React.ReactNode?]>;
}> = ({ v, set, opts }) => (
  <div className="cl-seg">
    {opts.map(([id, label, icon]) => (
      <button key={id} type="button" className={cl(v === id && 'on')} onClick={() => set(id)}>
        {icon && <Ic d={icon} size={13} />}
        {label}
      </button>
    ))}
  </div>
);

export const Chips: React.FC<{
  v: string;
  set: (v: string) => void;
  opts: Array<[string, string, number?]>;
}> = ({ v, set, opts }) => (
  <div className="cl-chips">
    {opts.map(([id, label, n]) => (
      <button key={id} type="button" className={cl('cl-chip', v === id && 'on')} onClick={() => set(id)}>
        {label}
        {n != null && <span className="n">{n}</span>}
      </button>
    ))}
  </div>
);

export const Drawer: React.FC<{
  title: React.ReactNode;
  sub?: React.ReactNode;
  badge?: React.ReactNode;
  onClose: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, sub, badge, onClose, actions, children }) => (
  <>
    <div className="cl-dr-bd" onClick={onClose} />
    <aside className="cl-dr">
      <div className="cl-dr-h">
        <div style={{ minWidth: 0 }}>
          <div className="t">{title}</div>
          {sub && <div className="s">{sub}</div>}
          {badge && <div style={{ marginTop: 9 }}>{badge}</div>}
        </div>
        <button type="button" className="cl-ib" onClick={onClose}>
          <Ic d={LIC.close} size={13} />
        </button>
      </div>
      <div className="cl-dr-b">{children}</div>
      {actions && <div className="cl-dr-f">{actions}</div>}
    </aside>
  </>
);

export const KV: React.FC<{ k: string; v?: React.ReactNode; mono?: boolean }> = ({ k, v, mono }) => (
  <div className="cl-kv">
    <span className="k">{k}</span>
    <span className={cl('v', mono && 'mono')}>{v || <span className="cl-dash">—</span>}</span>
  </div>
);

export const Pg: React.FC<{ page: number; pages: number; set: (p: number) => void }> = ({ page, pages, set }) => (
  <div className="cl-pg">
    <button type="button" onClick={() => set(Math.max(1, page - 1))}>
      ‹
    </button>
    {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
      <button key={p} type="button" className={cl(p === page && 'on')} onClick={() => set(p)}>
        {p}
      </button>
    ))}
    <button type="button" onClick={() => set(Math.min(pages, page + 1))}>
      ›
    </button>
  </div>
);
