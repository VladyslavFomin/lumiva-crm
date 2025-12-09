// src/pages/staff/StaffDetailPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { fetchStaffById } from '../../api/staff';
import type { StaffUser, StaffRole } from '../../api/staff';

const ROLE_LABEL: Record<StaffRole, string> = {
  owner: 'Владелец',
  manager: 'Менеджер',
  viewer: 'Наблюдатель',
  finance: 'Финансы',
  sales: 'Продажи',
  developer: 'Разработчик',
  support: 'Поддержка',
};

export const StaffDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<StaffUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    fetchStaffById(id)
      .then(setItem)
      .catch((e: any) => {
        console.error(e);
        setError(e.message || 'Ошибка загрузки сотрудника');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const renderAvatar = () => {
    if (!item) return null;

    if (item.avatarUrl) {
      return (
        <img
          src={item.avatarUrl}
          alt={item.fullName || ''}
          className="h-16 w-16 rounded-full object-cover"
        />
      );
    }

    const initials = (item.fullName || '')
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    return (
      <div className="h-16 w-16 rounded-full bg-slate-800 flex items-center justify-center text-sm text-slate-200">
        {initials || '??'}
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-[11px] text-slate-400 hover:text-slate-200"
        >
          ← Назад к списку сотрудников
        </button>

        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-xs text-slate-400">Загружаем…</div>
        )}

        {!loading && item && (
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-5 space-y-4">
            <div className="flex items-center gap-4">
              {renderAvatar()}
              <div>
                <div className="text-lg font-semibold text-slate-50">
                  {item.fullName}
                </div>
                <div className="text-xs text-slate-400">{item.email}</div>
                <div className="text-[10px] text-slate-500 mt-1 break-all">
                  ID: {item.id}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <div className="text-slate-500">Роль</div>
                <div className="inline-flex px-2 py-1 rounded-full bg-slate-800 text-slate-100">
                  {ROLE_LABEL[item.role]}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-slate-500">Отдел</div>
                <div className="text-slate-100">
                  {item.department || 'Не указан'}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-slate-500">Статус</div>
                <div
                  className={
                    'inline-flex px-2 py-1 rounded-full ' +
                    (item.isActive
                      ? 'bg-emerald-900/60 text-emerald-300'
                      : 'bg-slate-800 text-slate-400')
                  }
                >
                  {item.isActive ? 'Активен' : 'Отключен'}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-slate-500">Связанный tenant user</div>
                <div className="text-slate-100">
                  {item.externalId || '—'}
                </div>
              </div>
            </div>

            {/* Здесь позже:
                - смена аватара
                - управление приглашениями / сброс пароля
                - детальные права доступа (RBAC)
             */}
          </div>
        )}
      </div>
    </MainLayout>
  );
};