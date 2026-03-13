// src/pages/companies/CompanyDetailsPage.tsx
import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchCompany, type Company } from '../../api/companies';
import { fetchContacts, type Contact } from '../../api/contacts';
import { fetchLeads, type Lead } from '../../api/leads';
import { fetchProjects, type Project } from '../../api/projects';
import {
  fetchCompanyTasks,
  type CompanyTask,
  type CompanyTaskStatus,
} from '../../api/companies';
import { fetchCompanyAnalytics, type CompanyAnalytics } from '../../api/companies';

type TabId = 'main' | 'contacts' | 'leads' | 'projects' | 'tasks' | 'analytics';

export const CompanyDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>('main');
  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<CompanyTask[]>([]);
  const [analytics, setAnalytics] = useState<CompanyAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('ID компании не указан');
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);

    // Загружаем основную информацию компании
    fetchCompany(id)
      .then((data) => {
        if (!alive) return;
        setCompany(data);
      })
      .catch((e) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || 'Ошибка загрузки компании');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
  }, [id]);

  // Загружаем данные для активной вкладки
  useEffect(() => {
    if (!id || loading) return;

    let alive = true;

    switch (tab) {
      case 'contacts':
        fetchContacts({ companyId: id, limit: 100 })
          .then((data) => {
            if (!alive) return;
            setContacts(data.items);
          })
          .catch((e) => console.error('Ошибка загрузки контактов:', e));
        break;

      case 'leads':
        fetchLeads()
          .then((data) => {
            if (!alive) return;
            // Фильтруем лиды по компании
            const companyLeads = data.filter((lead) => lead.companyId === id);
            setLeads(companyLeads);
          })
          .catch((e) => console.error('Ошибка загрузки лидов:', e));
        break;

      case 'projects':
        // Сначала загружаем лиды, потом проекты
        fetchLeads()
          .then((leadsData) => {
            if (!alive) return;
            const companyLeads = leadsData.filter((lead) => lead.companyId === id);
            const leadIds = companyLeads.map((l) => l.id);
            
            if (leadIds.length === 0) {
              setProjects([]);
              return;
            }

            return fetchProjects().then((data) => {
              if (!alive) return;
              const companyProjects = data.items.filter((project) =>
                leadIds.includes(project.leadId || ''),
              );
              setProjects(companyProjects);
            });
          })
          .catch((e) => console.error('Ошибка загрузки проектов:', e));
        break;

      case 'tasks':
        fetchCompanyTasks(id)
          .then((data) => {
            if (!alive) return;
            setTasks(data);
          })
          .catch((e) => console.error('Ошибка загрузки задач:', e));
        break;

      case 'analytics':
        fetchCompanyAnalytics(id)
          .then((data) => {
            if (!alive) return;
            setAnalytics(data);
          })
          .catch((e) => console.error('Ошибка загрузки аналитики:', e));
        break;
    }

    return () => {
      alive = false;
    };
  }, [id, tab, loading]);

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-xs text-slate-400">Загрузка...</div>
      </MainLayout>
    );
  }

  if (error || !company) {
    return (
      <MainLayout>
        <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
          {error || 'Компания не найдена'}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Заголовок */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <button
              onClick={() => navigate('/app/companies')}
              className="text-[11px] text-slate-400 hover:text-slate-200 mb-1"
            >
              ← К списку компаний
            </button>
            <h1 className="text-lg font-semibold text-slate-50">{company.name}</h1>
            <div className="text-[11px] text-slate-500">Детальная информация о компании</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/app/companies/${id}/tasks`)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-700 text-slate-400 hover:text-slate-50 transition-colors"
            >
              Задачи
            </button>
            <button
              onClick={() => navigate(`/app/companies/${id}/edit`)}
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
            { id: 'contacts', label: `Контакты` },
            { id: 'leads', label: `Лиды` },
            { id: 'projects', label: `Проекты` },
            { id: 'tasks', label: 'Задачи' },
            { id: 'analytics', label: 'Аналитика' },
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
                {company.website && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">Сайт</div>
                    <div className="text-xs text-slate-50">
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {company.website}
                      </a>
                    </div>
                  </div>
                )}
                {(company.city || company.country) && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">Адрес</div>
                    <div className="text-xs text-slate-50">
                      {[company.city, company.country].filter(Boolean).join(', ') || '-'}
                    </div>
                  </div>
                )}
                {company.industry && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">Отрасль</div>
                    <div className="text-xs text-slate-50">{company.industry}</div>
                  </div>
                )}
                {company.size && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">Размер</div>
                    <div className="text-xs text-slate-50">{company.size}</div>
                  </div>
                )}
              </div>
              {company.description && (
                <div>
                  <div className="text-[10px] text-slate-500 mb-1">Описание</div>
                  <div className="text-xs text-slate-50">{company.description}</div>
                </div>
              )}
            </div>
          )}

          {tab === 'contacts' && (
            <div className="space-y-2">
              {contacts.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  Нет контактов
                </div>
              ) : (
                contacts.map((contact) => {
                  const fullName =
                    contact.fullName ||
                    `${contact.firstName || ''} ${contact.lastName || ''}`.trim() ||
                    'Без имени';
                  return (
                    <div
                      key={contact.id}
                      onClick={() => navigate(`/app/contacts/${contact.id}/edit`)}
                      className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3 cursor-pointer hover:border-slate-600/80 transition-colors"
                    >
                      <div className="text-xs font-medium text-slate-50">{fullName}</div>
                      {contact.email && (
                        <div className="text-[11px] text-slate-400 mt-1">{contact.email}</div>
                      )}
                      {contact.phone && (
                        <div className="text-[11px] text-slate-400">{contact.phone}</div>
                      )}
                    </div>
                  );
                })
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

          {tab === 'tasks' && (
            <div className="space-y-2">
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">Нет задач</div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-slate-50">{task.title}</div>
                      <span
                        className="px-2 py-0.5 rounded text-[10px]"
                        style={{
                          backgroundColor: STATUS_COLORS[task.status] + '40',
                          color: STATUS_COLORS[task.status],
                        }}
                      >
                        {STATUSES.find((s) => s.id === task.status)?.label || task.status}
                      </span>
                    </div>
                    {task.description && (
                      <div className="text-[11px] text-slate-400 mt-1">{task.description}</div>
                    )}
                  </div>
                ))
              )}
              <button
                onClick={() => navigate(`/app/companies/${id}/tasks`)}
                className="w-full mt-4 px-4 py-2 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft transition-colors"
              >
                Открыть канбан задач
              </button>
            </div>
          )}

          {tab === 'analytics' && analytics && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3">
                  <div className="text-[10px] text-slate-500 mb-1">Контакты</div>
                  <div className="text-xl font-semibold text-slate-50">
                    {analytics.contacts.total}
                  </div>
                </div>
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3">
                  <div className="text-[10px] text-slate-500 mb-1">Лиды</div>
                  <div className="text-xl font-semibold text-slate-50">
                    {analytics.leads.total}
                  </div>
                </div>
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3">
                  <div className="text-[10px] text-slate-500 mb-1">Проекты</div>
                  <div className="text-xl font-semibold text-slate-50">
                    {analytics.projects.total}
                  </div>
                </div>
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3">
                  <div className="text-[10px] text-slate-500 mb-1">Выручка</div>
                  <div className="text-xl font-semibold text-emerald-400">
                    {new Intl.NumberFormat('ru-RU', {
                      style: 'currency',
                      currency: 'EUR',
                      minimumFractionDigits: 0,
                    }).format(analytics.metrics.totalRevenue)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3">
                  <div className="text-[10px] text-slate-500 mb-2">Конверсия</div>
                  <div className="text-lg font-semibold text-slate-50">
                    {analytics.metrics.conversionRate.toFixed(2)}%
                  </div>
                </div>
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3">
                  <div className="text-[10px] text-slate-500 mb-2">Средняя стоимость проекта</div>
                  <div className="text-lg font-semibold text-slate-50">
                    {new Intl.NumberFormat('ru-RU', {
                      style: 'currency',
                      currency: 'EUR',
                      minimumFractionDigits: 0,
                    }).format(analytics.metrics.avgProjectValue)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

// Константы для задач (дублируем из CompanyTasksBoardPage)
const STATUSES: { id: CompanyTaskStatus; label: string }[] = [
  { id: 'todo', label: 'К выполнению' },
  { id: 'in_progress', label: 'В работе' },
  { id: 'review', label: 'На проверке' },
  { id: 'done', label: 'Выполнено' },
  { id: 'cancelled', label: 'Отменено' },
];

const STATUS_COLORS: Record<CompanyTaskStatus, string> = {
  todo: '#64748b',
  in_progress: '#8b5cf6',
  review: '#facc15',
  done: '#22c55e',
  cancelled: '#ef4444',
};

