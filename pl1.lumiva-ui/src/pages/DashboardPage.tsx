// src/pages/DashboardPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { fetchTenants, type TenantPlan, type TenantSummary, fetchAllLogs, type TenantLog } from "../api/tenants";
import { apiClient, getApiErrorMessage } from "../api/client";

type PlanKey = TenantPlan | "none";

const planTitles: Record<PlanKey, string> = {
  free_locked: "Free Locked",
  standard: "Standard",
  professional: "Professional",
  enterprise: "Enterprise",
  ultimate: "Ultimate",
  none: "Без плана",
};

const DashboardPage: React.FC = () => {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [health, setHealth] = useState<{
    ok: boolean | null;
    latency: number | null;
    endpoint?: string;
    payload?: any;
  }>({ ok: null, latency: null, endpoint: undefined });
  const [healthError, setHealthError] = useState<string | null>(null);
  const [logs, setLogs] = useState<TenantLog[]>([]);
  const [logsLoading, setLogsLoading] = useState<boolean>(true);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTenants();
      setTenants(data);
      setSyncedAt(new Date());
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
    void pingHealth();
    void loadLogs();
  }, []);

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const data = await fetchAllLogs({ limit: 300 });
      setLogs(data);
    } catch (err) {
      setHealthError(getApiErrorMessage(err));
    } finally {
      setLogsLoading(false);
    }
  };

  const pingHealth = async () => {
    const candidates = ["/health", "/tenants"];
    for (const endpoint of candidates) {
      const started = performance.now();
      try {
        const res = await apiClient.get(endpoint);
        const latency = performance.now() - started;
        setHealth({ ok: true, latency, endpoint, payload: res.data });
        setHealthError(null);
        return;
      } catch (err) {
        // пробуем следующий
        setHealth({ ok: false, latency: null, endpoint });
        setHealthError(getApiErrorMessage(err));
      }
    }
  };

  const analytics = useMemo(() => {
    const total = tenants.length;
    const activeCount = tenants.filter((t) => t.status === "active").length;
    const blockedCount = tenants.filter((t) => t.status === "blocked").length;
    const apiEnabledCount = tenants.filter((t) => t.apiEnabled).length;

    const planBuckets: Record<PlanKey, number> = {
      free_locked: 0,
      standard: 0,
      professional: 0,
      enterprise: 0,
      ultimate: 0,
      none: 0,
    };

    tenants.forEach((t) => {
      const key: PlanKey = t.plan ?? "none";
      planBuckets[key] += 1;
    });

    const now = new Date();
    const soonExpiring = tenants
      .map((t) => ({
        ...t,
        activeDate: t.activeUntil ? new Date(t.activeUntil) : null,
      }))
      .filter(
        (t) =>
          t.activeDate &&
          !Number.isNaN(t.activeDate.getTime()) &&
          t.activeDate > now,
      )
      .sort(
        (a, b) =>
          (a.activeDate?.getTime() ?? 0) - (b.activeDate?.getTime() ?? 0),
      );

    const recent = [...tenants].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    return {
      total,
      activeCount,
      blockedCount,
      apiEnabledCount,
      planBuckets,
      soonExpiring,
      recent,
    };
  }, [tenants]);

  const formatDate = (iso?: string | null) => {
    if (!iso) return "—";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "short",
    });
  };

  const formatDateTime = (value: Date | string) => {
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderSkeletonRow = (key: string) => (
    <div
      key={key}
      className="animate-pulse rounded-xl bg-slate-900/70 border border-slate-800/80 h-14"
    />
  );

  const tenantsPreview = tenants.slice(0, 6);
  const upcoming = analytics.soonExpiring.slice(0, 4);
  const recent = analytics.recent.slice(0, 5);

  const errorStats = useMemo(() => {
    const lastDay = Date.now() - 24 * 60 * 60 * 1000;
    const recentLogs = logs.filter((l) => new Date(l.createdAt).getTime() >= lastDay);
    const total = recentLogs.length;
    const errors4xx = recentLogs.filter((l) => (l.statusCode ?? 0) >= 400 && (l.statusCode ?? 0) < 500).length;
    const errors5xx = recentLogs.filter((l) => (l.statusCode ?? 0) >= 500).length;
    const byTenant: Record<string, number> = {};
    recentLogs.forEach((l) => {
      if ((l.statusCode ?? 0) >= 400) {
        byTenant[l.tenantId] = (byTenant[l.tenantId] || 0) + 1;
      }
    });
    const topTenants = Object.entries(byTenant)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tenantId, count]) => ({ tenantId, count }));

    const latestErrors = recentLogs
      .filter((l) => (l.statusCode ?? 0) >= 400 || l.type.toLowerCase().includes("error"))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);

    return { total, errors4xx, errors5xx, topTenants, latestErrors };
  }, [logs]);

  return (
    <div className="pl1-page space-y-5 md:space-y-6">
      <div className="pl1-card relative overflow-hidden p-5 md:p-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-sky-500/20 blur-3xl" />
          <div className="absolute -left-20 bottom-[-40px] h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
        </div>
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
              Lumiva · platform control
            </div>
            <h2 className="text-2xl md:text-3xl font-semibold text-slate-50 leading-tight">
              Обзор платформы
            </h2>
            <p className="text-sm md:text-base text-slate-300 max-w-3xl">
              Дашборд по всем тенантам CRM: статус доступа к API, планы и
              ближайшие события. Все данные подтягиваются прямо из{" "}
              <span className="text-sky-300">crm.lumiva.agency</span>.
            </p>
            {syncedAt && (
              <div className="text-xs text-slate-500">
                Обновлено {formatDateTime(syncedAt)}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="pl1-btn-outline px-4 py-[9px] text-sm"
              onClick={() => void loadDashboard()}
              disabled={loading}
            >
              {loading ? "Обновляем…" : "Обновить"}
            </button>
            <Link
              to="/tenants"
              className="pl1-btn-primary px-4 py-[9px] text-sm text-center"
            >
              Открыть список тенантов
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="pl1-alert pl1-alert-error">
          <span className="pl1-alert-badge">ERROR</span>
          <span>{error}</span>
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="pl1-card p-4 md:p-5 flex flex-col gap-3">
          <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
            Компании
          </div>
          <div className="flex items-baseline gap-3">
            <div className="text-3xl font-semibold text-slate-50">
              {loading ? "…" : analytics.total}
            </div>
            <span className="text-[11px] rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-200 border border-emerald-500/30">
              Активных {loading ? "…" : analytics.activeCount}
            </span>
          </div>
          <div className="text-sm text-slate-400">
            Заблокировано: {loading ? "…" : analytics.blockedCount}
          </div>
        </div>

        <div className="pl1-card p-4 md:p-5 flex flex-col gap-3">
          <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
            API доступ
          </div>
          <div className="text-3xl font-semibold text-slate-50">
            {loading ? "…" : analytics.apiEnabledCount}
          </div>
          <div className="text-sm text-slate-400 flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-slate-900/80 overflow-hidden">
              <div
                className="h-full bg-sky-400"
                style={{
                  width: analytics.total
                    ? `${Math.round((analytics.apiEnabledCount / analytics.total) * 100)}%`
                    : "0%",
                }}
              />
            </div>
            <span className="text-xs text-slate-400">
              {analytics.total
                ? `${Math.round((analytics.apiEnabledCount / analytics.total) * 100)}%`
                : "0%"}
            </span>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                health.ok === null
                  ? "bg-slate-500"
                  : health.ok
                    ? "bg-emerald-400"
                    : "bg-rose-400"
              }`}
            />
            <span>
              API {health.ok === null ? "—" : health.ok ? "доступно" : "недоступно"}
              {health.latency !== null && (
                <> · {Math.round(health.latency)} мс</>
              )}
            </span>
            <button
              type="button"
              className="pl1-link-button"
              onClick={() => void pingHealth()}
            >
              Пинг
            </button>
          </div>
          {healthError && (
            <div className="text-[11px] text-rose-200">
              {healthError}
            </div>
          )}
        </div>

        <div className="pl1-card p-4 md:p-5 flex flex-col gap-3">
          <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
            Сроки действия
          </div>
          <div className="text-3xl font-semibold text-slate-50">
            {loading ? "…" : upcoming.length}
          </div>
          <div className="text-sm text-slate-400">
            {upcoming.length > 0
              ? `Ближайший до ${formatDate(upcoming[0].activeUntil)}`
              : "Скорых отключений нет"}
          </div>
        </div>

        <div className="pl1-card p-4 md:p-5 flex flex-col gap-3">
          <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
            Обновления
          </div>
          <div className="text-3xl font-semibold text-slate-50">
            {loading ? "…" : recent.length}
          </div>
          <div className="text-sm text-slate-400">
            {recent[0]
              ? `Последний апдейт: ${formatDate(recent[0].updatedAt)}`
              : "Нет изменений"}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="pl1-card p-5 md:p-6 xl:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Все тенанты
              </div>
              <h3 className="text-lg font-semibold text-slate-50 mt-1">
                Краткий список компаний
              </h3>
            </div>
            <Link className="pl1-link-button" to="/tenants">
              Перейти к таблице
            </Link>
          </div>

          <div className="space-y-3">
            {loading &&
              Array.from({ length: 4 }).map((_, idx) =>
                renderSkeletonRow(`skeleton-${idx}`),
              )}

            {!loading && tenantsPreview.length === 0 && (
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 text-sm text-slate-400">
                Тенантов пока нет. Создайте первую компанию, чтобы увидеть
                метрики и активность.
              </div>
            )}

            {!loading &&
              tenantsPreview.map((tenant) => (
                <div
                  key={tenant.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-900/60 px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-slate-800/80 text-slate-200 flex items-center justify-center text-sm font-semibold">
                      {tenant.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-50 truncate">
                        {tenant.name}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {tenant.clientKey}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px]">
                        <span
                          className={
                            tenant.status === "active"
                              ? "pl1-pill pl1-pill-green"
                              : "pl1-pill pl1-pill-red"
                          }
                        >
                          {tenant.status}
                        </span>
                        <span className="rounded-full border border-slate-700/80 bg-slate-800/80 px-2 py-1 text-slate-200">
                          План: {tenant.plan ?? "—"}
                        </span>
                        <span
                          className={`rounded-full px-2 py-1 border text-slate-200 ${
                            tenant.apiEnabled
                              ? "border-emerald-500/40 bg-emerald-500/10"
                              : "border-slate-700/80 bg-slate-800/80"
                          }`}
                        >
                          API {tenant.apiEnabled ? "включён" : "выключен"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <div>Активен до: {formatDate(tenant.activeUntil)}</div>
                    <div className="text-[11px] text-slate-500">
                      Обновлён {formatDate(tenant.updatedAt)}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="pl1-card p-5 md:p-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Тарифы
                </div>
                <h3 className="text-lg font-semibold text-slate-50 mt-1">
                  Распределение планов
                </h3>
              </div>
              <div className="text-xs text-slate-400">
                Всего: {analytics.total}
              </div>
            </div>
            <div className="space-y-3">
              {(Object.keys(planTitles) as PlanKey[]).map((plan) => (
                <div key={plan} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{planTitles[plan]}</span>
                    <span className="text-slate-400">
                      {analytics.planBuckets[plan]} / {analytics.total || 0}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-900/80 overflow-hidden">
                    <div
                      className={
                        plan === "ultimate"
                          ? "h-full bg-fuchsia-400"
                          : plan === "enterprise"
                            ? "h-full bg-violet-400"
                            : plan === "professional"
                              ? "h-full bg-indigo-400"
                              : plan === "standard"
                                ? "h-full bg-sky-400"
                                : plan === "free_locked"
                                  ? "h-full bg-rose-400"
                                  : "h-full bg-slate-600"
                      }
                      style={{
                        width: analytics.total
                          ? `${Math.round((analytics.planBuckets[plan] / analytics.total) * 100)}%`
                          : "0%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-slate-800/70 bg-slate-900/60 p-3 text-xs text-slate-400">
              API включён у {analytics.apiEnabledCount} из {analytics.total}{" "}
              тенантов. Проверьте блокировки и истекающие сроки, чтобы не терять
              интеграции.
            </div>
          </div>

          <div className="pl1-card p-5 md:p-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  События
                </div>
                <h3 className="text-lg font-semibold text-slate-50 mt-1">
                  Ближайшие отключения
                </h3>
              </div>
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-100">
                {upcoming.length} в очереди
              </span>
            </div>
            <div className="space-y-3">
              {loading &&
                Array.from({ length: 3 }).map((_, idx) =>
                  renderSkeletonRow(`upcoming-${idx}`),
                )}

              {!loading && upcoming.length === 0 && (
                <div className="rounded-lg border border-slate-800/70 bg-slate-900/60 p-3 text-sm text-slate-400">
                  Нет компаний с ближайшими датами окончания. Следующий чек
                  появится после обновления данных.
                </div>
              )}

              {!loading &&
                upcoming.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-slate-800/80 bg-slate-900/60 px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-50 truncate">
                          {t.name}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {t.clientKey}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-amber-200">
                          До {formatDate(t.activeUntil)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          План: {t.plan ?? "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="pl1-card p-5 md:p-6 lg:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Лента изменений
              </div>
              <h3 className="text-lg font-semibold text-slate-50 mt-1">
                Недавние обновления по тенантам
              </h3>
            </div>
          </div>

          <div className="space-y-2.5">
            {loading &&
              Array.from({ length: 4 }).map((_, idx) =>
                renderSkeletonRow(`recent-${idx}`),
              )}

            {!loading && recent.length === 0 && (
              <div className="rounded-lg border border-slate-800/70 bg-slate-900/60 p-3 text-sm text-slate-400">
                Пока нет изменений. Любые операции с тенантами появятся здесь.
              </div>
            )}

            {!loading &&
              recent.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-900/60 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-50 truncate">
                      {t.name}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {t.clientKey}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span
                      className={
                        t.status === "active"
                          ? "pl1-pill pl1-pill-green"
                          : "pl1-pill pl1-pill-red"
                      }
                    >
                      {t.status}
                    </span>
                    <span className="rounded-full border border-slate-700/80 bg-slate-800/80 px-2 py-1 text-slate-200">
                      {t.plan ?? "—"}
                    </span>
                    <span className="rounded-full border border-slate-700/80 bg-slate-800/80 px-2 py-1 text-slate-200">
                      {formatDate(t.updatedAt)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="pl1-card p-5 md:p-6">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">
            Срез состояния
          </div>
          <h3 className="text-lg font-semibold text-slate-50 mb-4">
            Краткие выводы
          </h3>
          <ul className="space-y-3 text-sm text-slate-300">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
              <div>
                Активных: {analytics.activeCount}. Следите за блокировками (
                {analytics.blockedCount}) и перезапускайте доступ вовремя.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-sky-400" />
              <div>
                API включён у {analytics.apiEnabledCount} компаний. Если нужно
                ограничить доступ — используйте переключатели на странице
                тенантов.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-amber-400" />
              <div>
                Сроки подписки: {upcoming.length > 0 ? "есть компании с близкими датами." : "ближайших отключений не видно."}{" "}
                Проверьте раздел выше.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-indigo-400" />
              <div>
                Распределение тарифов: Free Locked — {analytics.planBuckets.free_locked},
                Standard — {analytics.planBuckets.standard}, Professional — {analytics.planBuckets.professional},
                Enterprise — {analytics.planBuckets.enterprise}, Ultimate — {analytics.planBuckets.ultimate},
                без плана —{" "}
                {analytics.planBuckets.none}.
              </div>
            </li>
          </ul>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="pl1-card p-5 md:p-6 lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Ошибки API (24ч)
              </div>
              <h3 className="text-lg font-semibold text-slate-50 mt-1">
                Последние ошибки по тенантам
              </h3>
            </div>
            <div className="text-xs text-slate-400">
              4xx: {errorStats.errors4xx} · 5xx: {errorStats.errors5xx}
            </div>
          </div>

          {logsLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse h-12 rounded-xl bg-slate-900/70 border border-slate-800/80"
                />
              ))}
            </div>
          )}

          {!logsLoading && errorStats.latestErrors.length === 0 && (
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 text-sm text-slate-400">
              Нет ошибок за последние 24 часа.
            </div>
          )}

          {!logsLoading &&
            errorStats.latestErrors.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-slate-800/80 bg-slate-900/60 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="rounded-full border border-slate-700/80 bg-slate-800/80 px-2 py-1">
                    {log.type}
                  </span>
                  {log.statusCode !== null && log.statusCode !== undefined && (
                    <span
                      className={`rounded-full border px-2 py-1 ${
                        (log.statusCode ?? 0) >= 500
                          ? "border-rose-500/60 bg-rose-500/10 text-rose-100"
                          : "border-amber-500/60 bg-amber-500/10 text-amber-100"
                      }`}
                    >
                      {log.statusCode}
                    </span>
                  )}
                  {log.method && (
                    <span className="rounded-full border border-slate-700/80 bg-slate-800/80 px-2 py-1">
                      {log.method}
                    </span>
                  )}
                  {log.path && (
                    <span className="text-slate-500 truncate max-w-[220px] md:max-w-[320px]">
                      {log.path}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-sm text-slate-200">
                  {log.message || "—"}
                  {log.meta && (
                    <div className="text-xs text-slate-500 mt-1 break-all">
                      {JSON.stringify(log.meta)}
                    </div>
                  )}
                </div>
                <div className="text-xs text-slate-400 text-right">
                  {formatDateTime(log.createdAt)}
                </div>
              </div>
            ))}
        </div>

        <div className="pl1-card p-5 md:p-6 space-y-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
            Топ по ошибкам (24ч)
          </div>
          <h3 className="text-lg font-semibold text-slate-50">
            Тенанты с 4xx/5xx
          </h3>

          {logsLoading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse h-10 rounded-xl bg-slate-900/70 border border-slate-800/80"
                />
              ))}
            </div>
          )}

          {!logsLoading && errorStats.topTenants.length === 0 && (
            <div className="text-sm text-slate-400">Ошибок не было.</div>
          )}

          {!logsLoading &&
            errorStats.topTenants.map((item) => {
              const tenant = tenants.find((t) => t.id === item.tenantId);
              return (
                <div
                  key={item.tenantId}
                  className="rounded-xl border border-slate-800/80 bg-slate-900/60 px-3 py-2"
                >
                  <div className="flex items-center justify-between text-sm text-slate-200">
                    <span>{tenant?.name || item.tenantId}</span>
                    <span className="text-xs text-amber-200">{item.count} ошибок</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    clientKey: {tenant?.clientKey || "—"}
                  </div>
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
