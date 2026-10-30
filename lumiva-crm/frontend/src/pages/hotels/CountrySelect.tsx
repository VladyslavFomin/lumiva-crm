import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COUNTRY_GROUPS, countryFlag, countryName, countryOptions, POPULAR_COUNTRIES } from '../../utils/countries';

const fieldStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 36,
  padding: '7px 10px',
  border: '1px solid var(--line-2)',
  borderRadius: 8,
  fontSize: 12.5,
  background: '#fff',
  textAlign: 'left',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexWrap: 'wrap',
};

function usePopup() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  return { open, setOpen, ref };
}

const List: React.FC<{
  lang: string;
  query: string;
  selected: Set<string>;
  onPick: (code: string) => void;
}> = ({ lang, query, selected, onPick }) => {
  const options = useMemo(() => countryOptions(lang), [lang]);
  const q = query.trim().toLowerCase();
  const list = q ? options.filter((o) => o.name.toLowerCase().includes(q) || o.code.toLowerCase() === q) : options;
  return (
    <div className="htl-cs-list">
      {list.map((o, i) => (
        <React.Fragment key={o.code}>
          {!q && i === POPULAR_COUNTRIES.length && <div className="htl-cs-sep" />}
          <button type="button" className={`htl-cs-opt${selected.has(o.code) ? ' on' : ''}`} onClick={() => onPick(o.code)}>
            <span>{countryFlag(o.code)}</span>
            <span className="nm">{o.name}</span>
            <span className="cd">{o.code}</span>
          </button>
        </React.Fragment>
      ))}
      {!list.length && <div className="htl-cs-empty">—</div>}
    </div>
  );
};

/** Одна страна (ISO alpha-2) с поиском по названию на языке интерфейса. */
export const CountrySelect: React.FC<{
  value: string | null | undefined;
  onChange: (code: string | null) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'ru';
  const { open, setOpen, ref } = usePopup();
  const [q, setQ] = useState('');
  return (
    <div className="htl-cs" ref={ref}>
      <button type="button" style={fieldStyle} onClick={() => setOpen(!open)}>
        {value ? (
          <>
            <span>{countryFlag(value)}</span>
            <span style={{ flex: 1 }}>{countryName(value, lang)}</span>
          </>
        ) : (
          <span style={{ color: 'var(--fg-4)', flex: 1 }}>{placeholder || t('crm.hotels.countries.pick')}</span>
        )}
        {value && (
          <span
            role="button"
            className="htl-cs-x"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
          >
            ×
          </span>
        )}
      </button>
      {open && (
        <div className="htl-cs-pop">
          <input autoFocus className="htl-cs-search" placeholder={t('crm.hotels.countries.search')} value={q} onChange={(e) => setQ(e.target.value)} />
          <List
            lang={lang}
            query={q}
            selected={new Set(value ? [value] : [])}
            onPick={(c) => {
              onChange(c);
              setOpen(false);
              setQ('');
            }}
          />
        </div>
      )}
    </div>
  );
};

/** Несколько стран + готовые наборы (СНГ, DACH, Бенилюкс…). */
export const CountryMultiSelect: React.FC<{
  value: string[];
  onChange: (codes: string[]) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'ru';
  const { open, setOpen, ref } = usePopup();
  const [q, setQ] = useState('');
  const set = new Set(value);
  const toggle = (c: string) => onChange(set.has(c) ? value.filter((x) => x !== c) : [...value, c]);
  return (
    <div className="htl-cs" ref={ref}>
      <div style={fieldStyle} onClick={() => setOpen(true)}>
        {value.length === 0 && <span style={{ color: 'var(--fg-4)' }}>{placeholder || t('crm.hotels.countries.pickMany')}</span>}
        {value.map((c) => (
          <span key={c} className="htl-cs-chip">
            {countryFlag(c)} {countryName(c, lang)}
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle(c);
              }}
            >
              ×
            </span>
          </span>
        ))}
      </div>
      {open && (
        <div className="htl-cs-pop">
          <div className="htl-cs-groups">
            {Object.entries(COUNTRY_GROUPS).map(([k, codes]) => (
              <button key={k} type="button" onClick={() => onChange([...new Set([...value, ...codes])])}>
                + {t(`crm.hotels.countries.groups.${k}`)}
              </button>
            ))}
            {value.length > 0 && (
              <button type="button" onClick={() => onChange([])}>
                {t('crm.hotels.countries.clear')}
              </button>
            )}
          </div>
          <input autoFocus className="htl-cs-search" placeholder={t('crm.hotels.countries.search')} value={q} onChange={(e) => setQ(e.target.value)} />
          <List lang={lang} query={q} selected={set} onPick={toggle} />
        </div>
      )}
    </div>
  );
};

/** Флаг + название (для таблиц). */
export const CountryTag: React.FC<{ code: string | null | undefined; empty?: string }> = ({ code, empty = '—' }) => {
  const { i18n } = useTranslation();
  if (!code) return <span style={{ color: 'var(--fg-4)' }}>{empty}</span>;
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      {countryFlag(code)} {countryName(code, i18n.language || 'ru')}
    </span>
  );
};
