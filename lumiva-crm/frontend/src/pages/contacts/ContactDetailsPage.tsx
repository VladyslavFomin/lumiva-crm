// src/pages/contacts/ContactDetailsPage.tsx
import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchContact, type Contact } from '../../api/contacts';
import { fetchCompany, type Company } from '../../api/companies';
import { fetchLeads, isLeadInTrash, type Lead } from '../../api/leads';
import { fetchProjects } from '../../api/projects';
import type { Project } from '../projects/projectTypes';
import { useTranslation } from 'react-i18next';
import { fetchStaff, type StaffUser } from '../../api/staff';
import '../projects/ProjectsListPage.css';
import {
  OwnerAvatarsRow,
  resolveLeadAssigneesDisplay,
  resolveProjectOwnersDisplay,
} from '../../components/crm/OwnerAvatarsRow';
import { SmsSendModal } from '../../components/sms/SmsSendModal';

type TabId = 'main' | 'leads' | 'projects';

export const ContactDetailsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>('main');
  const [smsOpen, setSmsOpen] = useState(false);
  const [contact, setContact] = useState<Contact | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [quickLeads, setQuickLeads] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffUser[]>([]);

  const locale = i18n.language?.startsWith('en')
    ? 'en-US'
    : i18n.language?.startsWith('tr')
      ? 'tr-TR'
      : 'ru-RU';

  useEffect(() => {
    if (!id) {
      setError(t('crm.contacts.details.page.errors.idMissing'));
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);

    fetchContact(id)
      .then((data) => {
        if (!alive) return;
        setContact(data);
        // Load company inline if linked
        if (data.companyId) {
          fetchCompany(data.companyId)
            .then((c) => { if (alive) setCompany(c); })
            .catch(() => {});
        }
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.message || t('crm.contacts.form.errors.loadFailed'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => { alive = false; };
  }, [id, t]);

  useEffect(() => {
    let alive = true;
    fetchStaff()
      .then((list) => { if (alive) setStaff(list); })
      .catch(() => { if (alive) setStaff([]); });
    return () => { alive = false; };
  }, []);

  // Quick leads for main tab
  useEffect(() => {
    if (!id || loading || !contact) return;
    let alive = true;
    fetchLeads()
      .then((items) => {
        if (!alive) return;
        setQuickLeads(
          items.filter((lead) => lead.contactId === id && !isLeadInTrash(lead)).slice(0, 3),
        );
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [id, loading, contact]);

  // Tab-specific data
  useEffect(() => {
    if (!id || loading || !contact) return;
    let alive = true;

    switch (tab) {
      case 'leads':
        fetchLeads()
          .then((data) => {
            if (!alive) return;
            setLeads(data.filter((lead) => lead.contactId === id && !isLeadInTrash(lead)));
          })
          .catch(() => {});
        break;

      case 'projects':
        fetchLeads()
          .then((leadsData) => {
            if (!alive) return;
            const leadIds = leadsData
              .filter((lead) => lead.contactId === id && !isLeadInTrash(lead))
              .map((l) => l.id);
            if (!leadIds.length) { setProjects([]); return; }
            return fetchProjects().then((data) => {
              if (!alive) return;
              setProjects(data.items.filter((p) => leadIds.includes(p.leadId || '')));
            });
          })
          .catch(() => {});
        break;
    }

    return () => { alive = false; };
  }, [id, tab, loading, contact]);

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-xs text-slate-400">{t('crm.common.loading')}</div>
      </MainLayout>
    );
  }

  if (error || !contact) {
    return (
      <MainLayout>
        <div className="text-xs text-status-error bg-status-error-bg border border-red-200 rounded-xl px-3 py-2">
          {error || t('crm.contacts.details.page.errors.notFound')}
        </div>
      </MainLayout>
    );
  }

  const fullName =
    contact.fullName ||
    `${contact.firstName || ''} ${contact.lastName || ''}`.trim() ||
    contact.email ||
    t('crm.projects.detail.fields.leadNameFallback');

  return (
    <MainLayout>
      <PageHelpButton topic="contactCard" />
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 rounded-[14px] border border-[#e7e7e7] bg-white p-5">
          <div>
            <button
              onClick={() => navigate('/contacts')}
              className="flex items-center gap-1 text-[11px] text-[#888] hover:text-[#222] mb-2 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              {t('crm.contacts.details.page.backToList')}
            </button>
            <h1 className="cd-display text-[20px] font-semibold text-[#222] tracking-[-0.02em]">{fullName}</h1>
            {contact.position && company && (
              <div className="mt-1 text-[12px] text-[#888]">
                {contact.position}
                {' · '}
                <button
                  type="button"
                  onClick={() => navigate(`/companies/${company.id}`)}
                  className="text-[#222] hover:underline"
                >
                  {company.name}
                </button>
              </div>
            )}
            {contact.position && !company && (
              <div className="mt-1 text-[12px] text-[#888]">{contact.position}</div>
            )}
            {!contact.position && company && (
              <div className="mt-1 text-[12px] text-[#888]">
                <button
                  type="button"
                  onClick={() => navigate(`/companies/${company.id}`)}
                  className="text-[#222] hover:underline"
                >
                  {company.name}
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/contacts/${id}/edit`)}
              className="rounded-[8px] border border-[#e7e7e7] bg-white px-3.5 py-2 text-[12px] font-medium text-[#444] hover:border-[#ccc] hover:bg-[#fafafa] transition-colors"
            >
              {t('crm.contacts.form.titleEdit')}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="inline-flex bg-white border border-[#e7e7e7] rounded-[12px] p-1 text-[13px]">
          {([
            { id: 'main',     label: t('crm.contacts.details.tabs.main') },
            { id: 'leads',    label: t('crm.contacts.details.tabs.leads') },
            { id: 'projects', label: t('crm.contacts.details.tabs.projects') },
          ] as { id: TabId; label: string }[]).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={
                'px-4 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors ' +
                (tab === item.id
                  ? 'bg-[#222] text-white'
                  : 'text-[#888] hover:text-[#222]')
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="rounded-[14px] border border-[#e7e7e7] bg-white p-5">

          {/* ── MAIN ── */}
          {tab === 'main' && (
            <div className="space-y-5">
              {/* Contact fields grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contact.email && (
                  <div>
                    <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#888] mb-1.5">Email</div>
                    <a href={`mailto:${contact.email}`} className="text-[13px] text-[#222] hover:underline">
                      {contact.email}
                    </a>
                  </div>
                )}
                {contact.phone && (
                  <div>
                    <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#888] mb-1.5">
                      {t('crm.contacts.form.fields.phone')}
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={`tel:${contact.phone}`} className="text-[13px] text-[#222] hover:underline">
                        {contact.phone}
                      </a>
                      <button
                        onClick={() => setSmsOpen(true)}
                        className="rounded-[6px] border border-[#e7e7e7] bg-[#fafafa] px-2 py-0.5 text-[10px] font-medium text-[#555] hover:border-[#222] hover:text-[#222] transition-colors"
                      >
                        SMS
                      </button>
                    </div>
                  </div>
                )}
                {contact.position && (
                  <div>
                    <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#888] mb-1.5">
                      {t('crm.contacts.form.fields.position')}
                    </div>
                    <div className="text-[13px] text-[#222]">{contact.position}</div>
                  </div>
                )}
                <div>
                  <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#888] mb-1.5">
                    {t('crm.contacts.details.page.assignee')}
                  </div>
                  <div className="text-[13px] text-[#444]">
                    {contact.assignedTo ||
                      (Array.isArray(contact.customFields?.assignedToList)
                        ? (contact.customFields?.assignedToList as string[]).join(', ')
                        : '') ||
                      t('crm.projects.common.emptyValue')}
                  </div>
                </div>
                {(contact.city || contact.country) && (
                  <div>
                    <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#888] mb-1.5">
                      {t('crm.contacts.form.fields.address')}
                    </div>
                    <div className="text-[13px] text-[#444]">
                      {[contact.city, contact.country].filter(Boolean).join(', ')}
                    </div>
                  </div>
                )}
                {typeof contact.customFields?.passport === 'string' && contact.customFields.passport.trim() && (
                  <div>
                    <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#888] mb-1.5">
                      {t('crm.contacts.form.fields.passport')}
                    </div>
                    <div className="text-[13px] text-[#444]">{contact.customFields.passport}</div>
                  </div>
                )}
                {contact.linkedin && (
                  <div>
                    <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#888] mb-1.5">LinkedIn</div>
                    <a
                      href={contact.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] text-[#222] hover:underline truncate block max-w-[200px]"
                    >
                      {contact.linkedin}
                    </a>
                  </div>
                )}
                {contact.telegram && (
                  <div>
                    <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#888] mb-1.5">Telegram</div>
                    <div className="text-[13px] text-[#222]">{contact.telegram}</div>
                  </div>
                )}
              </div>

              {/* Tags */}
              {contact.tags && contact.tags.length > 0 && (
                <div>
                  <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#888] mb-2">
                    {t('crm.projects.detail.fields.tags')}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {contact.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full border border-[#e7e7e7] bg-[#fafafa] px-2.5 py-[3px] text-[11px] text-[#555]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Company card — inline, no separate tab */}
              {contact.companyId && (
                <div className="rounded-[10px] border border-[#e7e7e7] bg-[#fafafa] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#888]">
                      {t('crm.contacts.details.tabs.company')}
                    </div>
                    {company && (
                      <button
                        type="button"
                        onClick={() => navigate(`/companies/${company.id}`)}
                        className="text-[11px] text-[#888] hover:text-[#222] transition-colors flex items-center gap-1"
                      >
                        Открыть
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      </button>
                    )}
                  </div>
                  {company ? (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-[8px] border border-[#e7e7e7] bg-white flex items-center justify-center flex-shrink-0 text-[13px] font-semibold text-[#222]">
                        {company.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-[#222] truncate">{company.name}</div>
                        <div className="text-[11px] text-[#888] mt-0.5 flex items-center gap-2">
                          {company.email && <span className="truncate">{company.email}</span>}
                          {company.email && company.phone && <span className="text-[#e7e7e7]">·</span>}
                          {company.phone && <span>{company.phone}</span>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[12px] text-[#888]">{t('crm.common.loading')}</div>
                  )}
                </div>
              )}

              {/* Linked leads */}
              <div>
                <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#888] mb-2">
                  {t('crm.contacts.details.page.linkedLeads')}
                </div>
                {quickLeads.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {quickLeads.map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => navigate(`/leads/${lead.id}`)}
                        className="rounded-[8px] border border-[#e7e7e7] bg-white px-3 py-1.5 text-[12px] text-[#444] hover:border-[#222] hover:text-[#222] transition-colors"
                      >
                        {lead.name || t('crm.projects.detail.fields.leadNameFallback')}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setTab('leads')}
                      className="rounded-[8px] border border-[#e7e7e7] bg-[#fafafa] px-3 py-1.5 text-[12px] text-[#888] hover:text-[#222] transition-colors"
                    >
                      {t('crm.contacts.details.page.allLeads')}
                    </button>
                  </div>
                ) : (
                  <div className="text-[13px] text-[#888]">
                    {t('crm.contacts.details.page.leadsNotLinked')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── LEADS ── */}
          {tab === 'leads' && (
            <div className="space-y-2">
              {leads.length === 0 ? (
                <div className="text-center py-8 text-[13px] text-[#888]">
                  {t('crm.contacts.details.leads.empty')}
                </div>
              ) : (
                <div className="lv-proj-wrap">
                  <div className="lv-proj-scroll">
                    <table className="lv-proj-table lv-leads-table">
                      <thead>
                        <tr>
                          <th className="lv-tcol-name"><span className="lv-th-inner">{t('crm.contacts.details.page.tables.leads.lead')}</span></th>
                          <th className="lv-tcol-center"><span className="lv-th-inner">Email</span></th>
                          <th className="lv-tcol-center"><span className="lv-th-inner">{t('crm.contacts.form.fields.phone')}</span></th>
                          <th className="lv-tcol-center"><span className="lv-th-inner">{t('crm.contacts.form.fields.status')}</span></th>
                          <th className="lv-tcol-center"><span className="lv-th-inner">{t('crm.contacts.details.page.tables.leads.owner')}</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {leads.map((lead) => {
                          const leadOwners = resolveLeadAssigneesDisplay(lead, staff);
                          return (
                            <tr key={lead.id} onClick={() => navigate(`/leads/${lead.id}`)} className="lv-proj-row">
                              <td className="lv-tcol-name">{lead.name || lead.email || lead.phone || `Лид ${lead.id.slice(0, 6)}`}</td>
                              <td className="lv-tcol-center">{lead.email || '—'}</td>
                              <td className="lv-tcol-center">{lead.phone || '—'}</td>
                              <td className="lv-tcol-center">{lead.status}</td>
                              <td className="lv-tcol-center lv-td-popover">
                                {leadOwners.length ? <OwnerAvatarsRow items={leadOwners} readOnly /> : <span className="text-[var(--fg-3)]">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PROJECTS ── */}
          {tab === 'projects' && (
            <div className="space-y-2">
              {projects.length === 0 ? (
                <div className="text-center py-8 text-[13px] text-[#888]">
                  {t('crm.contacts.details.projects.empty')}
                </div>
              ) : (
                <div className="lv-proj-wrap">
                  <div className="lv-proj-scroll">
                    <table className="lv-proj-table lv-leads-table">
                      <thead>
                        <tr>
                          <th className="lv-tcol-name"><span className="lv-th-inner">{t('crm.contacts.details.page.tables.projects.project')}</span></th>
                          <th className="lv-tcol-center"><span className="lv-th-inner">{t('crm.contacts.form.fields.status')}</span></th>
                          <th className="lv-tcol-center"><span className="lv-th-inner">{t('crm.contacts.details.page.tables.projects.owner')}</span></th>
                          <th className="lv-tcol-center"><span className="lv-th-inner">{t('crm.contacts.details.page.tables.projects.budget')}</span></th>
                          <th className="lv-tcol-center"><span className="lv-th-inner">{t('crm.contacts.details.page.tables.projects.updated')}</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {projects.map((project) => {
                          const projOwners = resolveProjectOwnersDisplay(project, staff);
                          return (
                            <tr key={project.id} onClick={() => navigate(`/projects/${project.id}`)} className="lv-proj-row">
                              <td className="lv-tcol-name">{project.name}</td>
                              <td className="lv-tcol-center">{project.status}</td>
                              <td className="lv-tcol-center lv-td-popover">
                                {projOwners.length ? <OwnerAvatarsRow items={projOwners} readOnly /> : <span className="text-[var(--fg-3)]">—</span>}
                              </td>
                              <td className="lv-tcol-center">
                                {new Intl.NumberFormat(locale, {
                                  style: 'currency',
                                  currency: project.currency || 'EUR',
                                  minimumFractionDigits: 0,
                                }).format(Number(project.amount || 0))}
                              </td>
                              <td className="lv-tcol-center">{project.updatedAt || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {smsOpen && contact.phone && (
        <SmsSendModal
          phone={contact.phone}
          entityType="contact"
          entityId={contact.id}
          onClose={() => setSmsOpen(false)}
        />
      )}
    </MainLayout>
  );
};
