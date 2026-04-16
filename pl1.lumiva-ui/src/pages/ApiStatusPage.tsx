import React, { useEffect, useMemo, useState } from "react";
import { fetchAllLogs, fetchTenants, fetchPlatformSites } from "../api/tenants";
import type { TenantLog, TenantSummary, PlatformSite } from "../api/tenants";
import { getApiErrorMessage } from "../api/client";

type ApiStat = {
  key: string;
  method: string;
  path: string;
  total: number;
  success: number;
  errors: number;
  lastStatus?: number | null;
  lastMessage?: string | null;
  lastAt?: string;
  tenants: Set<string>;
};

const normalizePath = (path?: string | null) => {
  if (!path) return "/unknown";
  return path
    .toLowerCase()
    // заменяем UUID
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ":id")
    // заменяем числа
    .replace(/\/\d+(\b|\/)/g, "/:id$1")
    // убираем завершающие слэши
    .replace(/\/+$/, "") || "/unknown";
};

const statusColor = (item: ApiStat) => {
  if (item.errors > 0 && item.errors / item.total >= 0.3) return "bg-rose-500/20 text-rose-200 border-rose-500/40";
  if (item.errors > 0) return "bg-amber-500/20 text-amber-200 border-amber-500/40";
  return "bg-emerald-500/15 text-emerald-200 border-emerald-500/40";
};

const ApiStatusPage: React.FC = () => {
  const [logs, setLogs] = useState<TenantLog[]>([]);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [sites, setSites] = useState<PlatformSite[]>([]);
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [selectedSite, setSelectedSite] = useState<PlatformSite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [logsData, tenantsData, sitesData] = await Promise.all([
        fetchAllLogs({ limit: 800 }),
        fetchTenants(),
        fetchPlatformSites(),
      ]);
      setLogs(logsData);
      setTenants(tenantsData);
      setSites(sitesData);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const tenantMap = useMemo(() => {
    const m = new Map<string, TenantSummary>();
    tenants.forEach((t) => m.set(t.id, t));
    return m;
  }, [tenants]);

  const sitesFiltered = useMemo(() => {
    const filtered = tenantFilter === "all"
      ? sites
      : sites.filter((s) => s.tenantId === tenantFilter);
    // на фронте тоже уберём дубликаты по домену/тенанту (подстраховка)
    const uniq = new Map<string, PlatformSite>();
    filtered.forEach((s) => {
      const key = `${s.tenantId}|${s.domain.toLowerCase()}`;
      if (!uniq.has(key)) uniq.set(key, s);
    });
    return Array.from(uniq.values());
  }, [sites, tenantFilter]);

  const stats = useMemo(() => {
    const map = new Map<string, ApiStat>();
    logs.forEach((log) => {
      const method = (log.method || "ANY").toUpperCase();
      const path = normalizePath(log.path);
      const key = `${method} ${path}`;
      const status = log.statusCode ?? null;

      if (!map.has(key)) {
        map.set(key, {
          key,
          method,
          path,
          total: 0,
          success: 0,
          errors: 0,
          lastStatus: null,
          lastMessage: null,
          lastAt: undefined,
          tenants: new Set(),
        });
      }

      const item = map.get(key)!;
      item.total += 1;
      if (status && status >= 400) {
        item.errors += 1;
      } else {
        item.success += 1;
      }
      item.lastStatus = status;
      item.lastMessage = log.message ?? item.lastMessage;
      item.lastAt = log.createdAt;
      if (log.tenantId) item.tenants.add(log.tenantId);
    });

    const arr = Array.from(map.values());
    // сортируем: сначала по ошибкам, потом по общему трафику
    arr.sort((a, b) => {
      const errRateA = a.errors / Math.max(a.total, 1);
      const errRateB = b.errors / Math.max(b.total, 1);
      if (errRateA !== errRateB) return errRateB - errRateA;
      return b.total - a.total;
    });
    return arr;
  }, [logs]);

  const maxLoad = stats.reduce((max, s) => Math.max(max, s.total), 1);

  const maskToken = (token: string) => {
    if (!token) return "";
    const last = token.slice(-4);
    return `****${last}`;
  };

  const siteLogs = useMemo(() => {
    if (!selectedSite) return [];
    return logs
      .filter((l) => l.tenantId === selectedSite.tenantId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 10);
  }, [logs, selectedSite]);

  const sitesOfTenant = useMemo(() => {
    if (!selectedSite) return [];
    return sites.filter((s) => s.tenantId === selectedSite.tenantId);
  }, [sites, selectedSite]);

  const integrationsOfTenant = useMemo(() => {
    if (!selectedSite) return [];
    return (
      sites.find((s) => s.tenantId === selectedSite.tenantId)?.integrations ||
      []
    );
  }, [sites, selectedSite]);

  // Блокируем скролл подложки, когда открыта модалка
  useEffect(() => {
    if (selectedSite) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [selectedSite]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
            Сводка API
          </p>
          <h1 className="text-xl font-semibold text-slate-50">
            Список рабочих и проблемных API по платформе
          </h1>
          <p className="text-sm text-slate-400">
            На основе последних {logs.length || 0} событий логов. Показываем статус, нагрузку и какие тенанты используют эндпоинт.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="text-[12px] text-slate-300">
            <label className="block text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-1">
              Тенант
            </label>
            <select
              value={tenantFilter}
              onChange={(e) => setTenantFilter(e.target.value)}
              className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-600"
            >
              <option value="all">Все тенанты</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.clientKey || t.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={load}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:border-slate-500 transition-colors"
            disabled={loading}
          >
            {loading ? "Обновляем..." : "Обновить"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-700/50 bg-rose-900/30 px-4 py-3 text-sm text-rose-50">
          {error}
        </div>
      )}

      <div className="rounded-3xl border border-slate-800 bg-slate-950/70 backdrop-blur-lg p-4 md:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="grid grid-cols-[1fr,120px,120px,140px] gap-3 px-2 py-2 text-xs uppercase tracking-wide text-slate-500">
          <span>Эндпоинт</span>
          <span className="text-right">Нагрузка</span>
          <span className="text-right">Ошибки</span>
          <span className="text-right">Тенанты</span>
        </div>
        <div className="divide-y divide-slate-800/80">
          {stats.map((item) => {
            const loadPct = Math.min(
              100,
              Math.round((item.total / maxLoad) * 100),
            );
            const errorRate = item.errors / Math.max(item.total, 1);
            const statusCls = statusColor(item);
            const tenantNames = Array.from(item.tenants)
              .map((id) => tenantMap.get(id)?.clientKey || "tenant")
              .slice(0, 3);

            return (
              <div
                key={item.key}
                className="grid grid-cols-[1fr,120px,120px,140px] gap-3 px-2 py-3 md:py-4 text-sm items-center"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium ${statusCls}`}
                    >
                      {item.errors > 0
                        ? errorRate >= 0.3
                          ? "Проблемы"
                          : "Есть ошибки"
                        : "Работает"}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {item.lastStatus ? `${item.lastStatus}` : "—"} ·{" "}
                      {item.lastAt
                        ? new Date(item.lastAt).toLocaleString()
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-50 font-semibold">
                    <span className="rounded-lg bg-slate-800 px-2 py-1 text-[11px] uppercase tracking-wide text-slate-100">
                      {item.method}
                    </span>
                    <span className="truncate">{item.path}</span>
                  </div>
                  {item.lastMessage && (
                    <div className="text-[12px] text-slate-500 line-clamp-1">
                      {item.lastMessage}
                    </div>
                  )}
                </div>

                <div className="text-right text-slate-100 font-medium">
                  {item.total} req
                  <div className="mt-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-sky-400"
                      style={{ width: `${loadPct}%` }}
                    />
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-slate-100 font-medium">
                    {item.errors} ({Math.round(errorRate * 100)}%)
                  </div>
                  <div className="text-[12px] text-slate-500">
                    Успешно: {item.success}
                  </div>
                </div>

                <div className="text-right text-[12px] text-slate-300">
                  {item.tenants.size === 0 && "—"}
                  {item.tenants.size > 0 && (
                    <>
                      {tenantNames.join(", ")}
                      {item.tenants.size > tenantNames.length
                        ? ` и ещё ${item.tenants.size - tenantNames.length}`
                        : ""}
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {stats.length === 0 && !loading && (
            <div className="px-2 py-6 text-center text-slate-500">
              Нет данных по логам. Попробуйте обновить или дождаться активности.
            </div>
          )}
        </div>

        {loading && (
          <div className="px-2 py-6 text-center text-slate-400">
            Загружаем логи...
          </div>
        )}
      </div>

      {/* Модалка с деталями сайта/API */}
      {selectedSite && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)] space-y-4">
              <div className="flex items-start justify-between gap-3 sticky top-0 bg-slate-950 pb-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                    Детали API
                  </p>
                  <h3 className="text-xl font-semibold text-slate-50">
                    {selectedSite.name || selectedSite.domain}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {selectedSite.domain}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSite(null)}
                  className="rounded-xl border border-slate-700 px-3 py-2 text-[12px] text-slate-100 hover:border-slate-500 transition-colors"
                >
                  Закрыть
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-2">
                  <div className="text-[12px] text-slate-500">
                    API токен (masked)
                  </div>
                  <div className="font-mono text-slate-50">
                    {maskToken(selectedSite.apiTokenMasked)}
                  </div>
                  <div className="text-[12px] text-slate-500">
                    Создан: {new Date(selectedSite.createdAt).toLocaleString()}
                  </div>
                  <div className="text-[12px] text-slate-500">
                    Обновлён: {new Date(selectedSite.updatedAt).toLocaleString()}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
                  <div className="text-[12px] text-slate-500">Тенант</div>
                  <div className="text-slate-50 font-semibold">
                    {selectedSite.tenantClientKey || "—"}
                  </div>
                  <div className="text-[12px] text-slate-500 line-clamp-1">
                    {selectedSite.tenantName || "Без названия"}
                  </div>
                  <div className="text-[12px] text-slate-500">
                    Сайтов у тенанта: {selectedSite.sitesPerTenant ?? 1}
                  </div>
                  <div className="text-[12px] text-slate-500">
                    Статус:{" "}
                    <span
                      className={
                        selectedSite.status === "active"
                          ? "text-emerald-300"
                          : "text-slate-300"
                      }
                    >
                      {selectedSite.status}
                    </span>
                  </div>
                  {sitesOfTenant.length > 0 && (
                    <div className="text-[12px] text-slate-500 space-y-1">
                      <div className="uppercase tracking-[0.14em] text-slate-400">
                        Сайты тенанта
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {sitesOfTenant.map((s) => (
                          <span
                            key={s.id}
                            className="rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-[11px] text-slate-200"
                          >
                            {s.domain}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                    Последние обращения
                    </p>
                    <p className="text-sm text-slate-400">
                      Логи по тенанту этого сайта (до 10 последних).
                    </p>
                  </div>
                  <div className="text-xs text-slate-500">
                    Всего в выборке: {siteLogs.length}
                </div>
              </div>
              {integrationsOfTenant.length > 0 && (
                <div className="mb-4 text-[12px] text-slate-400">
                  <div className="uppercase tracking-[0.2em] text-slate-500 mb-1">
                    Интеграции
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {integrationsOfTenant.map((i) => (
                      <span
                        key={i.id}
                        className="rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-[11px] text-slate-200"
                        title={i.description || i.name}
                      >
                        {i.kind} · {i.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {siteLogs.length === 0 && (
                <div className="text-slate-500 text-sm">Нет логов.</div>
              )}
                <div className="space-y-2">
                  {siteLogs.map((l) => (
                    <div
                      key={l.id}
                      className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-[13px]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-[12px]">
                          <span className="rounded-md bg-slate-800 px-2 py-1 uppercase tracking-wide text-slate-200">
                            {l.method || "REQ"}
                          </span>
                          <span className="text-slate-100">
                            {l.path || "—"}
                          </span>
                        </div>
                        <div className="text-right text-[12px] text-slate-500">
                          {new Date(l.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[12px] text-slate-400">
                        <span>Код: {l.statusCode ?? "—"}</span>
                        <span className="line-clamp-1">
                          {l.message || "Без сообщения"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Список всех API/сайтов с маскировкой токенов */}
      <div className="rounded-3xl border border-slate-800 bg-slate-950/80 backdrop-blur-lg p-4 md:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Все API ключи и сайты
            </p>
            <p className="text-sm text-slate-400">
              Показаны все интеграции. Токены маскированы, отображаем только последние 4 символа.
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            Всего сайтов: {sitesFiltered.length}
          </div>
        </div>

        <div className="grid grid-cols-[1.3fr,1fr,0.8fr,0.8fr,1fr] gap-3 px-2 py-2 text-[11px] uppercase tracking-wide text-slate-500">
          <span>Сайт / домен</span>
          <span>API (masked)</span>
          <span className="text-right">Статус</span>
          <span className="text-right">Сайты у тенанта</span>
          <span className="text-right">Тенант</span>
        </div>
        <div className="divide-y divide-slate-800/80">
          {sitesFiltered.map((site) => (
            <div
              key={site.id}
              className="grid grid-cols-[1.3fr,1fr,0.8fr,0.8fr,1fr] gap-3 px-2 py-3 items-center text-sm"
            >
              <div className="space-y-1">
                <div className="text-slate-50 font-medium">{site.name || site.domain}</div>
                <div className="text-[12px] text-slate-500">{site.domain}</div>
              </div>
              <div className="text-slate-50 font-mono text-[13px]">
                {maskToken(site.apiTokenMasked)}
              </div>
              <div className="text-right">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] ${
                    site.status === "active"
                      ? "bg-emerald-500/20 text-emerald-100 border border-emerald-500/30"
                      : "bg-slate-700/40 text-slate-200 border border-slate-600"
                  }`}
                >
                  {site.status === "active" ? "Активен" : "Выключен"}
                </span>
              </div>
              <div className="text-right text-slate-200 font-medium">
                {site.sitesPerTenant ?? 1}
              </div>
              <div className="text-right text-slate-200">
                <div className="font-medium">{site.tenantClientKey || "—"}</div>
                <div className="text-[12px] text-slate-500 line-clamp-1">
                  {site.tenantName || "Без названия"}
                </div>
              </div>
              <div className="col-span-5 text-right">
                <button
                  onClick={() => setSelectedSite(site)}
                  className="inline-flex items-center rounded-xl border border-slate-700 px-3 py-2 text-[12px] text-slate-100 hover:border-slate-500 transition-colors"
                >
                  Детали
                </button>
              </div>
            </div>
          ))}
          {sites.length === 0 && !loading && (
            <div className="px-2 py-6 text-center text-slate-500">
              Нет данных по API / сайтам.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApiStatusPage;
