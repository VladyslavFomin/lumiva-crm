// src/pages/sales/SalesIntegrationsPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import {
  fetchIntegrations,
  fetchIntegrationAdapters,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  testIntegrationConnection,
  triggerIntegrationSync,
  type IntegrationConnectionDto,
  type IntegrationKind,
  type IntegrationAdapterDto,
} from './../../api/integrations';
import {
  fetchSalesChannels,
  type SalesChannel,
} from '../../api/salesChannels';

/* ─────────────────────────────── */
/* Вспомогательные маппинги       */
/* ─────────────────────────────── */

const KIND_LABEL: Record<IntegrationKind, string> = {
  'woocommerce': 'WooCommerce',
  'manual-import': 'Ручной импорт',
  'other': 'Другое подключение',
};

const STATUS_LABEL: Record<string, string> = {
  never: 'Ещё не синкалось',
  ok: 'OK',
  error: 'Ошибка',
};

/* ─────────────────────────────── */

type NewWooFormState = {
  name: string;
  description: string;
  channelId: string;
  url: string;
  consumerKey: string;
  consumerSecret: string;
};

export const SalesIntegrationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [connections, setConnections] = useState<IntegrationConnectionDto[]>([]);
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [adapters, setAdapters] = useState<IntegrationAdapterDto[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [newOpen, setNewOpen] = useState(false);
  const [newKind] = useState<IntegrationKind>('woocommerce'); // пока только Woo
  const [newForm, setNewForm] = useState<NewWooFormState>({
    name: '',
    description: '',
    channelId: '',
    url: '',
    consumerKey: '',
    consumerSecret: '',
  });
  const [creating, setCreating] = useState(false);

  // ─── Редактирование интеграции ────────────────────────────

  const [editOpen, setEditOpen] = useState(false);
  const [editConn, setEditConn] = useState<IntegrationConnectionDto | null>(null);
  const [editForm, setEditForm] = useState<NewWooFormState>({
    name: '',
    description: '',
    channelId: '',
    url: '',
    consumerKey: '',
    consumerSecret: '',
  });
  const [updating, setUpdating] = useState(false);

  /* ─────────────────────────────── */
  /* Загрузка данных                 */
  /* ─────────────────────────────── */

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchIntegrations(),
      fetchSalesChannels(),
      fetchIntegrationAdapters(),
    ])
      .then(([conns, ch, ad]) => {
        if (!alive) return;
        setConnections(conns.filter((c: IntegrationConnectionDto) => !c.isDeleted));
        setChannels(ch.filter((c: SalesChannel) => !c.isDeleted));
        setAdapters(ad);
      })
      .catch((e: any) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || 'Не удалось загрузить интеграции');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  /* ─────────────────────────────── */
  /* Агрегаты                        */
  /* ─────────────────────────────── */

  const totalAmount = useMemo(
    () =>
      connections.reduce(
        (s, c) => s + (c.totalSalesAmount || 0),
        0,
      ),
    [connections],
  );

  const totalCount = useMemo(
    () =>
      connections.reduce(
        (s, c) => s + (c.totalSalesCount || 0),
        0,
      ),
    [connections],
  );

  /* ─────────────────────────────── */
  /* Хелперы                         */
  /* ─────────────────────────────── */

  const findChannelName = (channelId: string | null): string => {
    if (!channelId) return '—';
    const ch = channels.find((c: SalesChannel) => c.id === channelId);
    return ch?.name || '—';
  };

  const handleToggleEnabled = async (conn: IntegrationConnectionDto) => {
    setSavingId(conn.id);
    try {
      const updated = await updateIntegration(conn.id, {
        isEnabled: !conn.isEnabled,
      });
      setConnections((prev) =>
        prev.map((c) => (c.id === conn.id ? updated : c)),
      );
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Не удалось изменить статус интеграции');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (conn: IntegrationConnectionDto) => {
    if (
      !window.confirm(
        `Удалить интеграцию «${conn.name}»? Канал продаж останется, но связь будет потеряна.`,
      )
    ) {
      return;
    }
    setDeletingId(conn.id);
    try {
      await deleteIntegration(conn.id);
      setConnections((prev) =>
        prev.filter((c) => c.id !== conn.id),
      );
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Не удалось удалить интеграцию');
    } finally {
      setDeletingId(null);
    }
  };

  const handleTest = async (conn: IntegrationConnectionDto) => {
    setTestingId(conn.id);
    try {
      const res = await testIntegrationConnection(conn.id);
      alert(
        res.ok
          ? `Подключение успешно: ${res.message || 'OK'}`
          : `Проблема с подключением: ${res.message || 'Ошибка'}`,
      );
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Ошибка проверки подключения');
    } finally {
      setTestingId(null);
    }
  };

  const handleSync = async (conn: IntegrationConnectionDto) => {
    setSyncingId(conn.id);
    try {
      const res = await triggerIntegrationSync(conn.id);
      const msg =
        res.message ||
        `Создано: ${res.created}, обновлено: ${res.updated}, пропущено: ${res.skipped}`;
      alert(`Синхронизация: ${msg}`);

      // После синка можно обновить список (чтобы подтянуть новые totalSales*)
      const updated = await fetchIntegrations();
      setConnections(
        updated.filter((c: IntegrationConnectionDto) => !c.isDeleted),
      );
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Ошибка синхронизации');
    } finally {
      setSyncingId(null);
    }
  };

  /* ─────────────────────────────── */
  /* Новое подключение WooCommerce   */
  /* ─────────────────────────────── */

  const handleCreate = async () => {
    if (!newForm.url || !newForm.consumerKey || !newForm.consumerSecret) {
      alert('Укажите URL, consumer key и consumer secret WooCommerce');
      return;
    }

    setCreating(true);
    try {
      const payload = {
        name: newForm.name || 'WooCommerce магазин',
        kind: newKind,
        channelId: newForm.channelId || undefined,
        description: newForm.description || undefined,
        config: {
          url: newForm.url.trim(),
          consumerKey: newForm.consumerKey.trim(),
          consumerSecret: newForm.consumerSecret.trim(),
        },
      };

      const created = await createIntegration(payload);
      setConnections((prev) => [created, ...prev]);
      setNewOpen(false);
      setNewForm({
        name: '',
        description: '',
        channelId: '',
        url: '',
        consumerKey: '',
        consumerSecret: '',
      });
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Не удалось создать интеграцию');
    } finally {
      setCreating(false);
    }
  };

  /* ─────────────────────────────── */
  /* Редактирование подключения      */
  /* ─────────────────────────────── */

  const openEdit = (conn: IntegrationConnectionDto) => {
    const cfg: any = (conn as any).config || {};

    setEditConn(conn);
    setEditForm({
      name: conn.name || '',
      description: conn.description || '',
      channelId: conn.channelId || '',
      url: cfg.url || '',
      consumerKey: cfg.consumerKey || '',
      consumerSecret: '',
    });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editConn) return;

    if (!editForm.url || !editForm.consumerKey) {
      alert('Укажите URL и consumer key WooCommerce');
      return;
    }

    setUpdating(true);
    try {
      const payload: any = {
        name: editForm.name || 'WooCommerce магазин',
        channelId: editForm.channelId || null,
        description: editForm.description || null,
        config: {
          url: editForm.url.trim(),
          consumerKey: editForm.consumerKey.trim(),
        },
      };

      if (editForm.consumerSecret.trim()) {
        payload.config.consumerSecret = editForm.consumerSecret.trim();
      }

      const updated = await updateIntegration(editConn.id, payload);

      setConnections(prev =>
        prev.map(c => (c.id === editConn.id ? updated : c)),
      );

      setEditOpen(false);
      setEditConn(null);
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Не удалось сохранить изменения интеграции');
    } finally {
      setUpdating(false);
    }
  };

  /* ─────────────────────────────── */

  const availableWoo = adapters.find((a) => a.kind === 'woocommerce');

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        {/* Заголовок */}
        <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
              Интеграции
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-50">
              Подключения каналов продаж
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Здесь настраиваются интеграции (WooCommerce и др.), которые
              создают каналы продаж и отправляют заказы в CRM. Можно проверить
              подключение, запускать синхронизацию и отключать интеграции.
            </p>
          </div>
        </section>

        {/* Карточки типов интеграций + кнопка "Новое подключение" */}
        <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,2fr)]">
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5">
            <h2 className="text-sm font-semibold text-slate-100 mb-2">
              Доступные интеграции
            </h2>

            {availableWoo ? (
              <div className="flex flex-col gap-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-slate-100 font-semibold">
                      WooCommerce
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      Подключение интернет-магазина (заказы → CRM).
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewOpen(true);
                      setEditOpen(false);
                      setEditConn(null);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-lumiva-accent text-slate-950 text-[11px] font-semibold hover:bg-lumiva-accent-soft"
                  >
                    Новое подключение
                  </button>
                </div>
                <div className="text-[11px] text-slate-500">
                  Используйте для основной витрины или нескольких магазинов
                  (каждое подключение = отдельный канал продаж).
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-500">
                Пока нет зарегистрированных адаптеров интеграций.
              </div>
            )}
          </div>

          {/* Форма нового подключения */}
          {newOpen && (
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-100">
                  Новое подключение WooCommerce
                </h2>
                <button
                  type="button"
                  onClick={() => setNewOpen(false)}
                  className="text-[11px] text-slate-400 hover:text-slate-100"
                >
                  ✕ Закрыть
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Название подключения
                  </label>
                  <input
                    type="text"
                    value={newForm.name}
                    onChange={(e) =>
                      setNewForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="WooCommerce · основной магазин"
                    className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Канал продаж (опционально)
                  </label>
                  <select
                    value={newForm.channelId}
                    onChange={(e) =>
                      setNewForm((f) => ({ ...f, channelId: e.target.value }))
                    }
                    className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                  >
                    <option value="">Создать автоматически</option>
                    {channels.map((ch: SalesChannel) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Краткое описание
                  </label>
                  <input
                    type="text"
                    value={newForm.description}
                    onChange={(e) =>
                      setNewForm((f) => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                    placeholder="shop.example.com / main store"
                    className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      WooCommerce URL (с https)
                    </label>
                    <input
                      type="text"
                      value={newForm.url}
                      onChange={(e) =>
                        setNewForm((f) => ({ ...f, url: e.target.value }))
                      }
                      placeholder="https://shop.example.com"
                      className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Consumer key
                    </label>
                    <input
                      type="text"
                      value={newForm.consumerKey}
                      onChange={(e) =>
                        setNewForm((f) => ({
                          ...f,
                          consumerKey: e.target.value,
                        }))
                      }
                      placeholder="ck_..."
                      className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Consumer secret
                    </label>
                    <input
                      type="text"
                      value={newForm.consumerSecret}
                      onChange={(e) =>
                        setNewForm((f) => ({
                          ...f,
                          consumerSecret: e.target.value,
                        }))
                      }
                      placeholder="cs_..."
                      className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setNewOpen(false)}
                    disabled={creating}
                    className="px-3 py-1.5 rounded-xl border border-slate-700/80 text-[11px] text-slate-200 bg-slate-950/80 hover:bg-slate-900/80 disabled:opacity-50"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={creating}
                    className="px-4 py-1.5 rounded-xl bg-lumiva-accent text-slate-950 text-[11px] font-semibold hover:bg-lumiva-accent-soft disabled:opacity-60"
                  >
                    {creating ? 'Создаём…' : 'Создать подключение'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Форма редактирования подключения */}
          {editOpen && editConn && (
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-100">
                  Редактировать подключение: {editConn.name}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setEditOpen(false);
                    setEditConn(null);
                  }}
                  className="text-[11px] text-slate-400 hover:text-slate-100"
                >
                  ✕ Закрыть
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Название подключения
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Канал продаж
                  </label>
                  <select
                    value={editForm.channelId}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, channelId: e.target.value }))
                    }
                    className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                  >
                    <option value="">Оставить без канала / автосоздание</option>
                    {channels.map((ch: SalesChannel) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Краткое описание
                  </label>
                  <input
                    type="text"
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                    className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      WooCommerce URL (с https)
                    </label>
                    <input
                      type="text"
                      value={editForm.url}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, url: e.target.value }))
                      }
                      className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Consumer key
                    </label>
                    <input
                      type="text"
                      value={editForm.consumerKey}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          consumerKey: e.target.value,
                        }))
                      }
                      className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Consumer secret (оставьте пустым, чтобы не менять)
                    </label>
                    <input
                      type="text"
                      value={editForm.consumerSecret}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          consumerSecret: e.target.value,
                        }))
                      }
                      placeholder="cs_..."
                      className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditOpen(false);
                      setEditConn(null);
                    }}
                    disabled={updating}
                    className="px-3 py-1.5 rounded-xl border border-slate-700/80 text-[11px] text-slate-200 bg-slate-950/80 hover:bg-slate-900/80 disabled:opacity-50"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handleUpdate}
                    disabled={updating}
                    className="px-4 py-1.5 rounded-xl bg-lumiva-accent text-slate-950 text-[11px] font-semibold hover:bg-lumiva-accent-soft disabled:opacity-60"
                  >
                    {updating ? 'Сохраняем…' : 'Сохранить изменения'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Таблица интеграций */}
        <section className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-100">
              Список интеграций
            </h2>
            <span className="text-[11px] text-slate-500">
              Управляйте статусом, тестируйте подключение и запускайте
              синхронизацию
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px] md:text-xs border-separate border-spacing-y-1">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left font-normal px-2 py-1">
                    Подключение
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    Тип
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    Канал продаж
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    Статус
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    Последняя синхронизация
                  </th>
                  <th className="text-right font-normal px-2 py-1">
                    Продаж
                  </th>
                  <th className="text-right font-normal px-2 py-1">
                    Сумма
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody>
                {connections.map((conn) => (
                  <IntegrationRow
                    key={conn.id}
                    conn={conn}
                    channelName={findChannelName(conn.channelId)}
                    onToggle={() => handleToggleEnabled(conn)}
                    onDelete={() => handleDelete(conn)}
                    onTest={() => handleTest(conn)}
                    onSync={() => handleSync(conn)}
                    onEdit={() => openEdit(conn)}
                    testing={testingId === conn.id}
                    syncing={syncingId === conn.id}
                    saving={savingId === conn.id}
                    deleting={deletingId === conn.id}
                  />
                ))}

                {!connections.length && !loading && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-2 py-5 text-center text-[11px] text-slate-500 italic"
                    >
                      Интеграции ещё не настроены.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {loading && (
            <div className="mt-3 text-[11px] text-slate-400">
              Загружаем интеграции…
            </div>
          )}
        </section>

        {error && (
          <div className="fixed inset-x-0 bottom-3 flex justify-center pointer-events-none">
            <div className="px-3 py-1.5 rounded-full bg-red-950/95 border border-red-700/80 text-[11px] text-red-100">
              {error}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

/* ─────────────────────────────── */
/* Строка интеграции              */
/* ─────────────────────────────── */

const IntegrationRow: React.FC<{
  conn: IntegrationConnectionDto;
  channelName: string;
  testing: boolean;
  syncing: boolean;
  saving: boolean;
  deleting: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onTest: () => void;
  onSync: () => void;
  onEdit: () => void;
}> = ({
  conn,
  channelName,
  testing,
  syncing,
  saving,
  deleting,
  onToggle,
  onDelete,
  onTest,
  onSync,
  onEdit,
}) => {
  const lastSync =
    conn.lastSyncAt && conn.lastSyncAt !== null
      ? new Date(conn.lastSyncAt).toLocaleString('ru-RU')
      : '—';

  const statusBase =
    conn.lastSyncStatus && STATUS_LABEL[conn.lastSyncStatus]
      ? STATUS_LABEL[conn.lastSyncStatus]
      : conn.lastSyncStatus || '—';

  const statusColor =
    conn.lastSyncStatus === 'ok'
      ? 'bg-emerald-900/60 text-emerald-300'
      : conn.lastSyncStatus === 'error'
      ? 'bg-rose-900/60 text-rose-300'
      : 'bg-slate-800 text-slate-300';

  const enabledColor = conn.isEnabled
    ? 'bg-emerald-900/60 text-emerald-300'
    : 'bg-slate-800 text-slate-400';

  return (
    <tr className="bg-slate-950/80 hover:bg-slate-900/80 transition-colors">
      <td className="px-2 py-1.5 text-slate-100 whitespace-nowrap">
        <div className="flex flex-col">
          <span>{conn.name}</span>
          {conn.description && (
            <span className="text-[10px] text-slate-500 truncate max-w-[220px]">
              {conn.description}
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-1.5 text-slate-300 whitespace-nowrap">
        {KIND_LABEL[conn.kind]}
      </td>
      <td className="px-2 py-1.5 text-slate-300 whitespace-nowrap">
        {channelName}
      </td>
      <td className="px-2 py-1.5 whitespace-nowrap">
        <div className="flex flex-col gap-0.5">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] ${enabledColor}`}
          >
            {conn.isEnabled ? 'Включено' : 'Выключено'}
          </span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] ${statusColor}`}
          >
            {statusBase}
          </span>
        </div>
      </td>
      <td className="px-2 py-1.5 text-slate-300 whitespace-nowrap">
        <div className="flex flex-col">
          <span>{lastSync}</span>
          {conn.lastError && (
            <span className="text-[10px] text-rose-300 truncate max-w-[220px]">
              Ошибка: {conn.lastError}
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-1.5 text-right text-slate-200 whitespace-nowrap">
        {conn.totalSalesCount.toLocaleString('ru-RU')}
      </td>
      <td className="px-2 py-1.5 text-right text-slate-200 whitespace-nowrap">
        {conn.totalSalesAmount.toLocaleString('ru-RU', {
          maximumFractionDigits: 0,
        })}{' '}
        <span className="text-slate-400 text-[10px]">
          {conn.currency}
        </span>
      </td>
      <td className="px-2 py-1.5 whitespace-nowrap">
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={onTest}
            disabled={testing || deleting}
            className="px-2 py-0.5 rounded-lg text-[10px] border border-slate-700/80 text-slate-200 bg-slate-950/80 hover:bg-slate-900/80 disabled:opacity-50"
          >
            {testing ? 'Тест…' : 'Проверить'}
          </button>
          <button
            type="button"
            onClick={onSync}
            disabled={syncing || deleting}
            className="px-2 py-0.5 rounded-lg text-[10px] border border-slate-700/80 text-slate-200 bg-slate-950/80 hover:bg-slate-900/80 disabled:opacity-50"
          >
            {syncing ? 'Синк…' : 'Синхронизировать'}
          </button>
          <button
            type="button"
            onClick={onToggle}
            disabled={saving || deleting}
            className="px-2 py-0.5 rounded-lg text-[10px] border border-slate-700/80 text-slate-200 bg-slate-950/80 hover:bg-slate-900/80 disabled:opacity-50"
          >
            {conn.isEnabled ? 'Выключить' : 'Включить'}
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={deleting}
            className="px-2 py-0.5 rounded-lg text-[10px] border border-slate-700/80 text-slate-200 bg-slate-950/80 hover:bg-slate-900/80 disabled:opacity-50"
          >
            Редактировать
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="px-2 py-0.5 rounded-lg text-[10px] border border-rose-700/80 text-rose-300 bg-rose-950/40 hover:bg-rose-900/50 disabled:opacity-50"
          >
            {deleting ? 'Удаляем…' : 'Удалить'}
          </button>
        </div>
      </td>
    </tr>
  );
};