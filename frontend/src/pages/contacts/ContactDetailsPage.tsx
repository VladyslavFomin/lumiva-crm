// src/pages/contacts/ContactDetailsPage.tsx
import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchContact, type Contact } from '../../api/contacts';
import { fetchCompany, type Company } from '../../api/companies';
import { fetchLeads, type Lead } from '../../api/leads';
import { fetchProjects, type Project } from '../../api/projects';

type TabId = 'main' | 'company' | 'leads' | 'projects';

export const ContactDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>('main');
  const [contact, setContact] = useState<Contact | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('ID контакта не указан');
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
        setError(e.message || 'Ошибка загрузки контакта');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
  }, [id]);

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
            // Фильтруем лиды по контакту
            const contactLeads = data.filter((lead) => lead.contactId === id);
            setLeads(contactLeads);
          })
          .catch((e) => console.error('Ошибка загрузки лидов:', e));
        break;

      case 'projects':
        // Сначала загружаем лиды, потом проекты
        fetchLeads()
          .then((leadsData) => {
            if (!alive) return;
            const contactLeads = leadsData.filter((lead) => lead.contactId === id);
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
        <div className="text-center py-12 text-xs text-slate-400">Загрузка...</div>
      </MainLayout>
    );
  }

  if (error || !contact) {
    return (
      <MainLayout>
        <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
          {error || 'Контакт не найден'}
        </div>
      </MainLayout>
    );
  }

  const fullName =
    contact.fullName ||
    `${contact.firstName || ''} ${contact.lastName || ''}`.trim() ||
    contact.email ||
    'Без имени';

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Заголовок */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <button
              onClick={() => navigate('/app/contacts')}
              className="text-[11px] text-slate-400 hover:text-slate-200 mb-1"
            >
              ← К списку контактов
            </button>
            <h1 className="text-lg font-semibold text-slate-50">{fullName}</h1>
            <div className="text-[11px] text-slate-500">Детальная информация о контакте</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/app/contacts/${id}/edit`)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-700 text-slate-400 hover:text-slate-50 transition-colors"
            >
              Редактировать
            </button>
          </div>
        </div>

        {/* Вкладки */}
        <div className="inline-flex bg-slate-900/70 border border-slate-800/80 rounded-2xl p-1 text-[13px]">
          {[
            { id: 'main', label: 'Основная' },
            { id: 'company', label: 'Компания' },
            { id: 'leads', label: `Лиды` },
            { id: 'projects', label: `Проекты` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as TabId)}
              className={
                'px-4 py-1.5 rounded-xl transition-colors ' +
                (tab === t.id
                  ? 'bg-slate-800 text-slate-50'
                  : 'text-slate-400 hover:text-slate-100')
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Контент вкладок */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
          {tab === 'main' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contact.email && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">Email</div>
                    <div className="text-xs text-slate-50">
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {contact.email}
                      </a>
                    </div>
                  </div>
                )}
                {contact.phone && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">Телефон</div>
                    <div className="text-xs text-slate-50">
                      <a
                        href={`tel:${contact.phone}`}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {contact.phone}
                      </a>
                    </div>
                  </div>
                )}
                {contact.position && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">Должность</div>
                    <div className="text-xs text-slate-50">{contact.position}</div>
                  </div>
                )}
                {(contact.city || contact.country) && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">Адрес</div>
                    <div className="text-xs text-slate-50">
                      {[contact.city, contact.country].filter(Boolean).join(', ') || '-'}
                    </div>
                  </div>
                )}
                {contact.linkedin && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">LinkedIn</div>
                    <div className="text-xs text-slate-50">
                      <a
                        href={contact.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {contact.linkedin}
                      </a>
                    </div>
                  </div>
                )}
                {contact.telegram && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">Telegram</div>
                    <div className="text-xs text-slate-50">{contact.telegram}</div>
                  </div>
                )}
              </div>
              {contact.tags && contact.tags.length > 0 && (
                <div>
                  <div className="text-[10px] text-slate-500 mb-1">Теги</div>
                  <div className="flex flex-wrap gap-2">
                    {contact.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-slate-800/50 text-slate-300 rounded text-[10px]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'company' && (
            <div>
              {contact.companyId ? (
                company ? (
                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] text-slate-500 mb-1">Название</div>
                      <div className="text-xs font-medium text-slate-50">{company.name}</div>
                    </div>
                    {company.email && (
                      <div>
                        <div className="text-[10px] text-slate-500 mb-1">Email</div>
                        <div className="text-xs text-slate-50">{company.email}</div>
                      </div>
                    )}
                    {company.phone && (
                      <div>
                        <div className="text-[10px] text-slate-500 mb-1">Телефон</div>
                        <div className="text-xs text-slate-50">{company.phone}</div>
                      </div>
                    )}
                    <button
                      onClick={() => navigate(`/app/companies/${company.id}`)}
                      className="px-4 py-2 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft transition-colors"
                    >
                      Открыть компанию
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-xs text-slate-400">
                    Загрузка компании...
                  </div>
                )
              ) : (
                <div className="text-center py-8 text-xs text-slate-400">
                  Контакт не привязан к компании
                </div>
              )}
            </div>
          )}

          {tab === 'leads' && (
            <div className="space-y-2">
              {leads.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">Нет лидов</div>
              ) : (
                leads.map((lead) => (
                  <div
                    key={lead.id}
                    onClick={() => navigate(`/app/leads/${lead.id}`)}
                    className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3 cursor-pointer hover:border-slate-600/80 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-slate-50">
                        {lead.name || 'Без имени'}
                      </div>
                      <span className="px-2 py-0.5 bg-slate-700/50 text-slate-300 rounded text-[10px]">
                        {lead.status}
                      </span>
                    </div>
                    {lead.email && (
                      <div className="text-[11px] text-slate-400 mt-1">{lead.email}</div>
                    )}
                    {lead.phone && (
                      <div className="text-[11px] text-slate-400">{lead.phone}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'projects' && (
            <div className="space-y-2">
              {projects.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">Нет проектов</div>
              ) : (
                projects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => navigate(`/app/projects/${project.id}`)}
                    className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3 cursor-pointer hover:border-slate-600/80 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-slate-50">{project.name}</div>
                      <span className="px-2 py-0.5 bg-slate-700/50 text-slate-300 rounded text-[10px]">
                        {project.status}
                      </span>
                    </div>
                    {project.amount && (
                      <div className="text-[11px] text-slate-400 mt-1">
                        {new Intl.NumberFormat('ru-RU', {
                          style: 'currency',
                          currency: project.currency || 'EUR',
                        }).format(parseFloat(project.amount))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};











