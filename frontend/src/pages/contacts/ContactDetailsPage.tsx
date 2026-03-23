// src/pages/contacts/ContactDetailsPage.tsx
import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchContact, type Contact } from '../../api/contacts';
import { fetchCompany, type Company } from '../../api/companies';
import { fetchLeads, isLeadInTrash, type Lead } from '../../api/leads';
import { fetchProjects, type Project } from '../../api/projects';
import { useTranslation } from 'react-i18next';

type TabId = 'main' | 'company' | 'leads' | 'projects';

export const ContactDetailsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>('main');
  const [contact, setContact] = useState<Contact | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [quickLeads, setQuickLeads] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

    // Загружаем основную информацию контакта
    fetchContact(id)
      .then((data) => {
        if (!alive) return;
        setContact(data);
      })
      .catch((e) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.contacts.form.errors.loadFailed'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
  }, [id, t]);

  useEffect(() => {
    if (!id || loading || !contact) return;
    let alive = true;
    fetchLeads()
      .then((items) => {
        if (!alive) return;
        setQuickLeads(
          items
            .filter((lead) => lead.contactId === id && !isLeadInTrash(lead))
            .slice(0, 3),
        );
      })
      .catch(() => {
        // ignore
      });
    return () => {
      alive = false;
    };
  }, [id, loading, contact]);

  // Загружаем данные для активной вкладки
  useEffect(() => {
    if (!id || loading || !contact) return;

    let alive = true;

    switch (tab) {
      case 'company':
        if (contact.companyId) {
          fetchCompany(contact.companyId)
            .then((data) => {
              if (!alive) return;
              setCompany(data);
            })
            .catch((e) => console.error('Ошибка загрузки компании:', e));
        }
        break;

      case 'leads':
        fetchLeads()
          .then((data) => {
            if (!alive) return;
            const contactLeads = data.filter(
              (lead) => lead.contactId === id && !isLeadInTrash(lead),
            );
            setLeads(contactLeads);
          })
          .catch((e) => console.error('Ошибка загрузки лидов:', e));
        break;

      case 'projects':
        // Сначала загружаем лиды, потом проекты
        fetchLeads()
          .then((leadsData) => {
            if (!alive) return;
            const contactLeads = leadsData.filter(
              (lead) => lead.contactId === id && !isLeadInTrash(lead),
            );
            const leadIds = contactLeads.map((l) => l.id);

            if (leadIds.length === 0) {
              setProjects([]);
              return;
            }

            return fetchProjects().then((data) => {
              if (!alive) return;
              const contactProjects = data.items.filter((project) =>
                leadIds.includes(project.leadId || ''),
              );
              setProjects(contactProjects);
            });
          })
          .catch((e) => console.error('Ошибка загрузки проектов:', e));
        break;
    }

    return () => {
      alive = false;
    };
  }, [id, tab, loading, contact]);

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-xs text-slate-400">
          {t('crm.common.loading')}
        </div>
      </MainLayout>
    );
  }

  if (error || !contact) {
    return (
      <MainLayout>
        <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
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
      <div className="space-y-4">
        {/* Заголовок */}
        <div className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
          <div>
            <button
              onClick={() => navigate('/contacts')}
              className="text-[11px] text-slate-500 hover:text-slate-700 mb-1"
            >
              {t('crm.contacts.details.page.backToList')}
            </button>
            <h1 className="text-lg font-semibold text-slate-900">{fullName}</h1>
            <div className="text-[11px] text-slate-500">
              {t('crm.contacts.details.page.subtitle')}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/contacts/${id}/edit`)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {t('crm.contacts.form.titleEdit')}
            </button>
          </div>
        </div>

        {/* Вкладки */}
        <div className="inline-flex bg-white border border-slate-200 rounded-2xl p-1 text-[13px]">
          {[
            { id: 'main', label: t('crm.contacts.details.tabs.main') },
            { id: 'company', label: t('crm.contacts.details.tabs.company') },
            { id: 'leads', label: t('crm.contacts.details.tabs.leads') },
            { id: 'projects', label: t('crm.contacts.details.tabs.projects') },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as TabId)}
              className={
                'px-4 py-1.5 rounded-xl transition-colors ' +
                (tab === t.id
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-500 hover:text-slate-800')
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Контент вкладок */}
        <div className="bg-white border border-slate-200 rounded-3xl p-4">
          {tab === 'main' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contact.email && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">Email</div>
                    <div className="text-xs text-slate-700">
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-blue-600 hover:text-blue-500"
                      >
                        {contact.email}
                      </a>
                    </div>
                  </div>
                )}
                {contact.phone && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">
                      {t('crm.contacts.form.fields.phone')}
                    </div>
                    <div className="text-xs text-slate-700">
                      <a
                        href={`tel:${contact.phone}`}
                        className="text-blue-600 hover:text-blue-500"
                      >
                        {contact.phone}
                      </a>
                    </div>
                  </div>
                )}
                {contact.position && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">
                      {t('crm.contacts.form.fields.position')}
                    </div>
                    <div className="text-xs text-slate-700">{contact.position}</div>
                  </div>
                )}
                <div>
                  <div className="text-[10px] text-slate-500 mb-1">
                    {t('crm.contacts.details.page.assignee')}
                  </div>
                  <div className="text-xs text-slate-700">
                    {contact.assignedTo ||
                      (Array.isArray(contact.customFields?.assignedToList)
                        ? (contact.customFields?.assignedToList as string[]).join(', ')
                        : '') ||
                      t('crm.projects.common.emptyValue')}
                  </div>
                </div>
                {(contact.city || contact.country) && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">
                      {t('crm.contacts.form.fields.address')}
                    </div>
                    <div className="text-xs text-slate-700">
                      {[contact.city, contact.country].filter(Boolean).join(', ') ||
                        t('crm.projects.common.emptyValue')}
                    </div>
                  </div>
                )}
                {contact.linkedin && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">LinkedIn</div>
                    <div className="text-xs text-slate-700">
                      <a
                        href={contact.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-500"
                      >
                        {contact.linkedin}
                      </a>
                    </div>
                  </div>
                )}
                {contact.telegram && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">Telegram</div>
                    <div className="text-xs text-slate-700">{contact.telegram}</div>
                  </div>
                )}
              </div>
              {contact.tags && contact.tags.length > 0 && (
                <div>
                    <div className="text-[10px] text-slate-500 mb-1">
                      {t('crm.projects.detail.fields.tags')}
                    </div>
                  <div className="flex flex-wrap gap-2">
                    {contact.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="text-[10px] text-slate-500 mb-1">
                  {t('crm.contacts.details.page.linkedLeads')}
                </div>
                {quickLeads.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {quickLeads.map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => navigate(`/leads/${lead.id}`)}
                        className="px-2 py-1 text-[11px] rounded-lg border border-slate-300 text-slate-700 hover:border-slate-400 transition-colors"
                      >
                        {lead.name || t('crm.projects.detail.fields.leadNameFallback')}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setTab('leads')}
                      className="px-2 py-1 text-[11px] rounded-lg border border-slate-300 text-slate-600 hover:text-slate-800 transition-colors"
                    >
                      {t('crm.contacts.details.page.allLeads')}
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">
                    {t('crm.contacts.details.page.leadsNotLinked')}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'company' && (
            <div>
              {contact.companyId ? (
                company ? (
                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] text-slate-500 mb-1">
                        {t('crm.companies.form.fields.name')}
                      </div>
                      <div className="text-xs font-medium text-slate-900">{company.name}</div>
                    </div>
                    {company.email && (
                      <div>
                        <div className="text-[10px] text-slate-500 mb-1">
                          {t('crm.companies.form.fields.email')}
                        </div>
                        <div className="text-xs text-slate-700">{company.email}</div>
                      </div>
                    )}
                    {company.phone && (
                      <div>
                        <div className="text-[10px] text-slate-500 mb-1">
                          {t('crm.companies.form.fields.phone')}
                        </div>
                        <div className="text-xs text-slate-700">{company.phone}</div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate(`/companies/${company.id}`)}
                      className="px-4 py-2 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft transition-colors"
                    >
                      {t('crm.contacts.details.page.openCompany')}
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-xs text-slate-400">
                    {t('crm.common.loading')}
                  </div>
                )
              ) : (
                <div className="text-center py-8 text-xs text-slate-500">
                  {t('crm.contacts.details.company.empty')}
                </div>
              )}
            </div>
          )}

          {tab === 'leads' && (
            <div className="space-y-2">
              {leads.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  {t('crm.contacts.details.leads.empty')}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">
                          {t('crm.contacts.details.page.tables.leads.lead')}
                        </th>
                        <th className="px-3 py-2 text-left font-medium">Email</th>
                        <th className="px-3 py-2 text-left font-medium">
                          {t('crm.contacts.form.fields.phone')}
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          {t('crm.contacts.form.fields.status')}
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          {t('crm.contacts.details.page.tables.leads.owner')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {leads.map((lead) => (
                        <tr
                          key={lead.id}
                          onClick={() => navigate(`/leads/${lead.id}`)}
                          className="cursor-pointer hover:bg-sky-50/50"
                        >
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {lead.name ||
                              lead.email ||
                              lead.phone ||
                              `${t('crm.contacts.details.page.tables.leads.lead')} ${lead.id.slice(0, 6)}`}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {lead.email || t('crm.projects.common.emptyValue')}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {lead.phone || t('crm.projects.common.emptyValue')}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{lead.status}</td>
                          <td className="px-3 py-2 text-slate-600">
                            {lead.assignedTo || t('crm.projects.common.emptyValue')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'projects' && (
            <div className="space-y-2">
              {projects.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  {t('crm.contacts.details.projects.empty')}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">
                          {t('crm.contacts.details.page.tables.projects.project')}
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          {t('crm.contacts.form.fields.status')}
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          {t('crm.contacts.details.page.tables.projects.owner')}
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          {t('crm.contacts.details.page.tables.projects.budget')}
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          {t('crm.contacts.details.page.tables.projects.updated')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {projects.map((project) => (
                        <tr
                          key={project.id}
                          onClick={() => navigate(`/projects/${project.id}`)}
                          className="cursor-pointer hover:bg-sky-50/50"
                        >
                          <td className="px-3 py-2 font-medium text-slate-800">{project.name}</td>
                          <td className="px-3 py-2 text-slate-600">{project.status}</td>
                          <td className="px-3 py-2 text-slate-600">
                            {project.owner || t('crm.projects.common.emptyValue')}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {new Intl.NumberFormat(locale, {
                              style: 'currency',
                              currency: project.currency || 'EUR',
                              minimumFractionDigits: 0,
                            }).format(Number(project.amount || 0))}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {project.updatedAt || t('crm.projects.common.emptyValue')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};











