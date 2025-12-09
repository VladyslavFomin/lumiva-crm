// src/pages/sales/SaleDetailsPage.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchSaleDetail,
  updateSale,
  type SaleDetail,
  type SaleStatus,
} from '../../api/sales';
import {
  searchLeadsQuick,
  createLead,
  type Lead,
} from '../../api/leads';
import { MainLayout } from '../../layout/MainLayout';

export const SaleDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // форма управления заказом
  const [formStatus, setFormStatus] = useState<SaleStatus | ''>('');
  const [formManager, setFormManager] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formLeadId, setFormLeadId] = useState(''); // привязка к лиду
  const [saving, setSaving] = useState(false);

  // создание лида из заказа
  const [creatingLead, setCreatingLead] = useState(false);
  const [createLeadError, setCreateLeadError] = useState<string | null>(null);

  // поиск лида
  const [leadQuery, setLeadQuery] = useState('');
  const [leadResults, setLeadResults] = useState<Lead[]>([]);
  const [leadSearching, setLeadSearching] = useState(false);
  const [leadDropdownOpen, setLeadDropdownOpen] = useState(false);
  const leadSearchTimeout = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    fetchSaleDetail(id)
      .then((res) => {
        setData(res);

        const sale = res.sale || {};

        const initialStatus =
          (sale.status as SaleStatus | undefined) ?? 'new';
        setFormStatus(initialStatus);

        setFormManager((sale.managerName as string) || '');
        setFormNotes((sale.notes as string) || '');
        setFormLeadId((sale.leadId as string) || '');
      })
      .catch((e: any) => {
        console.error(e);
        setError(e.message || 'Не удалось загрузить заказ');
      })
      .finally(() => setLoading(false));
  }, [id]);

  // дебаунс-поиск лида
  useEffect(() => {
    if (!leadQuery || leadQuery.trim().length < 2) {
      setLeadResults([]);
      setLeadDropdownOpen(false);
      return;
    }

    setLeadSearching(true);
    setLeadDropdownOpen(true);

    if (leadSearchTimeout.current) {
      window.clearTimeout(leadSearchTimeout.current);
    }

    leadSearchTimeout.current = window.setTimeout(async () => {
      try {
        const res = await searchLeadsQuick(leadQuery.trim(), 7);
        setLeadResults(res);
      } catch (err) {
        console.error(err);
        setLeadResults([]);
      } finally {
        setLeadSearching(false);
      }
    }, 300);

    return () => {
      if (leadSearchTimeout.current) {
        window.clearTimeout(leadSearchTimeout.current);
      }
    };
  }, [leadQuery]);

  const sale = data?.sale || {};
  const meta = data?.meta || null;

  // Стоимость + валюта
  const amount = (sale.amount as number | undefined) ?? null;

  const currency =
    (sale.currency as string | undefined) ?? '—';

  // Даты: покупка и изменение
  const purchaseDateRaw =
    (sale.saleDate as string | undefined) ||
    (sale.createdAt as string | undefined);

  const purchaseDate = purchaseDateRaw
    ? new Date(purchaseDateRaw).toLocaleString('ru-RU')
    : '—';

  const updatedAtRaw = sale.updatedAt as string | undefined;
  const updatedAt = updatedAtRaw
    ? new Date(updatedAtRaw).toLocaleString('ru-RU')
    : '—';

  // Статус (как есть в CRM)
  const statusValue =
    (sale.status as string | undefined) || '—';

  // Клиент
  const clientName =
    (sale.agentName as string | undefined) ||
    (sale.guestName as string | undefined) ||
    null;

  // Продукт
  const productName =
    (sale.hotel as string | undefined) || null;

  // ID продукта (externalId)
  const productId =
    (sale.externalId as string | undefined) || null;

  // Ссылка на товар: пока можем пробовать брать из notes, если там URL
  const notes =
    typeof sale.notes === 'string' ? sale.notes.trim() : '';
  const productUrl =
    notes && /^https?:\/\//i.test(notes) ? notes : undefined;

  // Страна покупки
  const country =
    (sale.market as string | undefined) || null;

  // Канал — показываем красивое имя
  const channelLabel = data?.channel?.name || sale.channelId || '—';

  // Все поля продажи, кроме "сырого" JSON и явно лишних дублей
  const pairsSale = Object.entries(sale)
    .filter(([key]) =>
      ![
        'rawPayload',      // тяжёлый JSON
        'checkInAt',       // не используем
        'checkOutAt',      // не используем
        'externalOrderNo', // дубль
        'guestName',       // дублирует agentName
      ].includes(key),
    )
    .sort(([a], [b]) => a.localeCompare(b));

  const pairsMeta = meta
    ? Object.entries(meta).sort(([a], [b]) => a.localeCompare(b))
    : [];

  const STATUS_LABEL: Record<SaleStatus, string> = {
    new: 'Новый',
    pending: 'Ожидает',
    confirmed: 'Подтверждён',
    cancelled: 'Отменён',
    refunded: 'Возврат',
    other: 'Другое',
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);

    try {
      const updated = await updateSale(id, {
        status: formStatus || undefined,
        managerName: formManager.trim() || undefined,
        notes: formNotes.trim() || undefined,
        leadId: formLeadId.trim() || null,
      });

      setData((prev) =>
        prev
          ? {
              ...prev,
              sale: {
                ...prev.sale,
                status: updated.status,
                managerName: updated.managerName,
                notes: updated.notes,
                leadId: updated.leadId,
              },
            }
          : prev,
      );
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Не удалось сохранить изменения заказа');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenLead = () => {
    if (!formLeadId) return;
    navigate(`/app/leads/${formLeadId}`);
  };

  const handleSelectLead = (lead: Lead) => {
    setFormLeadId(lead.id);
    const parts = [lead.name, lead.phone || lead.email].filter(Boolean);
    setLeadQuery(parts.join(' • '));
    setLeadDropdownOpen(false);
  };

  const handleCreateLeadFromSale = async () => {
    if (!data) return;
    setCreatingLead(true);
    setCreateLeadError(null);

    try {
      // пробуем вытащить телефон/почту из meta, если вдруг там будут
      const phoneFromMeta =
        (meta && (meta.phone as string)) ||
        (meta && (meta.billing_phone as string)) ||
        '';
      const emailFromMeta =
        (meta && (meta.email as string)) ||
        (meta && (meta.billing_email as string)) ||
        '';

      const payload = {
        name: clientName || 'Клиент из заказа',
        phone: phoneFromMeta,
        email: emailFromMeta,
        country: country || '',
        status: 'Новый клиент' as const,
        source: channelLabel || 'sales',
        meta: {
          ...(meta || {}),
          fromSaleId: sale.id || data.id,
          saleExternalId: sale.externalId,
          saleChannelId: sale.channelId,
          saleAmount: amount,
          saleCurrency: currency,
        },
      };

      const newLead = await createLead(payload);

      // сразу привязываем лид к заказу
      await updateSale(data.id, { leadId: newLead.id });

      setFormLeadId(newLead.id);
      setLeadQuery(
        [newLead.name, newLead.phone || newLead.email]
          .filter(Boolean)
          .join(' • '),
      );

      setData((prev) =>
        prev
          ? {
              ...prev,
              sale: {
                ...prev.sale,
                leadId: newLead.id,
              },
            }
          : prev,
      );
    } catch (e: any) {
      console.error(e);
      setCreateLeadError(
        e?.message || 'Не удалось создать лид из заказа',
      );
    } finally {
      setCreatingLead(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        {/* Заголовок */}
        <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
              Продажи
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-50">
              Заказ {id?.slice(0, 8)}…
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Детальная информация по заказу из любых источников
              (интернет-магазин, внешние интеграции и др.). Отображаются все
              поля, переданные в CRM.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 text-[11px] text-slate-300">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-xl border border-slate-700/80 text-[11px] text-slate-200 bg-slate-950/80 hover:bg-slate-900/80"
            >
              ← Назад к списку
            </button>
          </div>
        </section>

        {loading && (
          <div className="text-[11px] text-slate-400">Загружаем заказ…</div>
        )}

        {error && (
          <div className="text-[11px] text-red-400">{error}</div>
        )}

        {data && !loading && !error && (
          <>
            {/* Шапка с ключевыми полями — без отельной терминологии */}
            <section className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5 space-y-3 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Блок "Заказ" */}
                <div>
                  <div className="text-[11px] text-slate-400 mb-1">
                    Заказ
                  </div>
                  <div className="text-slate-100 font-mono text-[11px] break-all">
                    {sale.id || data.id}
                  </div>

                  {productId && (
                    <div className="text-[11px] text-slate-400 mt-1">
                      ID продукта:{' '}
                      <span className="font-mono text-slate-100">
                        {productId}
                      </span>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-400 mt-1">
                    Дата покупки:{' '}
                    <span className="text-slate-100">{purchaseDate}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Дата изменения:{' '}
                    <span className="text-slate-100">{updatedAt}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Статус:{' '}
                    <span className="text-slate-100">{statusValue}</span>
                  </div>
                </div>

                {/* Блок "Финансы + канал" */}
                <div>
                  <div className="text-[11px] text-slate-400 mb-1">
                    Стоимость и канал
                  </div>
                  <div className="text-slate-100 text-sm font-semibold">
                    {amount != null
                      ? `${amount.toLocaleString('ru-RU', {
                          maximumFractionDigits: 2,
                        })} ${currency}`
                      : '—'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2">
                    Канал:{' '}
                    <span className="text-slate-100">
                      {channelLabel}
                    </span>
                  </div>
                  {data.integration && (
                    <div className="text-[11px] text-slate-400">
                      Интеграция:{' '}
                      <span className="text-slate-100">
                        {data.integration.name} · {data.integration.kind}
                      </span>
                    </div>
                  )}
                </div>

                {/* Блок "Клиент" */}
                <div>
                  <div className="text-[11px] text-slate-400 mb-1">
                    Клиент
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-slate-100">
                      {clientName || '—'}
                    </div>
                    {country && (
                      <div className="text-[11px] text-slate-400">
                        Страна покупки:{' '}
                        <span className="text-slate-100">{country}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Блок управления заказом + Лид */}
            <section className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5 text-xs space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold text-slate-100">
                  Управление заказом
                </h2>
                {saving && (
                  <span className="text-[11px] text-slate-400">
                    Сохраняем…
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Статус заказа
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) =>
                      setFormStatus(e.target.value as SaleStatus)
                    }
                    className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                  >
                    {(
                      ['new', 'pending', 'confirmed', 'cancelled', 'refunded', 'other'] as SaleStatus[]
                    ).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Ответственный менеджер
                  </label>
                  <input
                    type="text"
                    value={formManager}
                    onChange={(e) => setFormManager(e.target.value)}
                    placeholder="Например: Анна Иванова"
                    className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Позже можно будет выбрать менеджера из списка сотрудников.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Лид (ID)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formLeadId}
                      onChange={(e) => setFormLeadId(e.target.value)}
                      placeholder="UUID лида или пусто"
                      className="flex-1 h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                    />
                    <button
                      type="button"
                      disabled={!formLeadId}
                      onClick={handleOpenLead}
                      className="px-3 py-1 rounded-xl border border-slate-700/80 text-[11px] text-slate-200 bg-slate-950/80 hover:bg-slate-900/80 disabled:opacity-40"
                    >
                      Открыть
                    </button>
                    <button
                      type="button"
                      disabled={!!formLeadId || creatingLead}
                      onClick={handleCreateLeadFromSale}
                      className="px-3 py-1 rounded-xl border border-lumiva-accent-soft text-[11px] text-slate-900 bg-lumiva-accent hover:bg-lumiva-accent-soft disabled:opacity-50"
                    >
                      {creatingLead ? 'Создаём…' : 'Создать лид'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Можно вручную вставить ID лида, выбрать через поиск ниже
                    или создать нового из данных заказа.
                  </p>
                  {createLeadError && (
                    <p className="text-[10px] text-red-400 mt-1">
                      {createLeadError}
                    </p>
                  )}

                  {/* Быстрый поиск лида */}
                  <div className="mt-2">
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Поиск лида (имя, телефон, email)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={leadQuery}
                        onChange={(e) => setLeadQuery(e.target.value)}
                        placeholder="Начните вводить для поиска"
                        className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 pr-7 outline-none"
                      />
                      {leadSearching && (
                        <span className="absolute right-2 top-1.5 text-[10px] text-slate-500">
                          …
                        </span>
                      )}

                      {leadDropdownOpen && (
                        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-slate-800/90 bg-slate-950/98 shadow-lg">
                          {leadResults.length > 0 ? (
                            leadResults.map((lead) => (
                              <button
                                type="button"
                                key={lead.id}
                                onClick={() => handleSelectLead(lead)}
                                className="w-full text-left px-2 py-1.5 text-[11px] hover:bg-slate-900/90"
                              >
                                <div className="text-slate-100 truncate">
                                  {lead.name || 'Без имени'}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {lead.phone || lead.email || 'Контакты не указаны'}
                                </div>
                                <div className="text-[9px] text-slate-500 font-mono truncate">
                                  {lead.id}
                                </div>
                              </button>
                            ))
                          ) : (
                            !leadSearching && (
                              <div className="px-2 py-1.5 text-[11px] text-slate-500">
                                Ничего не найдено
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Комментарий (внутренние заметки)
                </label>
                <textarea
                  rows={3}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Любая дополнительная информация по заказу, видимая только менеджерам."
                  className="w-full rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 py-2 outline-none resize-y"
                />
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-1.5 rounded-xl bg-lumiva-accent text-slate-950 text-[11px] font-semibold hover:bg-lumiva-accent-soft disabled:opacity-60"
                >
                  {saving ? 'Сохраняем…' : 'Сохранить изменения'}
                </button>
              </div>
            </section>

            {/* Продукт / услуга */}
            {(productName || productId || productUrl) && (
              <section className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5 text-xs space-y-2">
                <div className="text-sm font-semibold text-slate-100 mb-1">
                  Продукт
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <div className="text-[11px] text-slate-400 mb-1">
                      Название продукта
                    </div>
                    <div className="text-slate-100">
                      {productName || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 mb-1">
                      ID продукта
                    </div>
                    <div className="text-slate-100 font-mono text-[11px]">
                      {productId || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 mb-1">
                      Ссылка на продукт
                    </div>
                    {productUrl ? (
                      <a
                        href={productUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-lumiva-accent text-[11px] hover:underline break-all"
                      >
                        {productUrl}
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Все поля заказа */}
            <section className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5 text-xs">
              <div className="text-sm font-semibold text-slate-100 mb-2">
                Все поля заказа (Sale)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                {pairsSale.map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <div className="w-40 text-[11px] text-slate-500 truncate">
                      {key}
                    </div>
                    <div className="flex-1 text-slate-100 break-all">
                      {typeof value === 'object'
                        ? JSON.stringify(value)
                        : String(value)}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Дополнительные данные (meta) */}
            {pairsMeta.length > 0 && (
              <section className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5 text-xs">
                <div className="text-sm font-semibold text-slate-100 mb-2">
                  Дополнительные данные (meta)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  {pairsMeta.map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <div className="w-40 text-[11px] text-slate-500 truncate">
                        {key}
                      </div>
                      <div className="flex-1 text-slate-100 break-all">
                        {typeof value === 'object'
                          ? JSON.stringify(value)
                          : String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
};