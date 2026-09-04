import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchLeadsQuick } from '../api/leads';
import { fetchContacts } from '../api/contacts';
import { fetchCompanies } from '../api/companies';
import { fetchProjects } from '../api/projects';
import { fetchSales } from '../api/sales';

export interface CommandPaletteNavItem {
  label: string;
  path: string;
}

interface Row {
  id: string;
  group: string;
  label: string;
  subtitle?: string;
  to: string;
}

const RESULT_LIMIT = 5;

function normalizeLayoutTarget(path: string): string {
  return path.startsWith('/app/') ? path.slice(4) : path;
}

export const CommandPalette: React.FC<{
  open: boolean;
  onClose: () => void;
  navItems: CommandPaletteNavItem[];
}> = ({ open, onClose, navItems }) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [recordRows, setRecordRows] = useState<Row[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const requestSeq = useRef(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setRecordRows([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const navRows: Row[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = q
      ? navItems.filter((n) => n.label.toLowerCase().includes(q))
      : navItems.slice(0, 8);
    return items.slice(0, 8).map((n) => ({
      id: `nav-${n.path}`,
      group: 'Разделы',
      label: n.label,
      to: normalizeLayoutTarget(n.path),
    }));
  }, [query, navItems]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setRecordRows([]);
      setLoading(false);
      return;
    }
    const seq = ++requestSeq.current;
    setLoading(true);
    const timer = window.setTimeout(() => {
      Promise.allSettled([
        searchLeadsQuick(q, RESULT_LIMIT),
        fetchContacts({ search: q, limit: RESULT_LIMIT }),
        fetchCompanies({ search: q, limit: RESULT_LIMIT }),
        fetchProjects({ q }),
        fetchSales({ search: q, pageSize: RESULT_LIMIT }),
      ]).then(([leads, contacts, companies, projects, sales]) => {
        if (requestSeq.current !== seq) return; // ответ на устаревший запрос

        const rows: Row[] = [];

        if (leads.status === 'fulfilled') {
          for (const l of leads.value.slice(0, RESULT_LIMIT)) {
            rows.push({
              id: `lead-${l.id}`,
              group: 'Лиды',
              label: l.name || l.email || l.phone || 'Лид без имени',
              subtitle: l.email || l.phone || undefined,
              to: `/leads/${l.id}`,
            });
          }
        }
        if (contacts.status === 'fulfilled') {
          for (const c of contacts.value.items.slice(0, RESULT_LIMIT)) {
            rows.push({
              id: `contact-${c.id}`,
              group: 'Контакты',
              label: c.fullName || [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || 'Контакт',
              subtitle: c.email || c.phone || undefined,
              to: `/contacts/${c.id}`,
            });
          }
        }
        if (companies.status === 'fulfilled') {
          for (const co of companies.value.items.slice(0, RESULT_LIMIT)) {
            rows.push({
              id: `company-${co.id}`,
              group: 'Компании',
              label: co.name,
              subtitle: co.email || co.website || co.industry || undefined,
              to: `/companies/${co.id}`,
            });
          }
        }
        if (projects.status === 'fulfilled') {
          for (const p of projects.value.items.slice(0, RESULT_LIMIT)) {
            rows.push({
              id: `project-${p.id}`,
              group: 'Проекты',
              label: p.name,
              subtitle: p.owner || undefined,
              to: `/projects/${p.id}`,
            });
          }
        }
        if (sales.status === 'fulfilled') {
          for (const s of sales.value.items.slice(0, RESULT_LIMIT)) {
            rows.push({
              id: `sale-${s.id}`,
              group: 'Продажи',
              label: s.guestName || s.externalOrderNo || s.hotel || 'Продажа',
              subtitle: `${s.amount} ${s.currency}`,
              to: `/sales/${s.id}`,
            });
          }
        }

        setRecordRows(rows);
        setLoading(false);
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const allRows = useMemo(() => [...navRows, ...recordRows], [navRows, recordRows]);

  useEffect(() => {
    setActiveIndex(0);
  }, [allRows.length]);

  const goTo = (row: Row) => {
    onClose();
    navigate(row.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, allRows.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const row = allRows[activeIndex];
      if (row) goTo(row);
    }
  };

  if (!open) return null;

  let groupedRendered = new Set<string>();

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-start justify-center bg-slate-950/45 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-slate-400 shrink-0">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.5-4.5" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Найти лид, контакт, компанию, проект, продажу или раздел…"
            className="w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          <kbd className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
            Esc
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-2">
          {allRows.length === 0 && !loading && (
            <div className="px-4 py-8 text-center text-xs text-slate-400">
              {query.trim().length >= 2 ? 'Ничего не найдено' : 'Начните вводить, чтобы искать по CRM'}
            </div>
          )}
          {loading && recordRows.length === 0 && query.trim().length >= 2 && (
            <div className="px-4 py-3 text-xs text-slate-400">Ищем…</div>
          )}
          {allRows.map((row, idx) => {
            const showHeader = !groupedRendered.has(row.group);
            groupedRendered.add(row.group);
            return (
              <React.Fragment key={row.id}>
                {showHeader && (
                  <div className="px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    {row.group}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => goTo(row)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors ${
                    idx === activeIndex ? 'bg-[#0f172a] text-white' : 'text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{row.label}</span>
                  {row.subtitle && (
                    <span className={`shrink-0 truncate text-xs ${idx === activeIndex ? 'text-white/60' : 'text-slate-400'}`}>
                      {row.subtitle}
                    </span>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
