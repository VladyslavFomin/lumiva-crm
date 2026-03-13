// src/pages/leads/LeadsBoardPage.tsx

import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Lead, LeadStatus } from '../../api/leads';
import { fetchLeads, updateLeadStatus } from '../../api/leads';
import {
  fetchCustomFields,
  type CustomField,
} from '../../api/custom-fields';
import { CustomFieldsManager } from '../../components/CustomFieldsManager';

// ВАЖНО: здесь используем именно текстовые статусы,
// которые описаны в api/leads.ts (Новый клиент, В работе, ...)
const STATUSES: { id: LeadStatus; key: string }[] = [
  { id: 'Новый клиент', key: 'new' },
  { id: 'В работе', key: 'inProgress' },
  { id: 'Ожидает ответа', key: 'waiting' },
  { id: 'Закрыт (успех)', key: 'won' },
  { id: 'Закрыт (проигран)', key: 'lost' },
];

export const LeadsBoardPage: React.FC = () => {
  const { t } = useTranslation();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [dragLeadId, setDragLeadId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const navigate = useNavigate();

  // загрузка лидов с бэка
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetchLeads()
      .then((data) => {
        if (!alive) return;
        setLeads(data);
      })
      .catch((e) => {
        if (!alive) return;
        console.error(e);
        setError(e.message || t('crm.leads.board.errors.loadFailed'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchCustomFields('lead')
      .then((items) => {
        if (!alive) return;
        setCustomFields([...items].sort((a, b) => a.order - b.order));
      })
      .catch((e) => console.error('Ошибка загрузки кастомных полей:', e));
    return () => {
      alive = false;
    };
  }, []);

  const activeCustomFields = customFields.filter((field) => field.isActive);
  const suggestedKeys = React.useMemo(() => {
    const keys = new Set<string>();
    leads.forEach((lead) => {
      Object.keys(lead.customFields ?? {}).forEach((key) => keys.add(key));
    });
    return Array.from(keys);
  }, [leads]);

  const renderCustomPreview = (lead: Lead) => {
    if (!activeCustomFields.length) return null;
    const rows = activeCustomFields
      .map((field) => {
        const raw = lead.customFields?.[field.key];
        if (raw === null || raw === undefined || raw === '') return null;
        const display = Array.isArray(raw)
          ? raw.join(', ')
          : typeof raw === 'boolean'
            ? raw
              ? 'Да'
              : 'Нет'
            : String(raw);
        return `${field.label}: ${display}`;
      })
      .filter(Boolean)
      .slice(0, 2);
    if (!rows.length) return null;
    return (
      <div className="mt-2 space-y-0.5">
        {rows.map((row, idx) => (
          <div key={idx} className="text-[10px] text-slate-500 truncate">
            {row}
          </div>
        ))}
      </div>
    );
  };

  const handleDragStart = (leadId: string) => {
    setDragLeadId(leadId);
  };

  const handleDropTo = (status: LeadStatus) => {
    if (!dragLeadId) return;

    // оптимистично меняем на фронте
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === dragLeadId ? { ...lead, status } : lead,
      ),
    );

    // и отправляем PATCH на бэкенд
    updateLeadStatus(dragLeadId, status).catch((e) => {
      console.error('Ошибка смены статуса', e);
      // при желании можно сделать откат или перезагрузку
    });

    setDragLeadId(null);
  };

  const leadsByStatus = (status: LeadStatus) =>
    leads.filter((lead) => lead.status === status);

  const handleCreateLead = () => navigate('/app/leads/new');
  const handleOpenLead = (id: string) => navigate(`/app/leads/${id}`);
  const goList = () => navigate('/app/leads');

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Заголовок + переключатель вида */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-50">
              {t('crm.leads.board.title')}
            </h1>
            <div className="text-[11px] text-slate-500">
              {t('crm.leads.board.subtitle')}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Переключатель вида */}
            <div className="inline-flex rounded-xl bg-slate-900/80 border border-slate-700/80 text-[11px] overflow-hidden">
              <button
                className="px-3 py-1.5 bg-slate-800 text-slate-50"
                type="button"
              >
                {t('crm.leads.board.viewKanban')}
              </button>
              <button
                className="px-3 py-1.5 text-slate-300 hover:bg-lumiva-accent/10 hover:text-slate-100 transition-colors"
                type="button"
                onClick={goList}
              >
                {t('crm.leads.board.viewList')}
              </button>
            </div>

            <button
              onClick={() => setCustomFieldsOpen(true)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-700/80 text-slate-200 hover:bg-slate-900/80"
            >
              Настроить поля
            </button>
            <button
              onClick={handleCreateLead}
              className="px-3 py-1.5 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft"
            >
              {t('crm.leads.board.create')}
            </button>
          </div>
        </div>

        {/* Ошибка / загрузка */}
        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}
        {loading && !error && (
          <div className="text-xs text-slate-400">{t('crm.leads.board.loading')}</div>
        )}

        {/* Канбан доска */}
        {!loading && !error && (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {STATUSES.map((col) => {
              const colLeads = leadsByStatus(col.id);
              return (
                <div
                  key={col.id}
                  className="flex-1 min-w-[230px] max-w-xs bg-slate-950/80 border border-slate-800/80 rounded-3xl p-3 flex flex-col shadow-[0_16px_40px_rgba(15,23,42,0.14)] overflow-hidden"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropTo(col.id)}
                >
                  {/* Шапка колонки */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-slate-300 font-medium">
                      {t(`crm.leads.statuses.${col.key}`)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {colLeads.length}
                    </div>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto">
                    {colLeads.map((lead) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => handleDragStart(lead.id)}
                        onClick={() => handleOpenLead(lead.id)}
                        className="cursor-move rounded-2xl bg-slate-900/90 border border-slate-800/80 px-3 py-2 text-xs text-slate-100 shadow-[0_8px_18px_rgba(15,23,42,0.12)] overflow-hidden hover:border-lumiva-accent-soft hover:bg-slate-900 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-medium truncate">
                            {lead.name}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            #{lead.id.slice(0, 6)}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-400">
                            {lead.channel}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {lead.createdAt}
                          </span>
                        </div>
                        {renderCustomPreview(lead)}
                      </div>
                    ))}

                    {colLeads.length === 0 && (
                      <div className="text-[11px] text-slate-500 italic px-1 py-2">
                        {t('crm.leads.board.empty')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {customFieldsOpen && (
          <CustomFieldsManager
            entityType="lead"
            title="Кастомные поля лидов"
            suggestedKeys={suggestedKeys}
            onClose={() => setCustomFieldsOpen(false)}
            onUpdated={(items) =>
              setCustomFields([...items].sort((a, b) => a.order - b.order))
            }
          />
        )}
      </div>
    </MainLayout>
  );
};
