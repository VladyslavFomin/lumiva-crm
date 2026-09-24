// src/pages/contacts/ContactsListPage.tsx
// Редизайн по мокапу Claude Design (contacts.html / components/contacts-list.jsx) —
// визуальная структура портирована 1:1, данные и все действия реальные (API).
import { useAiAssignees, notifyAiAssignmentsChanged } from '../../components/ai/useAiAssignees';
import { setAiAssignment, fetchAiEmployees, type AiAgent } from '../../api/aiEmployees';
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import {
  fetchContacts,
  deleteContact,
  bulkUpdateContacts,
  createContact,
  type Contact,
} from '../../api/contacts';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { fetchCompanies, type Company } from '../../api/companies';
import { fetchLeads, isLeadInTrash, type Lead } from '../../api/leads';
import { fetchProjects } from '../../api/projects';
import type { Project } from '../projects/projectTypes';
import { fetchDedupOverview } from '../../api/deduplication';
import { fetchAuditLog, type AuditLogEntry } from '../../api/auditLog';
import {
  cl,
  initials,
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
  sumByCurrency,
  fmtByCurrency,
} from './CrmListShared';
import './crm-lists-design.css';

const PAGE_SIZE = 50;
const FETCH_LIMIT = 2000;

const getST = (t: (k: string) => string): Record<string, [string, string]> => ({
  active: ['ok', t('crm.contacts.list.statusPill.active')],
  inactive: ['mute', t('crm.contacts.list.statusPill.inactive')],
  archived: ['mute', t('crm.contacts.list.statusPill.archived')],
});

type GroupMode = 'company' | 'manager' | 'status' | 'none';

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

export const ContactsListPage: React.FC = () => {
  const { t } = useTranslation();
  const ST = getST(t);
  const { showAlert, showConfirm } = useAlertModal();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const companyIdFilter = searchParams.get('companyId');

  const [contacts, setContacts] = useState<Contact[]>([]);
  const aiAssignees = useAiAssignees('contact', contacts.map((x) => x.id));
  const [total, setTotal] = useState(0);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [companiesMap, setCompaniesMap] = useState<Record<string, Company>>({});
  const [leads, setLeads] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [dedupCount, setDedupCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const [q, setQ] = useState('');
  const [st, setSt] = useState('all');
  const [grp, setGrp] = useState<GroupMode>('company');
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [kpi, setKpi] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<AuditLogEntry[]>([]);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchContacts({ limit: FETCH_LIMIT }),
      fetchStaff(),
      fetchCompanies({ limit: FETCH_LIMIT }),
      fetchLeads(),
      fetchProjects().then((r) => r.items).catch(() => []),
      fetchDedupOverview('contact').catch(() => null),
    ])
      .then(([contactsData, staffData, companiesData, leadsData, projectsData, dedup]) => {
        setContacts(contactsData.items);
        setTotal(contactsData.total ?? contactsData.items.length);
        setStaff(staffData);
        const map: Record<string, Company> = {};
        companiesData.items.forEach((c) => (map[c.id] = c));
        setCompaniesMap(map);
        setLeads(leadsData);
        setProjects(projectsData);
        if (dedup) setDedupCount(dedup.groupsCount);
      })
      .catch((e: any) => setError(e.message || t('crm.contacts.list.errors.loadFailed')))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const managerLabelById = useMemo(() => {
    const map = new Map<string, string>();
    staff.forEach((s) => map.set(s.id, s.fullName || s.email));
    return map;
  }, [staff]);

  const managerOf = (c: Contact): string | null =>
    (c.assignedUserId && managerLabelById.get(c.assignedUserId)) || c.assignedTo || null;

  const companyNameOf = (c: Contact): string | null =>
    (c.companyId && companiesMap[c.companyId]?.name) || c.company || null;

  const activeLeadByContactId = useMemo(() => {
    const map: Record<string, Lead> = {};
    leads.forEach((l) => {
      if (!l.contactId || isLeadInTrash(l)) return;
      if (!map[l.contactId]) map[l.contactId] = l;
    });
    return map;
  }, [leads]);

  // Колонка "Сделка" показывает не лид (лиды — просто заявки), а основной проект компании
  // контакта; если проектов несколько — остальные доступны через "+N" рядом.
  const projectsByCompanyId = useMemo(() => {
    const map: Record<string, Project[]> = {};
    projects.forEach((p) => {
      if (!p.companyId) return;
      (map[p.companyId] ||= []).push(p);
    });
    return map;
  }, [projects]);

  const counts = useMemo(
    () => ({
      all: contacts.length,
      active: contacts.filter((c) => c.status === 'active').length,
      inactive: contacts.filter((c) => c.status === 'inactive').length,
      archived: contacts.filter((c) => c.status === 'archived').length,
    }),
    [contacts],
  );

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return contacts.filter((c) => {
      if (companyIdFilter && c.companyId !== companyIdFilter) return false;
      if (st !== 'all' && c.status !== st) return false;
      if (kpi === 'noman' && managerOf(c)) return false;
      if (kpi === 'nocomp' && companyNameOf(c)) return false;
      if (kpi === 'lead' && !activeLeadByContactId[c.id]) return false;
      if (query) {
        const fullName = c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim();
        const hay = `${fullName}${c.email || ''}${c.phone || ''}${companyNameOf(c) || ''}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, q, st, kpi, companyIdFilter, activeLeadByContactId, companiesMap, managerLabelById]);

  const groups = useMemo(() => {
    if (grp === 'none') return [{ key: 'all', label: t('crm.contacts.list.group.allContacts'), items: rows }];
    const keyOf = (c: Contact) => {
      if (grp === 'company') return companyNameOf(c) || t('crm.contacts.list.group.noCompany');
      if (grp === 'manager') return managerOf(c) || t('crm.contacts.list.group.noManager');
      return ST[c.status]?.[1] || c.status || t('crm.contacts.list.group.noStatus');
    };
    const m = new Map<string, Contact[]>();
    rows.forEach((c) => {
      const k = keyOf(c);
      m.set(k, [...(m.get(k) || []), c]);
    });
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'ru'))
      .map(([key, items]) => ({ key, label: key, items }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, grp, companiesMap, managerLabelById]);

  const pagedRows = useMemo(() => {
    if (grp !== 'none') return rows;
    return rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [rows, grp, page]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  useEffect(() => setPage(1), [q, st, kpi, grp]);

  const toggle = (id: string) =>
    setSel((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const allOn = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const toggleAll = () => setSel(allOn ? new Set() : new Set(rows.map((r) => r.id)));
  const cur = open ? contacts.find((c) => c.id === open) || null : null;

  useEffect(() => {
    if (!open) {
      setHistory([]);
      return;
    }
    let alive = true;
    fetchAuditLog({ entityType: 'contact', entityId: open, limit: 12 })
      .then((r) => alive && setHistory(r.items))
      .catch(() => alive && setHistory([]));
    return () => {
      alive = false;
    };
  }, [open]);

  const KPIS: Array<[string, string, number, string]> = [
    ['all', t('crm.contacts.list.kpis.all.label'), contacts.length, t('crm.contacts.list.kpis.all.hint', { total })],
    [
      'lead',
      t('crm.contacts.list.kpis.lead.label'),
      contacts.filter((c) => activeLeadByContactId[c.id]).length,
      t('crm.contacts.list.kpis.lead.hint'),
    ],
    [
      'noman',
      t('crm.contacts.list.kpis.noman.label'),
      contacts.filter((c) => !managerOf(c)).length,
      t('crm.contacts.list.kpis.noman.hint'),
    ],
    [
      'nocomp',
      t('crm.contacts.list.kpis.nocomp.label'),
      contacts.filter((c) => !companyNameOf(c)).length,
      t('crm.contacts.list.kpis.nocomp.hint'),
    ],
  ];

  const handleCreate = () => navigate('/app/contacts/new');
  const handleOpenContact = (id: string) => navigate(`/app/contacts/${id}`);

  const handleDelete = async (id: string) => {
    const ok = await showConfirm(t('crm.contacts.list.deleteConfirm'), {
      title: t('crm.contacts.list.deleteTitle'),
      confirmLabel: t('crm.contacts.list.deleteLabel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
      setSel((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      if (open === id) setOpen(null);
    } catch (e: any) {
      showAlert(e.message || t('crm.contacts.list.errors.deleteFailed'), { variant: 'error' });
    }
  };

  const handleBulkDelete = async () => {
    const ok = await showConfirm(t('crm.contacts.list.bulk.deleteConfirm', { count: sel.size }), {
      title: t('crm.contacts.list.deleteTitle'),
      confirmLabel: t('crm.contacts.list.deleteLabel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await Promise.all(Array.from(sel).map((id) => deleteContact(id)));
      setContacts((prev) => prev.filter((c) => !sel.has(c.id)));
      setSel(new Set());
    } catch (e: any) {
      showAlert(e.message || t('crm.contacts.list.errors.deleteFailed'), { variant: 'error' });
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
        Array.from(sel).map((id) => setAiAssignment({ agentId, entityType: 'contact', entityId: id, assigned: true })),
      );
      notifyAiAssignmentsChanged();
      showAlert(t('crm.aiEmployees.assignee.bulkAssigned'), { variant: 'success' });
    } catch (e: any) {
      showAlert(e.message || t('crm.aiEmployees.errors.generic'), { variant: 'error' });
    }
  };

  const applyBulk = async (patch: { assignedUserId?: string; status?: string }, refreshMsg?: string) => {
    if (sel.size === 0) return;
    try {
      const dto: any = { contactIds: Array.from(sel) };
      if (patch.assignedUserId !== undefined) {
        const member = staff.find((s) => s.id === patch.assignedUserId);
        dto.assignedUserId = patch.assignedUserId;
        dto.assignedTo = member?.fullName || member?.email || null;
      }
      if (patch.status !== undefined) dto.status = patch.status;
      await bulkUpdateContacts(dto);
      load();
      if (refreshMsg) showAlert(refreshMsg, { variant: 'success' });
    } catch (e: any) {
      showAlert(e.message || t('crm.contacts.bulk.errors.updateFailed'), { variant: 'error' });
    }
  };

  const handleBulkTag = async () => {
    const tag = window.prompt(t('crm.contacts.list.bulk.tagPrompt'));
    if (!tag || !tag.trim()) return;
    try {
      await bulkUpdateContacts({ contactIds: Array.from(sel), tagsToAdd: [tag.trim()] });
      load();
    } catch (e: any) {
      showAlert(e.message || t('crm.contacts.bulk.errors.updateFailed'), { variant: 'error' });
    }
  };

  const handleBulkMail = () => {
    const emails = Array.from(sel)
      .map((id) => contacts.find((c) => c.id === id)?.email)
      .filter(Boolean);
    if (!emails.length) {
      showAlert(t('crm.contacts.list.bulk.noEmail'), { variant: 'error' });
      return;
    }
    window.location.href = `mailto:?bcc=${encodeURIComponent(emails.join(','))}`;
  };

  const handleBulkExport = () => {
    const list = contacts.filter((c) => sel.has(c.id));
    const rowsCsv = [
      [
        t('crm.contacts.list.csv.name'),
        t('crm.contacts.list.csv.email'),
        t('crm.contacts.list.csv.phone'),
        t('crm.contacts.list.csv.company'),
        t('crm.contacts.list.csv.status'),
        t('crm.contacts.list.csv.manager'),
      ],
      ...list.map((c) => [
        c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim(),
        c.email || '',
        c.phone || '',
        companyNameOf(c) || '',
        ST[c.status]?.[1] || c.status,
        managerOf(c) || '',
      ]),
    ];
    downloadCsv(`contacts-${Date.now()}.csv`, rowsCsv);
  };

  const handleImportFile = (file: File) => {
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = String(reader.result || '');
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) throw new Error(t('crm.contacts.list.import.emptyFile'));
        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
        const idx = (names: string[]) => headers.findIndex((h) => names.includes(h));
        const iName = idx(['имя', 'name', 'fullname', 'фио']);
        const iEmail = idx(['email', 'почта']);
        const iPhone = idx(['телефон', 'phone']);
        const iCompany = idx(['компания', 'company']);
        let created = 0;
        for (const line of lines.slice(1)) {
          const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
          const fullName = iName >= 0 ? cells[iName] : '';
          const email = iEmail >= 0 ? cells[iEmail] : '';
          const phone = iPhone >= 0 ? cells[iPhone] : '';
          const company = iCompany >= 0 ? cells[iCompany] : '';
          if (!fullName && !email && !phone) continue;
          const [firstName, ...rest] = fullName.split(' ');
          await createContact({
            firstName: firstName || undefined,
            lastName: rest.join(' ') || undefined,
            email: email || undefined,
            phone: phone || undefined,
            company: company || undefined,
          });
          created += 1;
        }
        showAlert(t('crm.contacts.list.import.success', { count: created }), { variant: 'success' });
        load();
      } catch (e: any) {
        showAlert(e.message || t('crm.contacts.list.import.failed'), { variant: 'error' });
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="px-scope">
          <div className="cl-empty">{t('crm.contacts.list.loading')}</div>
        </div>
      </MainLayout>
    );
  }

  const Row = (c: Contact) => {
    const fullName = c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || '—';
    const company = companyNameOf(c);
    const manager = managerOf(c);
    const companyProjects = c.companyId ? projectsByCompanyId[c.companyId] || [] : [];
    const mainProject = companyProjects[0];
    return (
      <tr
        key={c.id}
        className={cl('row', sel.has(c.id) && 'sel', open === c.id && 'act')}
        onClick={() => setOpen(c.id)}
      >
        <td className="col-chk" onClick={(e) => e.stopPropagation()}>
          <Chk on={sel.has(c.id)} onClick={() => toggle(c.id)} />
        </td>
        <td>
          <div className="cl-idn">
            <div className="cl-av">{initials(fullName)}</div>
            <div style={{ minWidth: 0 }}>
              <div className="nm">{fullName}</div>
              <div className="sub">{c.position || '—'}</div>
            </div>
          </div>
        </td>
        <td>
          <div className="cl-ch">
            {c.email ? (
              <a href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()}>
                {c.email}
              </a>
            ) : (
              <span className="cl-dash">—</span>
            )}
            {c.phone && <span className="p">{c.phone}</span>}
          </div>
        </td>
        <td>
          {c.companyId ? (
            <a
              className="cl-link"
              href={`/app/companies/${c.companyId}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate(`/app/companies/${c.companyId}`);
              }}
            >
              {company}
            </a>
          ) : (
            <span className="cl-dash">{company || t('crm.contacts.list.table.privatePerson')}</span>
          )}
        </td>
        <td>
          <span className="cl-mono">{c.city || '—'}</span>
        </td>
        <td>
          <Own name={manager} ai={aiAssignees[c.id]} />
        </td>
        <td>
          <span className={cl('cl-pill', ST[c.status]?.[0])}>
            <span className="dot" />
            {ST[c.status]?.[1] || c.status}
          </span>
        </td>
        <td>
          {mainProject ? (
            <div className="cl-ch" style={{ alignItems: 'center' }}>
              <a
                className="cl-link"
                href={`/app/projects/${mainProject.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate(`/app/projects/${mainProject.id}`);
                }}
              >
                <Ic d={LIC.bolt} size={11} />
                {mainProject.name || t('crm.contacts.list.table.openProject')}
              </a>
              {companyProjects.length > 1 && (
                <a
                  className="cl-pill"
                  href={`/app/companies/${c.companyId}?tab=projects`}
                  title={companyProjects
                    .slice(1)
                    .map((p) => p.name)
                    .join(', ')}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate(`/app/companies/${c.companyId}?tab=projects`);
                  }}
                >
                  +{companyProjects.length - 1}
                </a>
              )}
            </div>
          ) : (
            <span className="cl-dash">—</span>
          )}
        </td>
        <td>
          <Tags list={c.tags} />
        </td>
        <td className="col-act" onClick={(e) => e.stopPropagation()}>
          <div className="cl-acts">
            <a className="cl-ib" title={t('crm.contacts.list.table.mailTitle')} href={c.email ? `mailto:${c.email}` : undefined}>
              <Ic d={LIC.mail} size={13} />
            </a>
            <button
              type="button"
              className="cl-ib"
              title={t('crm.contacts.list.table.editTitle')}
              onClick={() => navigate(`/app/contacts/${c.id}`)}
            >
              <Ic d={LIC.pen} size={13} />
            </button>
            <button type="button" className="cl-ib danger" title={t('crm.contacts.list.table.deleteTitle')} onClick={() => handleDelete(c.id)}>
              <Ic d={LIC.trash} size={13} />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <MainLayout>
      <PageHelpButton topic="contacts" />
      <div className="px-scope">
        <div className="cl-wrap">
          <div className="cl-hero">
            <div>
              <h1>
                {t('crm.contacts.list.header.title')}
                <span className="cnt">
                  {rows.length} {t('crm.contacts.list.footer.of')} {contacts.length}
                </span>
              </h1>
              <p>
                {companyIdFilter ? (
                  <>
                    {t('crm.contacts.list.header.filteredByCompany', { name: companiesMap[companyIdFilter]?.name || '—' })}{' '}
                    <a
                      href="/app/contacts"
                      onClick={(e) => {
                        e.preventDefault();
                        setSearchParams({});
                      }}
                    >
                      {t('crm.contacts.list.header.resetFilter')}
                    </a>
                  </>
                ) : (
                  t('crm.contacts.list.header.subtitle')
                )}
              </p>
            </div>
            <div className="cl-hero-a">
              <button type="button" className="btn btn-sm" onClick={() => navigate('/app/contacts/duplicates')}>
                <Ic d={LIC.merge} size={13} />
                {t('crm.contacts.list.actions.duplicates')}
                {dedupCount > 0 && (
                  <span className="cl-chip n" style={{ border: 0, padding: 0 }}>
                    {dedupCount}
                  </span>
                )}
              </button>
              <label className="btn btn-sm" style={{ cursor: importing ? 'default' : 'pointer', opacity: importing ? 0.6 : 1 }}>
                <Ic d={LIC.import} size={13} />
                {importing ? t('crm.contacts.list.actions.importing') : t('crm.contacts.list.actions.import')}
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
                {t('crm.contacts.list.actions.newContact')}
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
            {KPIS.map(([id, k, v, d]) => (
              <button
                key={id}
                type="button"
                className={cl('cl-kpi', (kpi === id || (id === 'all' && !kpi)) && 'on')}
                onClick={() => setKpi(id === 'all' ? null : kpi === id ? null : id)}
              >
                <div className="k">{k}</div>
                <div className="v">{v}</div>
                <div className="d">{d}</div>
              </button>
            ))}
          </div>

          <div className="cl-panel">
            {sel.size > 0 ? (
              <div className="cl-bulk">
                <span className="cnt">
                  <span className="n">{sel.size}</span>
                  {t('crm.contacts.list.bulk.selected')}
                </span>
                <div className="cl-div" />
                <select
                  className="cl-sel"
                  value=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    if (v.startsWith('ai:')) void assignAiBulk(v.slice(3));
                    else applyBulk({ assignedUserId: v }, t('crm.contacts.list.bulk.managerAssigned'));
                  }}
                >
                  <option value="">{t('crm.contacts.list.bulk.assignManager')}</option>
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
                  onChange={(e) => e.target.value && applyBulk({ status: e.target.value }, t('crm.contacts.list.bulk.statusUpdated'))}
                >
                  <option value="">{t('crm.contacts.list.bulk.statusPlaceholder')}</option>
                  <option value="active">{t('crm.contacts.list.statusOptions.active')}</option>
                  <option value="inactive">{t('crm.contacts.list.statusOptions.inactive')}</option>
                  <option value="archived">{t('crm.contacts.list.statusOptions.archived')}</option>
                </select>
                <button type="button" className="btn btn-sm" onClick={handleBulkTag}>
                  <Ic d={LIC.plus} size={12} />
                  {t('crm.contacts.list.bulk.tag')}
                </button>
                <button type="button" className="btn btn-sm" onClick={handleBulkMail}>
                  <Ic d={LIC.mail} size={12} />
                  {t('crm.contacts.list.bulk.mail')}
                </button>
                <button type="button" className="btn btn-sm" onClick={handleBulkExport}>
                  <Ic d={LIC.dl} size={12} />
                  {t('crm.contacts.list.bulk.export')}
                </button>
                <div className="cl-spacer" />
                <button type="button" className="btn btn-sm btn-danger" onClick={handleBulkDelete}>
                  <Ic d={LIC.trash} size={12} />
                  {t('crm.contacts.list.bulk.delete')}
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setSel(new Set())}>
                  {t('crm.contacts.list.bulk.deselect')}
                </button>
              </div>
            ) : (
              <div className="cl-bar">
                <Search v={q} set={setQ} ph={t('crm.contacts.list.search.placeholder')} />
                <div className="cl-div" />
                <Chips
                  v={st}
                  set={setSt}
                  opts={[
                    ['all', t('crm.contacts.list.filters.all'), counts.all],
                    ['active', t('crm.contacts.list.filters.active'), counts.active],
                    ['inactive', t('crm.contacts.list.filters.inactive'), counts.inactive],
                    ['archived', t('crm.contacts.list.filters.archived'), counts.archived],
                  ]}
                />
                <div className="cl-div" />
                <span className="cl-lbl">{t('crm.contacts.list.group.label')}</span>
                <select className="cl-sel" value={grp} onChange={(e) => setGrp(e.target.value as GroupMode)}>
                  <option value="company">{t('crm.contacts.list.group.byCompany')}</option>
                  <option value="manager">{t('crm.contacts.list.group.byManager')}</option>
                  <option value="status">{t('crm.contacts.list.group.byStatus')}</option>
                  <option value="none">{t('crm.contacts.list.group.none')}</option>
                </select>
                <div className="cl-spacer" />
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
                <div className="t">{t('crm.contacts.list.empty.title')}</div>
                <div className="d">{t('crm.contacts.list.empty.desc')}</div>
                <button type="button" className="btn btn-sm btn-primary" onClick={handleCreate}>
                  <Ic d={LIC.plus} size={13} />
                  {t('crm.contacts.list.actions.newContact')}
                </button>
              </div>
            ) : view === 'table' ? (
              <div className="cl-scroll">
                <table className="cl-tbl">
                  <thead>
                    <tr>
                      <th className="col-chk">
                        <Chk on={allOn} ind={!allOn && sel.size > 0} onClick={toggleAll} />
                      </th>
                      <th>{t('crm.contacts.list.table.contact')}</th>
                      <th>{t('crm.contacts.list.table.contactInfo')}</th>
                      <th>{t('crm.contacts.list.table.company')}</th>
                      <th>{t('crm.contacts.list.table.city')}</th>
                      <th>{t('crm.contacts.list.table.manager')}</th>
                      <th>{t('crm.contacts.list.table.status')}</th>
                      <th>{t('crm.contacts.list.table.deal')}</th>
                      <th>{t('crm.contacts.list.table.tags')}</th>
                      <th className="col-act r">{t('crm.contacts.list.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grp === 'none'
                      ? pagedRows.map(Row)
                      : groups.map((g) => {
                          const isClosed = closed.has(g.key);
                          return (
                            <React.Fragment key={g.key}>
                              <tr className="cl-grp">
                                <td colSpan={10}>
                                  <div className="cl-grp-in">
                                    <button
                                      type="button"
                                      className={cl('cl-caret', isClosed && 'col')}
                                      onClick={() =>
                                        setClosed((p) => {
                                          const n = new Set(p);
                                          n.has(g.key) ? n.delete(g.key) : n.add(g.key);
                                          return n;
                                        })
                                      }
                                    >
                                      <Ic d={LIC.chev} size={11} />
                                    </button>
                                    <span className="t">{g.label}</span>
                                    <span className="n">{g.items.length}</span>
                                    <span className="agg">
                                      {g.items.filter((i) => activeLeadByContactId[i.id]).length} {t('crm.contacts.list.group.withLead')}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                              {!isClosed && g.items.map(Row)}
                            </React.Fragment>
                          );
                        })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="cl-cards">
                {(grp === 'none' ? pagedRows : rows).map((c) => {
                  const fullName = c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || '—';
                  return (
                    <div key={c.id} className="cl-card" onClick={() => setOpen(c.id)}>
                      <div className="cl-card-top">
                        <div className="cl-av">{initials(fullName)}</div>
                        <span className={cl('cl-pill', ST[c.status]?.[0])}>
                          <span className="dot" />
                          {ST[c.status]?.[1] || c.status}
                        </span>
                      </div>
                      <div className="nm">{fullName}</div>
                      <div className="sub">
                        {c.position || ''}
                        {companyNameOf(c) ? ` · ${companyNameOf(c)}` : ''}
                      </div>
                      <div className="cl-card-m">
                        <div>
                          <div className="k">{t('crm.contacts.list.card.email')}</div>
                          <div className="v" style={{ fontSize: 11 }}>
                            {c.email || '—'}
                          </div>
                        </div>
                        <div>
                          <div className="k">{t('crm.contacts.list.card.phone')}</div>
                          <div className="v" style={{ fontSize: 11 }}>
                            {c.phone || '—'}
                          </div>
                        </div>
                        <div>
                          <div className="k">{t('crm.contacts.list.card.city')}</div>
                          <div className="v" style={{ fontSize: 11 }}>
                            {c.city || '—'}
                          </div>
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
                {t('crm.contacts.list.footer.shown')} <b>{grp === 'none' ? pagedRows.length : rows.length}</b>{' '}
                {t('crm.contacts.list.footer.of')} <b>{contacts.length}</b>
                {sel.size > 0 && (
                  <>
                    {' '}
                    · {t('crm.contacts.list.footer.selected')} <b>{sel.size}</b>
                  </>
                )}
              </span>
              {grp === 'none' && pageCount > 1 && <Pg page={page} pages={pageCount} set={setPage} />}
            </div>
          </div>
        </div>

        {cur && (
          <Drawer
            title={cur.fullName || `${cur.firstName || ''} ${cur.lastName || ''}`.trim() || '—'}
            sub={`${cur.position || ''}${companyNameOf(cur) ? ' · ' + companyNameOf(cur) : ''}`}
            badge={
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className={cl('cl-pill', ST[cur.status]?.[0])}>
                  <span className="dot" />
                  {ST[cur.status]?.[1] || cur.status}
                </span>
              </div>
            }
            onClose={() => setOpen(null)}
            actions={
              <>
                {cur.email && (
                  <a className="btn btn-sm btn-primary" href={`mailto:${cur.email}`}>
                    <Ic d={LIC.mail} size={13} />
                    {t('crm.contacts.list.drawer.write')}
                  </a>
                )}
                <button type="button" className="btn btn-sm" onClick={() => navigate('/app/my-documents')}>
                  <Ic d={LIC.note} size={12} />
                  {t('crm.contacts.list.drawer.document')}
                </button>
                <button type="button" className="btn btn-sm" onClick={() => navigate(`/app/contacts/${cur.id}`)}>
                  <Ic d={LIC.pen} size={12} />
                  {t('crm.contacts.list.drawer.edit')}
                </button>
              </>
            }
          >
            <div className="cl-dr-sec">{t('crm.contacts.list.drawer.sectionContact')}</div>
            <KV k={t('crm.contacts.list.drawer.mail')} v={cur.email} />
            <KV k={t('crm.contacts.list.drawer.phone')} v={cur.phone} mono />
            <KV k="Telegram" v={cur.telegram} mono />
            <KV k="LinkedIn" v={cur.linkedin} mono />
            <KV k={t('crm.contacts.list.drawer.city')} v={cur.city} />

            <div className="cl-dr-sec">{t('crm.contacts.list.drawer.sectionCrm')}</div>
            <KV k={t('crm.contacts.list.drawer.company')} v={companyNameOf(cur)} />
            <KV k={t('crm.contacts.list.drawer.manager')} v={managerOf(cur)} />
            <KV k={t('crm.contacts.list.drawer.deal')} v={(cur.companyId && projectsByCompanyId[cur.companyId]?.[0]?.name) || null} />
            {(() => {
              const contactLeads = leads.filter((l) => l.contactId === cur.id && !isLeadInTrash(l));
              const contactProjects = projects.filter((p) => p.contactId === cur.id);
              const wonByCurrency = sumByCurrency(
                contactProjects.filter((p) => p.status === 'Выиграно' || p.status === 'Закрыт'),
                (p) => Number(p.amount) || 0,
                (p) => p.currency,
              );
              return (
                <>
                  <KV k={t('crm.contacts.list.drawer.totalLeads')} v={String(contactLeads.length)} mono />
                  <KV
                    k={t('crm.contacts.list.drawer.wonSum')}
                    v={Object.keys(wonByCurrency).length ? fmtByCurrency(wonByCurrency) : null}
                    mono
                  />
                </>
              );
            })()}
            <KV k={t('crm.contacts.list.drawer.created')} v={cur.createdAt ? new Date(cur.createdAt).toLocaleDateString('ru-RU') : null} mono />
            <KV k={t('crm.contacts.list.drawer.tags')} v={cur.tags?.length ? <Tags list={cur.tags} /> : null} />

            <div className="cl-dr-sec">{t('crm.contacts.list.drawer.sectionHistory')}</div>
            {history.length === 0 ? (
              <div className="cl-dash" style={{ fontSize: 12 }}>
                {t('crm.contacts.list.drawer.noHistory')}
              </div>
            ) : (
              history.map((h) => (
                <div key={h.id} className="cl-tl">
                  <span className="tm">{new Date(h.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="pt" />
                  <span className="tx">
                    {h.summary || h.action} {h.actorName ? `· ${h.actorName}` : ''}
                  </span>
                </div>
              ))
            )}
          </Drawer>
        )}
      </div>
    </MainLayout>
  );
};
