// src/pages/companies/CompaniesListPage.tsx
// Редизайн по мокапу Claude Design (companies.html / components/companies-list.jsx) —
// визуальная структура портирована 1:1, данные и все действия реальные (API).
import { useAiAssignees, notifyAiAssignmentsChanged } from '../../components/ai/useAiAssignees';
import { setAiAssignment, fetchAiEmployees, type AiAgent } from '../../api/aiEmployees';
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import {
  fetchCompanies,
  deleteCompany,
  bulkUpdateCompanies,
  createCompany,
  fetchAllCompaniesAnalytics,
  type Company,
  type AllCompaniesAnalytics,
} from '../../api/companies';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { fetchAuditLog, type AuditLogEntry } from '../../api/auditLog';
import {
  cl,
  initials,
  money,
  Ic,
  LIC,
  Chk,
  Own,
  Tags,
  Search,
  Seg,
  Chips,
  Drawer,
  KV,
  Pg,
} from '../contacts/CrmListShared';
import { industryLabel, normalizeIndustry } from '../contacts/CrmFormShared';
import '../contacts/crm-lists-design.css';

const PAGE_SIZE = 50;
const FETCH_LIMIT = 2000;

type TFunc = (key: string) => string;

/** Стадия отношений с компанией (company.type) — раньше это поле нигде не редактировалось. */
const getCST = (t: TFunc): Record<string, [string, string]> => ({
  client: ['ok', t('crm.companies.list.stage.client')],
  nego: ['wait', t('crm.companies.list.stage.nego')],
  lead: ['', t('crm.companies.list.stage.lead')],
  partner: ['ink', t('crm.companies.list.stage.partner')],
  own: ['mute', t('crm.companies.list.stage.own')],
  archived: ['mute', t('crm.companies.list.stage.archived')],
});
const getCstDefault = (t: TFunc): [string, string] => ['', t('crm.companies.list.stage.lead')];

export const TYPE_OPTIONS = (t: TFunc): Array<[string, string]> => [
  ['lead', t('crm.companies.list.stageOptions.lead')],
  ['nego', t('crm.companies.list.stageOptions.nego')],
  ['client', t('crm.companies.list.stageOptions.client')],
  ['partner', t('crm.companies.list.stageOptions.partner')],
  ['own', t('crm.companies.list.stageOptions.own')],
  ['archived', t('crm.companies.list.stageOptions.archived')],
];

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const CompaniesListPage: React.FC = () => {
  const { t } = useTranslation();
  const CST = getCST(t);
  const CST_DEFAULT = getCstDefault(t);
  const { showAlert, showConfirm } = useAlertModal();
  const navigate = useNavigate();

  const [companies, setCompanies] = useState<Company[]>([]);
  const aiAssignees = useAiAssignees('company', companies.map((x) => x.id));
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [analytics, setAnalytics] = useState<AllCompaniesAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const [q, setQ] = useState('');
  const [ind, setInd] = useState('Все');
  const [st, setSt] = useState('all');
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [sort, setSort] = useState<'revenue' | 'potential' | 'contacts' | 'name'>('revenue');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<AuditLogEntry[]>([]);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchCompanies({ limit: FETCH_LIMIT }),
      fetchStaff(),
      fetchAllCompaniesAnalytics().catch(() => null),
    ])
      .then(([companiesData, staffData, analyticsData]) => {
        setCompanies(companiesData.items);
        setStaff(staffData);
        setAnalytics(analyticsData);
      })
      .catch((e: any) => setError(e.message || t('crm.companies.list.errors.loadFailed')))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const perCompanyMap = useMemo(() => {
    const map: Record<
      string,
      { contacts: number; leads: number; projects: number; revenue: number; potential: number; avgProjectValue: number; currency: string }
    > = {};
    analytics?.perCompany.forEach((p) => (map[p.companyId] = p));
    return map;
  }, [analytics]);

  const statOf = (id: string) =>
    perCompanyMap[id] || {
      contacts: 0,
      leads: 0,
      projects: 0,
      revenue: 0,
      potential: 0,
      avgProjectValue: 0,
      currency: analytics?.summary.currency || 'EUR',
    };

  const managerLabelById = useMemo(() => {
    const map = new Map<string, string>();
    staff.forEach((s) => map.set(s.id, s.fullName || s.email));
    return map;
  }, [staff]);
  const managerOf = (c: Company): string | null =>
    (c.assignedUserId && managerLabelById.get(c.assignedUserId)) || c.assignedTo || null;

  const ALL_INDUSTRIES = 'Все'; // внутренний сентинел для "все отрасли", не показывается напрямую
  const industries = useMemo(() => {
    const set = new Set<string>();
    companies.forEach((c) => c.industry && set.add(normalizeIndustry(c.industry)));
    return [ALL_INDUSTRIES, ...Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'))];
  }, [companies]);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    const filtered = companies.filter((c) => {
      if (ind !== ALL_INDUSTRIES && normalizeIndustry(c.industry) !== ind) return false;
      if (st !== 'all' && (c.type || 'lead') !== st) return false;
      if (query) {
        const hay = `${c.name}${c.legalName || ''}${c.city || ''}${c.website || ''}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
    const key = (c: Company) => {
      const s = statOf(c.id);
      if (sort === 'name') return c.name;
      if (sort === 'contacts') return -s.contacts;
      if (sort === 'potential') return -s.potential;
      return -s.revenue;
    };
    return [...filtered].sort((a, b) => {
      const x = key(a);
      const y = key(b);
      return typeof x === 'string' ? x.localeCompare(y as string, 'ru') : (x as number) - (y as number);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies, q, ind, st, sort, perCompanyMap]);

  const pagedRows = useMemo(() => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [rows, page]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  useEffect(() => setPage(1), [q, ind, st, sort]);

  const sum = (k: 'revenue' | 'potential') => (analytics?.perCompany || []).reduce((s, p) => s + p[k], 0);
  const kpiCurrency = analytics?.summary.currency || 'EUR';
  const KPIS: Array<[string, string | number, string]> = [
    [
      t('crm.companies.list.kpis.companies.label'),
      companies.length,
      t('crm.companies.list.kpis.companies.hint', {
        clients: companies.filter((c) => (c.type || 'lead') === 'client').length,
        leads: companies.filter((c) => (c.type || 'lead') === 'lead').length,
      }),
    ],
    [t('crm.companies.list.kpis.revenue.label'), `${money(sum('revenue'))} ${kpiCurrency}`, t('crm.companies.list.kpis.revenue.hint')],
    [t('crm.companies.list.kpis.potential.label'), `${money(sum('potential'))} ${kpiCurrency}`, t('crm.companies.list.kpis.potential.hint')],
    [t('crm.companies.list.kpis.conversion.label'), `${analytics?.summary.avgConversionRate ?? 0}%`, t('crm.companies.list.kpis.conversion.hint')],
  ];

  const toggle = (id: string) =>
    setSel((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const allOn = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const cur = open ? companies.find((c) => c.id === open) || null : null;

  useEffect(() => {
    if (!open) {
      setHistory([]);
      return;
    }
    let alive = true;
    fetchAuditLog({ entityType: 'company', entityId: open, limit: 12 })
      .then((r) => alive && setHistory(r.items))
      .catch(() => alive && setHistory([]));
    return () => {
      alive = false;
    };
  }, [open]);

  const handleCreate = () => navigate('/companies/new');
  const handleDelete = async (id: string) => {
    const ok = await showConfirm(t('crm.companies.list.deleteConfirm'), {
      title: t('crm.companies.list.deleteTitle'),
      confirmLabel: t('crm.companies.list.deleteLabel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteCompany(id);
      setCompanies((prev) => prev.filter((c) => c.id !== id));
      setSel((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      if (open === id) setOpen(null);
    } catch (e: any) {
      showAlert(e.message || t('crm.companies.list.errors.deleteFailed'), { variant: 'error' });
    }
  };

  const handleBulkDelete = async () => {
    const ok = await showConfirm(t('crm.companies.list.bulk.deleteConfirm', { count: sel.size }), {
      title: t('crm.companies.list.deleteTitle'),
      confirmLabel: t('crm.companies.list.deleteLabel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await Promise.all(Array.from(sel).map((id) => deleteCompany(id)));
      setCompanies((prev) => prev.filter((c) => !sel.has(c.id)));
      setSel(new Set());
    } catch (e: any) {
      showAlert(e.message || t('crm.companies.list.errors.deleteFailed'), { variant: 'error' });
    }
  };

  const [aiAgents, setAiAgents] = useState<AiAgent[]>([]);
  useEffect(() => {
    fetchAiEmployees()
      .then((r) => setAiAgents(r.items.filter((a) => a.status === 'active')))
      .catch(() => undefined);
  }, []);
  const assignAiBulk = async (agentId: string) => {
    if (sel.size === 0) return;
    try {
      await Promise.all(
        Array.from(sel).map((id) => setAiAssignment({ agentId, entityType: 'company', entityId: id, assigned: true })),
      );
      notifyAiAssignmentsChanged();
      showAlert(t('crm.aiEmployees.assignee.bulkAssigned'), { variant: 'success' });
    } catch (e: any) {
      showAlert(e.message || t('crm.aiEmployees.errors.generic'), { variant: 'error' });
    }
  };

  const applyBulk = async (patch: { assignedUserId?: string; type?: string }, msg?: string) => {
    if (sel.size === 0) return;
    try {
      const dto: any = { companyIds: Array.from(sel) };
      if (patch.assignedUserId !== undefined) {
        const member = staff.find((s) => s.id === patch.assignedUserId);
        dto.assignedUserId = patch.assignedUserId;
        dto.assignedTo = member?.fullName || member?.email || null;
      }
      if (patch.type !== undefined) dto.type = patch.type;
      await bulkUpdateCompanies(dto);
      load();
      if (msg) showAlert(msg, { variant: 'success' });
    } catch (e: any) {
      showAlert(e.message || t('crm.companies.bulk.errors.updateFailed'), { variant: 'error' });
    }
  };

  const handleBulkTag = async () => {
    const tag = window.prompt(t('crm.companies.list.bulk.tagPrompt'));
    if (!tag || !tag.trim()) return;
    try {
      await bulkUpdateCompanies({ companyIds: Array.from(sel), tagsToAdd: [tag.trim()] });
      load();
    } catch (e: any) {
      showAlert(e.message || t('crm.companies.bulk.errors.updateFailed'), { variant: 'error' });
    }
  };

  const handleBulkExport = () => {
    const list = companies.filter((c) => sel.has(c.id));
    const rowsCsv = [
      [
        t('crm.companies.list.csv.name'),
        t('crm.companies.list.csv.legalName'),
        t('crm.companies.list.csv.taxId'),
        t('crm.companies.list.csv.industry'),
        t('crm.companies.list.csv.city'),
        t('crm.companies.list.csv.country'),
        t('crm.companies.list.csv.status'),
        t('crm.companies.list.csv.manager'),
      ],
      ...list.map((c) => [
        c.name,
        c.legalName || '',
        c.taxId || '',
        industryLabel(t, c.industry),
        c.city || '',
        c.country || '',
        (CST[c.type || 'lead'] || CST_DEFAULT)[1],
        managerOf(c) || '',
      ]),
    ];
    downloadCsv(`companies-${Date.now()}.csv`, rowsCsv);
  };

  const handleImportFile = (file: File) => {
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = String(reader.result || '');
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) throw new Error(t('crm.companies.list.import.emptyFile'));
        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
        const idx = (names: string[]) => headers.findIndex((h) => names.includes(h));
        const iName = idx(['название', 'name']);
        const iTax = idx(['инн', 'taxid', 'tax']);
        const iCity = idx(['город', 'city']);
        const iWebsite = idx(['сайт', 'website', 'site']);
        let created = 0;
        for (const line of lines.slice(1)) {
          const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
          const name = iName >= 0 ? cells[iName] : '';
          if (!name) continue;
          await createCompany({
            name,
            taxId: iTax >= 0 ? cells[iTax] || undefined : undefined,
            city: iCity >= 0 ? cells[iCity] || undefined : undefined,
            website: iWebsite >= 0 ? cells[iWebsite] || undefined : undefined,
          });
          created += 1;
        }
        showAlert(t('crm.companies.list.import.success', { count: created }), { variant: 'success' });
        load();
      } catch (e: any) {
        showAlert(e.message || t('crm.companies.list.import.failed'), { variant: 'error' });
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const Th: React.FC<{ id: typeof sort; children: React.ReactNode; r?: boolean }> = ({ id, children, r }) => (
    <th className={cl('sortable', r && 'r')} onClick={() => setSort(id)}>
      {children}
      {sort === id && <Ic d={LIC.chev} size={11} className="ar" />}
    </th>
  );

  if (loading) {
    return (
      <MainLayout>
        <div className="px-scope">
          <div className="cl-empty">{t('crm.companies.list.loading')}</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHelpButton topic="companies" />
      <div className="px-scope">
        <div className="cl-wrap">
          <div className="cl-hero">
            <div>
              <h1>
                {t('crm.companies.list.header.title')}
                <span className="cnt">
                  {rows.length} {t('crm.companies.list.footer.of')} {companies.length}
                </span>
              </h1>
              <p>{t('crm.companies.list.header.subtitle')}</p>
            </div>
            <div className="cl-hero-a">
              <button type="button" className="btn btn-sm" onClick={() => navigate('/companies/analytics')}>
                <Ic d={LIC.bolt} size={13} />
                {t('crm.companies.list.actions.analytics')}
              </button>
              <label className="btn btn-sm" style={{ cursor: importing ? 'default' : 'pointer', opacity: importing ? 0.6 : 1 }}>
                <Ic d={LIC.import} size={13} />
                {importing ? t('crm.companies.list.actions.importing') : t('crm.companies.list.actions.import')}
                <input
                  type="file"
                  accept=".csv"
                  disabled={importing}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImportFile(file);
                    e.target.value = '';
                  }}
                />
              </label>
              <button type="button" className="btn btn-sm btn-primary" onClick={handleCreate}>
                <Ic d={LIC.plus} size={13} />
                {t('crm.companies.list.actions.newCompany')}
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                marginBottom: 14,
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #f0c8cf',
                background: '#fbecef',
                fontSize: 12,
                color: '#9a1f31',
              }}
            >
              {error}
            </div>
          )}

          <div className="cl-kpis">
            {KPIS.map(([k, v, d]) => (
              <div key={k} className="cl-kpi" style={{ cursor: 'default' }}>
                <div className="k">{k}</div>
                <div className="v">{v}</div>
                <div className="d">{d}</div>
              </div>
            ))}
          </div>

          <div className="cl-panel">
            {sel.size > 0 ? (
              <div className="cl-bulk">
                <span className="cnt">
                  <span className="n">{sel.size}</span>
                  {t('crm.companies.list.bulk.selected')}
                </span>
                <div className="cl-div" />
                <select
                  className="cl-sel"
                  value=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    if (v.startsWith('ai:')) void assignAiBulk(v.slice(3));
                    else applyBulk({ assignedUserId: v }, t('crm.companies.list.bulk.managerAssigned'));
                  }}
                >
                  <option value="">{t('crm.companies.list.bulk.assignManager')}</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName || s.email}
                    </option>
                  ))}
                  {aiAgents.length > 0 && (
                    <optgroup label={t('crm.aiEmployees.assignee.title')}>
                      {aiAgents.map((a) => (
                        <option key={a.id} value={`ai:${a.id}`}>
                          ✦ {a.name} · {t('crm.aiEmployees.assignee.badge')}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <select
                  className="cl-sel"
                  value=""
                  onChange={(e) => e.target.value && applyBulk({ type: e.target.value }, t('crm.companies.list.bulk.statusUpdated'))}
                >
                  <option value="">{t('crm.companies.list.bulk.statusPlaceholder')}</option>
                  {TYPE_OPTIONS(t).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-sm" onClick={handleBulkTag}>
                  <Ic d={LIC.plus} size={12} />
                  {t('crm.companies.list.bulk.tag')}
                </button>
                <button type="button" className="btn btn-sm" onClick={handleBulkExport}>
                  <Ic d={LIC.dl} size={12} />
                  {t('crm.companies.list.bulk.export')}
                </button>
                <div className="cl-spacer" />
                <button type="button" className="btn btn-sm btn-danger" onClick={handleBulkDelete}>
                  <Ic d={LIC.trash} size={12} />
                  {t('crm.companies.list.bulk.delete')}
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setSel(new Set())}>
                  {t('crm.companies.list.bulk.deselect')}
                </button>
              </div>
            ) : (
              <div className="cl-bar">
                <Search v={q} set={setQ} ph={t('crm.companies.list.search.placeholder')} />
                <div className="cl-div" />
                <Chips
                  v={st}
                  set={setSt}
                  opts={[
                    ['all', t('crm.companies.list.filters.all')],
                    ['client', t('crm.companies.list.filters.client')],
                    ['nego', t('crm.companies.list.filters.nego')],
                    ['lead', t('crm.companies.list.filters.lead')],
                    ['archived', t('crm.companies.list.filters.archived')],
                  ]}
                />
                <div className="cl-div" />
                <span className="cl-lbl">{t('crm.companies.list.filterLabels.industry')}</span>
                <select className="cl-sel" value={ind} onChange={(e) => setInd(e.target.value)}>
                  {industries.map((i) => (
                    <option key={i} value={i}>{i === ALL_INDUSTRIES ? t('crm.companies.list.allIndustries') : industryLabel(t, i)}</option>
                  ))}
                </select>
                <div className="cl-spacer" />
                <span className="cl-lbl">{t('crm.companies.list.filterLabels.sort')}</span>
                <select className="cl-sel" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                  <option value="revenue">{t('crm.companies.list.sortOptions.revenue')}</option>
                  <option value="potential">{t('crm.companies.list.sortOptions.potential')}</option>
                  <option value="contacts">{t('crm.companies.list.sortOptions.contacts')}</option>
                  <option value="name">{t('crm.companies.list.sortOptions.name')}</option>
                </select>
                <Seg
                  v={view}
                  set={(v) => setView(v as 'table' | 'cards')}
                  opts={[
                    ['table', '', LIC.table],
                    ['cards', '', LIC.cards],
                  ]}
                />
              </div>
            )}

            {rows.length === 0 ? (
              <div className="cl-empty">
                <div className="t">{t('crm.companies.list.empty.title')}</div>
                <div className="d">{t('crm.companies.list.empty.desc')}</div>
                <button type="button" className="btn btn-sm btn-primary" onClick={handleCreate}>
                  <Ic d={LIC.plus} size={13} />
                  {t('crm.companies.list.actions.newCompany')}
                </button>
              </div>
            ) : view === 'table' ? (
              <div className="cl-scroll">
                <table className="cl-tbl" style={{ minWidth: 1200 }}>
                  <thead>
                    <tr>
                      <th className="col-chk">
                        <Chk on={allOn} ind={!allOn && sel.size > 0} onClick={() => setSel(allOn ? new Set() : new Set(rows.map((r) => r.id)))} />
                      </th>
                      <Th id="name">{t('crm.companies.list.table.company')}</Th>
                      <th>{t('crm.companies.list.table.industry')}</th>
                      <th>{t('crm.companies.list.table.size')}</th>
                      <th>{t('crm.companies.list.table.geography')}</th>
                      <Th id="contacts" r>
                        {t('crm.companies.list.table.contacts')}
                      </Th>
                      <th className="r">{t('crm.companies.list.table.leadsProjects')}</th>
                      <Th id="revenue" r>
                        {t('crm.companies.list.table.revenue')}
                      </Th>
                      <Th id="potential" r>
                        {t('crm.companies.list.table.potential')}
                      </Th>
                      <th>{t('crm.companies.list.table.manager')}</th>
                      <th>{t('crm.companies.list.table.status')}</th>
                      <th className="col-act r">{t('crm.companies.list.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((c) => {
                      const s = statOf(c.id);
                      const pill = CST[c.type || 'lead'] || CST_DEFAULT;
                      return (
                        <tr key={c.id} className={cl('row', sel.has(c.id) && 'sel', open === c.id && 'act')} onClick={() => setOpen(c.id)}>
                          <td className="col-chk" onClick={(e) => e.stopPropagation()}>
                            <Chk on={sel.has(c.id)} onClick={() => toggle(c.id)} />
                          </td>
                          <td>
                            <div className="cl-idn">
                              <div className="cl-av sq">{initials(c.name)}</div>
                              <div style={{ minWidth: 0 }}>
                                <div className="nm">{c.name}</div>
                                <div className="sub">{c.legalName || '—'}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="cl-pill">{industryLabel(t, c.industry) || '—'}</span>
                          </td>
                          <td>
                            <span className="cl-mono">{c.size || '—'}</span>
                          </td>
                          <td>
                            <span className="cl-mono">{[c.city, c.country].filter(Boolean).join(' · ') || '—'}</span>
                          </td>
                          <td className="r">
                            <span className="cl-mono">{s.contacts}</span>
                          </td>
                          <td className="r">
                            <span className="cl-mono">
                              {s.leads} / {s.projects}
                            </span>
                          </td>
                          <td className="r">
                            <span className="cl-mono" style={{ color: s.revenue ? 'var(--ink)' : 'var(--fg-4)', fontWeight: s.revenue ? 600 : 400 }}>
                              {s.revenue ? `${money(s.revenue)} ${s.currency}` : '—'}
                            </span>
                          </td>
                          <td className="r">
                            <span className="cl-mono">{s.potential ? `${money(s.potential)} ${s.currency}` : '—'}</span>
                          </td>
                          <td>
                            <Own name={managerOf(c)} ai={aiAssignees[c.id]} />
                          </td>
                          <td>
                            <span className={cl('cl-pill', pill[0])}>
                              {(pill[0] === 'ok' || pill[0] === 'wait') && <span className="dot" />}
                              {pill[1]}
                            </span>
                          </td>
                          <td className="col-act" onClick={(e) => e.stopPropagation()}>
                            <div className="cl-acts">
                              <button type="button" className="cl-ib" title={t('crm.companies.list.table.contacts')} onClick={() => navigate(`/app/contacts?companyId=${c.id}`)}>
                                <Ic d={LIC.users} size={13} />
                              </button>
                              <button type="button" className="cl-ib" title={t('crm.companies.list.table.editTitle')} onClick={() => navigate(`/companies/${c.id}`)}>
                                <Ic d={LIC.pen} size={13} />
                              </button>
                              <button type="button" className="cl-ib danger" title={t('crm.companies.list.table.deleteTitle')} onClick={() => handleDelete(c.id)}>
                                <Ic d={LIC.trash} size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="cl-cards">
                {pagedRows.map((c) => {
                  const s = statOf(c.id);
                  const pill = CST[c.type || 'lead'] || CST_DEFAULT;
                  return (
                    <div key={c.id} className="cl-card" onClick={() => setOpen(c.id)}>
                      <div className="cl-card-top">
                        <div className="cl-av sq">{initials(c.name)}</div>
                        <span className={cl('cl-pill', pill[0])}>{pill[1]}</span>
                      </div>
                      <div className="nm">{c.name}</div>
                      <div className="sub">
                        {industryLabel(t, c.industry) || '—'} · {[c.city, c.country].filter(Boolean).join(', ') || '—'}
                      </div>
                      <div className="cl-card-m">
                        <div>
                          <div className="k">{t('crm.companies.list.table.contacts')}</div>
                          <div className="v">{s.contacts}</div>
                        </div>
                        <div>
                          <div className="k">{t('crm.companies.list.table.revenue')}</div>
                          <div className="v">{s.revenue ? `${money(s.revenue)} ${s.currency}` : '—'}</div>
                        </div>
                        <div>
                          <div className="k">{t('crm.companies.list.table.potential')}</div>
                          <div className="v">{s.potential ? `${money(s.potential)} ${s.currency}` : '—'}</div>
                        </div>
                      </div>
                      <div className="cl-card-f">
                        <Own name={managerOf(c)} ai={aiAssignees[c.id]} />
                        <Ic d={LIC.chevR} size={13} className="cl-dash" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="cl-foot">
              <span>
                {t('crm.companies.list.footer.shown')} <b>{pagedRows.length}</b> {t('crm.companies.list.footer.of')}{' '}
                <b>{companies.length}</b> · {t('crm.companies.list.footer.revenue')}{' '}
                <b>
                  {money(rows.reduce((s, c) => s + statOf(c.id).revenue, 0))} {analytics?.summary.currency || 'EUR'}
                </b>
              </span>
              {pageCount > 1 && <Pg page={page} pages={pageCount} set={setPage} />}
            </div>
          </div>
        </div>

        {cur &&
          (() => {
            const s = statOf(cur.id);
            const pill = CST[cur.type || 'lead'] || CST_DEFAULT;
            return (
              <Drawer
                title={cur.name}
                sub={cur.legalName}
                badge={
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className={cl('cl-pill', pill[0])}>{pill[1]}</span>
                    {cur.industry && <span className="cl-pill">{industryLabel(t, cur.industry)}</span>}
                  </div>
                }
                onClose={() => setOpen(null)}
                actions={
                  <>
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => navigate(`/app/contacts?companyId=${cur.id}`)}>
                      <Ic d={LIC.users} size={13} />
                      {t('crm.companies.list.drawer.contactsCount', { count: s.contacts })}
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => navigate('/app/my-documents')}>
                      <Ic d={LIC.note} size={12} />
                      {t('crm.companies.list.drawer.document')}
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => navigate(`/companies/${cur.id}`)}>
                      <Ic d={LIC.pen} size={12} />
                      {t('crm.companies.list.drawer.edit')}
                    </button>
                  </>
                }
              >
                <div className="cl-dr-sec">{t('crm.companies.list.drawer.sectionRequisites')}</div>
                <KV k={t('crm.companies.list.drawer.legalName')} v={cur.legalName} />
                <KV k={t('crm.companies.list.drawer.taxId')} v={cur.taxId} mono />
                <KV k={t('crm.companies.list.drawer.website')} v={cur.website} mono />
                <KV k={t('crm.companies.list.drawer.address')} v={[cur.city, cur.country].filter(Boolean).join(', ')} />
                <KV k={t('crm.companies.list.drawer.size')} v={cur.size ? t('crm.companies.list.drawer.sizePeople', { size: cur.size }) : null} mono />

                <div className="cl-dr-sec">{t('crm.companies.list.drawer.sectionMoney')}</div>
                <KV k={t('crm.companies.list.table.revenue')} v={s.revenue ? `${money(s.revenue)} ${s.currency}` : null} mono />
                <KV k={t('crm.companies.list.table.potential')} v={s.potential ? `${money(s.potential)} ${s.currency}` : null} mono />
                <KV k={t('crm.companies.list.drawer.leadsProjects')} v={`${s.leads} / ${s.projects}`} mono />
                <KV k={t('crm.companies.list.drawer.avgCheck')} v={s.avgProjectValue ? `${money(s.avgProjectValue)} ${s.currency}` : null} mono />

                <div className="cl-dr-sec">CRM</div>
                <KV k={t('crm.companies.list.table.manager')} v={managerOf(cur)} />
                <KV k={t('crm.companies.list.drawer.contactsCol')} v={String(s.contacts)} mono />
                <KV k={t('crm.companies.list.drawer.created')} v={cur.createdAt ? new Date(cur.createdAt).toLocaleDateString('ru-RU') : null} mono />
                <KV k={t('crm.companies.list.drawer.tags')} v={cur.tags?.length ? <Tags list={cur.tags} /> : null} />

                <div className="cl-dr-sec">{t('crm.companies.list.drawer.sectionHistory')}</div>
                {history.length === 0 ? (
                  <div className="cl-dash" style={{ fontSize: 12 }}>
                    {t('crm.companies.list.drawer.noHistory')}
                  </div>
                ) : (
                  history.map((h) => (
                    <div key={h.id} className="cl-tl">
                      <span className="tm">
                        {new Date(h.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="pt" />
                      <span className="tx">
                        {h.summary || h.action} {h.actorName ? `· ${h.actorName}` : ''}
                      </span>
                    </div>
                  ))
                )}
              </Drawer>
            );
          })()}
      </div>
    </MainLayout>
  );
};
