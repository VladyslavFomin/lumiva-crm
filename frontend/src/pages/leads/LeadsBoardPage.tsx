// src/pages/leads/LeadsBoardPage.tsx

import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import type { Lead, LeadStatus } from '../../api/leads';
import { fetchLeads, updateLeadStatus } from '../../api/leads';

// ВАЖНО: здесь используем именно текстовые статусы,
// которые описаны в api/leads.ts (Новый клиент, В работе, ...)
const STATUSES: { id: LeadStatus; title: string }[] = [
  { id: 'Новый клиент',        title: 'Новый клиент' },
  { id: 'В работе',            title: 'В работе' },
  { id: 'Ожидает ответа',      title: 'Ожидает ответа' },
  { id: 'Закрыт (успех)',      title: 'Закрыт (успех)' },
  { id: 'Закрыт (проигран)',   title: 'Закрыт (проигран)' },
];

export const LeadsBoardPage: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [dragLeadId, setDragLeadId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
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
        setError(e.message || 'Ошибка загрузки лидов');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

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
  const goList = () => navigate('/app/leads/list');

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Заголовок + переключатель вида */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-50">
              Лиды · Канбан
            </h1>
            <div className="text-[11px] text-slate-500">
              Перетаскивайте карточки между колонками, чтобы менять статус
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Переключатель вида */}
            <div className="inline-flex rounded-xl bg-slate-900/80 border border-slate-700/80 text-[11px] overflow-hidden">
              <button
                className="px-3 py-1.5 bg-slate-800 text-slate-50"
                type="button"
              >
                Канбан
              </button>
              <button
                className="px-3 py-1.5 text-slate-400 hover:bg-slate-800/80"
                type="button"
                onClick={goList}
              >
                Список
              </button>
            </div>

            <button
              onClick={handleCreateLead}
              className="px-3 py-1.5 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft"
            >
              Создать лид
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
          <div className="text-xs text-slate-400">Загружаем лиды…</div>
        )}

        {/* Канбан доска */}
        {!loading && !error && (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {STATUSES.map((col) => {
              const colLeads = leadsByStatus(col.id);
              return (
                <div
                  key={col.id}
                  className="flex-1 min-w-[230px] max-w-xs bg-slate-950/80 border border-slate-800/80 rounded-3xl p-3 flex flex-col"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropTo(col.id)}
                >
                  {/* Шапка колонки */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-slate-300 font-medium">
                      {col.title}
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
                        className="cursor-move rounded-2xl bg-slate-900/90 border border-slate-800/80 px-3 py-2 text-xs text-slate-100 hover:border-lumiva-accent-soft hover:bg-slate-900 transition-colors"
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
                      </div>
                    ))}

                    {colLeads.length === 0 && (
                      <div className="text-[11px] text-slate-500 italic px-1 py-2">
                        Нет лидов
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
};