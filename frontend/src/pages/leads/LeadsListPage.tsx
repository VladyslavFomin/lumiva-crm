// src/pages/leads/LeadsListPage.tsx

import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import type { Lead } from '../../api/leads';
import { fetchLeads } from '../../api/leads';

export const LeadsListPage: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleCreateLead = () => navigate('/app/leads/new');
  const handleOpenLead = (id: string) => navigate(`/app/leads/${id}`);
  const goBoard = () => navigate('/app/leads');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetchLeads()
      .then((items) => {
        if (!alive) return;
        // fetchLeads уже возвращает Lead[]
        setLeads(items);
      })
      .catch((e) => {
        console.error(e);
        if (!alive) return;
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

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-50">
              Лиды · Список
            </h1>
            <div className="text-[11px] text-slate-500">
              Табличный вид: удобно фильтровать и быстро искать
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Переключатель вида */}
            <div className="inline-flex rounded-xl bg-slate-900/80 border border-slate-700/80 text-[11px] overflow-hidden">
              <button
                className="px-3 py-1.5 text-slate-400 hover:bg-slate-800/80"
                type="button"
                onClick={goBoard}
              >
                Канбан
              </button>
              <button
                className="px-3 py-1.5 bg-slate-800 text-slate-50"
                type="button"
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

        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {/* Таблица */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
          {loading ? (
            <div className="text-xs text-slate-400">Загружаем лидов…</div>
          ) : (
            <table className="w-full text-xs border-separate border-spacing-y-1">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left px-2 py-1">Имя</th>
                  <th className="text-left px-2 py-1">Канал</th>
                  <th className="text-left px-2 py-1">Статус</th>
                  <th className="text-left px-2 py-1">Создан</th>
                  <th className="text-right px-2 py-1">Действия</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="bg-slate-950/80 hover:bg-slate-900/80 cursor-pointer"
                    onClick={() => handleOpenLead(lead.id)}
                  >
                    <td className="px-2 py-1.5 text-slate-100">
                      {lead.name}
                    </td>
                    <td className="px-2 py-1.5 text-slate-400">
                      {lead.channel}
                    </td>
                    <td className="px-2 py-1.5 text-slate-400">
                      {lead.status}
                    </td>
                    <td className="px-2 py-1.5 text-slate-400">
                      {new Date(lead.createdAt).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <span className="text-[11px] text-lumiva-accent hover:text-lumiva-accent-soft">
                        Открыть
                      </span>
                    </td>
                  </tr>
                ))}

                {leads.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-2 py-2 text-[11px] text-slate-500 italic"
                    >
                      Лидов пока нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </MainLayout>
  );
};