// src/pages/settings/AuditLogPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { fetchAuditLog, type AuditLogEntry, type AuditLogEntityType, type AuditLogAction } from '../../api/auditLog';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { useAlertModal } from '../../contexts/AlertModalContext';
import '../telephony/telephony-design.css';

const ENTITY_LABEL: Record<AuditLogEntityType, string> = {
  lead: 'Лид',
  contact: 'Контакт',
  company: 'Компания',
  sale: 'Продажа',
  project: 'Проект',
  reservation: 'Бронирование',
  hotel_reservation: 'Бронь отеля',
  product: 'Товар',
};

const ACTION_LABEL: Record<AuditLogAction, string> = {
  create: 'Создание',
  update: 'Изменение',
  delete: 'Удаление',
};

const ACTION_CLASS: Record<AuditLogAction, string> = { create: 'ok', update: 'warn', delete: 'bad' };

const formatDate = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const AuditLogPage: React.FC = () => {
  const { showAlert } = useAlertModal();
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [entityType, setEntityType] = useState<AuditLogEntityType | ''>('');
  const [action, setAction] = useState<AuditLogAction | ''>('');
  const [search, setSearch] = useState('');

  const staffNameById = useMemo(() => new Map(staff.map((s) => [s.id, s.fullName])), [staff]);

  useEffect(() => {
    fetchStaff().then(setStaff).catch(() => {});
  }, []);

  const load = (nextPage: number, append: boolean) => {
    setLoading(true);
    fetchAuditLog({
      entityType: entityType || undefined,
      action: action || undefined,
      search: search || undefined,
      page: nextPage,
      limit: 30,
    })
      .then((res) => {
        setItems((prev) => (append ? [...prev, ...res.items] : res.items));
        setTotal(res.total);
        setPage(nextPage);
      })
      .catch((e) => showAlert(e?.message || 'Не удалось загрузить журнал активности', { variant: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, action]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    load(1, false);
  };

  return (
    <MainLayout>
      <div className="px-scope">
        <div className="tel-hero">
          <div>
            <div className="kicker"><span className="dot" />НАСТРОЙКИ</div>
            <h1>Журнал активности</h1>
            <p className="sub">Единая лента изменений по лидам, контактам, компаниям, продажам и бронированиям — кто и что менял.</p>
          </div>
        </div>

        <div className="ha-section">
          <form onSubmit={onSearchSubmit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="bk-search" style={{ maxWidth: 280 }}>
              <input
                placeholder="Поиск по названию, автору…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as AuditLogEntityType | '')}
              style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line-2)', fontSize: 12.5, fontFamily: 'inherit', background: '#fff' }}
            >
              <option value="">Все сущности</option>
              {(Object.keys(ENTITY_LABEL) as AuditLogEntityType[]).map((k) => (
                <option key={k} value={k}>{ENTITY_LABEL[k]}</option>
              ))}
            </select>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as AuditLogAction | '')}
              style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line-2)', fontSize: 12.5, fontFamily: 'inherit', background: '#fff' }}
            >
              <option value="">Все действия</option>
              {(Object.keys(ACTION_LABEL) as AuditLogAction[]).map((k) => (
                <option key={k} value={k}>{ACTION_LABEL[k]}</option>
              ))}
            </select>
            <button type="submit" className="btn">Найти</button>
          </form>
        </div>

        <div className="ha-section">
          <div className="ha-section-head">
            <div>
              <h3>Записи</h3>
              <div className="sub">{total} всего</div>
            </div>
          </div>

          {items.length === 0 && !loading ? (
            <p style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>Ничего не найдено за выбранный фильтр.</p>
          ) : (
            items.map((it) => (
              <div key={it.id} className="sms-thread-row" style={{ cursor: 'default', gridTemplateColumns: '90px 1fr 140px' }}>
                <span className={`ha-risk-pill ${ACTION_CLASS[it.action]}`} style={{ alignSelf: 'center', textAlign: 'center' }}>{ACTION_LABEL[it.action]}</span>
                <div>
                  <div className="call-name">{ENTITY_LABEL[it.entityType]}{it.entityLabel ? ` · ${it.entityLabel}` : ''}</div>
                  <div className="sms-preview">{it.summary || '—'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11.5, color: 'var(--ink)' }}>{it.actorUserId ? (staffNameById.get(it.actorUserId) || 'Сотрудник') : 'Система'}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--ff-mono)' }}>{formatDate(it.createdAt)}</div>
                </div>
              </div>
            ))
          )}

          {items.length < total && (
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button className="btn" disabled={loading} onClick={() => load(page + 1, true)}>
                {loading ? 'Загрузка…' : 'Показать ещё'}
              </button>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};
