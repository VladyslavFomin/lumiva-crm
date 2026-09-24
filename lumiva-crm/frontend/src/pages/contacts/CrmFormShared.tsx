// src/pages/contacts/CrmFormShared.tsx
// Общие UI-примитивы для страниц карточки контакта/компании (портировано из
// Claude Design components/crm-forms-shared.jsx). Используется вместе с
// ../contacts/crm-forms-design.css (класс .px-scope на корне страницы).
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import type { Company } from '../../api/companies';
import type { StaffUser } from '../../api/staff';
import { cl, initials, Ic, LIC, Chk } from './CrmListShared';

export const F: React.FC<{
  label: string;
  req?: boolean;
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}> = ({ label, req, hint, wide, children }) => (
  <div className={cl('cf-f', wide && 'wide')}>
    <label>
      {label}
      {req && <span className="req"> *</span>}
    </label>
    {children}
    {hint && <div className="hint">{hint}</div>}
  </div>
);

export const In: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input className={cl('cf-in', props.className)} {...props} />
);
export const Ta: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
  <textarea className={cl('cf-in', props.className)} {...props} />
);

export const Sel: React.FC<
  {
    options: Array<string | [string, string]>;
    placeholder?: string;
  } & React.SelectHTMLAttributes<HTMLSelectElement>
> = ({ options, placeholder, ...p }) => (
  <select className="cf-in" {...p}>
    {placeholder && <option value="">{placeholder}</option>}
    {options.map((o) =>
      typeof o === 'string' ? (
        <option key={o} value={o}>
          {o}
        </option>
      ) : (
        <option key={o[0]} value={o[0]}>
          {o[1]}
        </option>
      ),
    )}
  </select>
);

export const Card: React.FC<{
  icon?: React.ReactNode;
  title?: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  foot?: React.ReactNode;
  soft?: boolean;
}> = ({ icon, title, sub, right, children, foot, soft }) => (
  <div className={cl('cf-card', soft && 'soft')}>
    {(title || right) && (
      <div className="cf-card-h">
        <div>
          <h3>
            {icon && <Ic d={icon} size={15} />}
            {title}
          </h3>
          {sub && <div className="sub">{sub}</div>}
        </div>
        {right}
      </div>
    )}
    {children}
    {foot && <div className="cf-foot">{foot}</div>}
  </div>
);

export const SideCard: React.FC<{ title: string; right?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  right,
  children,
}) => (
  <div className="cf-card soft">
    <div className="cf-body">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="cf-side-t">{title}</div>
        {right}
      </div>
      {children}
    </div>
  </div>
);

export interface TabDef {
  id: string;
  l: string;
  n?: number;
}

export const Tabs: React.FC<{ tabs: TabDef[]; v: string; set: (id: string) => void; locked?: boolean }> = ({
  tabs,
  v,
  set,
  locked,
}) => {
  const { t } = useTranslation();
  return (
    <div className="cf-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={cl('cf-tab', v === tab.id && 'on')}
          onClick={() => set(tab.id)}
          disabled={locked && tab.id !== tabs[0].id}
          title={locked && tab.id !== tabs[0].id ? t('crm.crmShared.tabs.lockedHint') : undefined}
        >
          {tab.l}
          {tab.n != null && <span className="n">{tab.n}</span>}
        </button>
      ))}
    </div>
  );
};

/** Аналог CompanySelect: поиск + переход к созданию новой компании. */
export const CompanyPick: React.FC<{
  list: Company[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}> = ({ list, value, onChange, placeholder }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const sel = list.find((c) => c.id === value);
  const f = list.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="cf-pick">
      <div className={cl('cf-pick-in', open && 'on')} onClick={() => setOpen(!open)}>
        {sel ? (
          <div className="cl-av sq" style={{ width: 24, height: 24, fontSize: 9.5 }}>
            {initials(sel.name)}
          </div>
        ) : null}
        <span className={cl('nm', !sel && 'ph')}>{sel ? sel.name : placeholder || t('crm.crmShared.companyPick.placeholder')}</span>
        {sel && (
          <button
            type="button"
            className="cl-ib"
            style={{ width: 22, height: 22 }}
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
          >
            <Ic d={LIC.close} size={11} />
          </button>
        )}
        <Ic d={LIC.chev} size={13} className="cl-dash" />
      </div>
      {open && (
        <div className="cf-pop">
          <div className="cf-pop-s">
            <Ic d={LIC.search} size={13} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('crm.crmShared.companyPick.searchPlaceholder')} />
          </div>
          {f.map((c) => (
            <button
              key={c.id}
              type="button"
              className="cf-opt"
              onClick={() => {
                onChange(c.id);
                setOpen(false);
                setQ('');
              }}
            >
              <div className="cl-av sq" style={{ width: 26, height: 26, fontSize: 10 }}>
                {initials(c.name)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="t">{c.name}</div>
                <div className="d">
                  {industryLabel(t, c.industry) || '—'} · {c.city || '—'}
                </div>
              </div>
            </button>
          ))}
          {f.length === 0 && (
            <div style={{ padding: '8px 9px', fontSize: 11.5, color: 'var(--fg-3)' }}>{t('crm.crmShared.companyPick.notFound')}</div>
          )}
        </div>
      )}
    </div>
  );
};

/** Ответственные, сгруппированные по отделам (мультивыбор + «весь отдел»). */
export const DeptAssignees: React.FC<{
  staff: StaffUser[];
  picked: string[];
  setPicked: (ids: string[]) => void;
}> = ({ staff, picked, setPicked }) => {
  const { t } = useTranslation();
  const noDept = t('crm.crmShared.deptAssignees.noDepartment');
  const groups = React.useMemo(() => {
    const map = new Map<string, StaffUser[]>();
    staff.forEach((u) => {
      const dept = u.department || noDept;
      map.set(dept, [...(map.get(dept) || []), u]);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ru'));
  }, [staff, noDept]);

  const names = staff.filter((u) => picked.includes(u.id)).map((u) => u.fullName || u.email);
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);

  return (
    <>
      <div style={{ maxHeight: 250, overflowY: 'auto', paddingRight: 2 }}>
        {groups.map(([dept, users]) => {
          const ids = users.map((u) => u.id);
          const n = ids.filter((i) => picked.includes(i)).length;
          const all = n > 0 && n === ids.length;
          const toggleAll = () => setPicked(all ? picked.filter((x) => !ids.includes(x)) : [...new Set([...picked, ...ids])]);
          return (
            <div key={dept} className="cf-dept">
              <div className="cf-dept-h">
                <span className="t">{dept}</span>
                <span className="all" onClick={toggleAll} role="button">
                  <Chk on={all} ind={!all && n > 0} onClick={toggleAll} />
                  {t('crm.crmShared.deptAssignees.wholeDept')}
                </span>
              </div>
              {users.map((u) => (
                <div key={u.id} className="cf-user" onClick={() => toggle(u.id)} role="button">
                  <Chk on={picked.includes(u.id)} onClick={() => toggle(u.id)} />
                  {u.fullName || u.email}
                </div>
              ))}
            </div>
          );
        })}
        {groups.length === 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{t('crm.crmShared.deptAssignees.noStaff')}</div>
        )}
      </div>
      {names.length > 0 && <div className="cf-picked">{names.join(', ')}</div>}
    </>
  );
};

export const Metrics: React.FC<{ items: Array<[string, React.ReactNode, string]> }> = ({ items }) => (
  <div className="cf-metrics">
    {items.map(([k, v, d]) => (
      <div key={k} className="cf-metric">
        <div className="k">{k}</div>
        <div className="v">{v}</div>
        <div className="d">{d}</div>
      </div>
    ))}
  </div>
);

export const Empty: React.FC<{ title: string; desc: string; action?: React.ReactNode }> = ({ title, desc, action }) => (
  <div className="cf-empty">
    <div className="t">{title}</div>
    <div className="d">{desc}</div>
    {action}
  </div>
);

export type TFunc = (key: string) => string;

/**
 * Отрасль компании хранится в БД строкой. Каноничное значение — русская метка (так исторически
 * сохранены данные, по ней же группируют аналитика/экспорт/мобильное приложение), а на экране
 * отрасль всегда показывается переведённой по ключу — независимо от языка, на котором её выбрали.
 */
const INDUSTRY_DEFS: Array<[string, string]> = [
  ['finance', 'Финансы'],
  ['investments', 'Инвестиции'],
  ['realEstate', 'Недвижимость'],
  ['it', 'IT / Технологии'],
  ['consulting', 'Консалтинг'],
  ['trade', 'Торговля'],
  ['manufacturing', 'Производство'],
  ['logistics', 'Логистика'],
  ['education', 'Образование'],
  ['medicine', 'Медицина'],
  ['legal', 'Юридические услуги'],
  ['other', 'Другое'],
];
const INDUSTRY_KEY_PREFIX = 'crm.crmShared.industries.';

/** Ключ отрасли по сохранённому значению: русская/английская/турецкая метка или буквальный i18n-ключ. */
const industryKeyOf = (value?: string | null): string | null => {
  const v = (value || '').trim();
  if (!v) return null;
  if (v.startsWith(INDUSTRY_KEY_PREFIX)) {
    const k = v.slice(INDUSTRY_KEY_PREFIX.length);
    return INDUSTRY_DEFS.some(([key]) => key === k) ? k : null;
  }
  const low = v.toLowerCase();
  for (const [key, ru] of INDUSTRY_DEFS) {
    if (ru.toLowerCase() === low || INDUSTRY_KEY_PREFIX + key === v) return key;
    for (const lng of ['en', 'tr']) {
      const label = i18n.getFixedT(lng)(INDUSTRY_KEY_PREFIX + key);
      if (label && label.toLowerCase() === low) return key;
    }
  }
  return null;
};

/** Приводит значение к каноничному (русская метка); неизвестный/введённый вручную текст не трогает. */
export const normalizeIndustry = (value?: string | null): string => {
  const key = industryKeyOf(value);
  if (!key) return (value || '').trim();
  return INDUSTRY_DEFS.find(([k]) => k === key)![1];
};

/** Отображаемое название отрасли на текущем языке интерфейса. */
export const industryLabel = (t: TFunc, value?: string | null): string => {
  const key = industryKeyOf(value);
  return key ? t(INDUSTRY_KEY_PREFIX + key) : (value || '').trim();
};

/** Опции селекта: [каноничное значение, переведённая метка]. */
export const INDUSTRIES_F = (t: TFunc): Array<[string, string]> =>
  INDUSTRY_DEFS.map(([key, ru]) => [ru, t(INDUSTRY_KEY_PREFIX + key)]);
export const SIZES_F = (t: TFunc): Array<[string, string]> => [
  ['1-10', t('crm.companies.form.sizeOptions.1-10')],
  ['11-50', t('crm.companies.form.sizeOptions.11-50')],
  ['51-200', t('crm.companies.form.sizeOptions.51-200')],
  ['201-500', t('crm.companies.form.sizeOptions.201-500')],
  ['500+', t('crm.companies.form.sizeOptions.500+')],
];
export const STATUSES_F = (t: TFunc): Array<[string, string]> => [
  ['active', t('crm.companies.form.statuses.active')],
  ['inactive', t('crm.companies.form.statuses.inactive')],
  ['archived', t('crm.companies.form.statuses.archived')],
];
export const COUNTRIES_F: Array<[string, string]> = [
  ['TR', 'Turkey'],
  ['RU', 'Russia'],
  ['US', 'United States'],
  ['GB', 'United Kingdom'],
  ['DE', 'Germany'],
  ['FR', 'France'],
  ['AE', 'UAE'],
  ['KZ', 'Kazakhstan'],
  ['AZ', 'Azerbaijan'],
  ['UZ', 'Uzbekistan'],
];
