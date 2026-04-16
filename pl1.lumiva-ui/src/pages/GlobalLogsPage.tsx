// src/pages/GlobalLogsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  fetchAllLogs,
  fetchTenants,
  type TenantLog,
  type TenantSummary,
  pruneResetTokens,
} from "../api/tenants";
import { getApiErrorMessage } from "../api/client";

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const GlobalLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<TenantLog[]>([]);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "errors">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "2xx" | "4xx" | "5xx">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [pruneLoading, setPruneLoading] = useState(false);

  /** Быстрый фильтр по путям маркетинга / API (подстрока в path/type/message). */
  const LOG_PRESETS: { label: string; q: string }[] = [
    { label: "Маркетинг", q: "/marketing" },
    { label: "Трафик / импорт", q: "traffic" },
    { label: "Интеграции", q: "integration" },
    { label: "Синк / sync", q: "sync" },
  ];

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [logsData, tenantsData] = await Promise.all([
        fetchAllLogs({ limit: 500 }),
        fetchTenants(),
      ]);
      setLogs(logsData);
      setTenants(tenantsData);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const tenantsMap = useMemo(() => {
    const map = new Map<string, TenantSummary>();
    tenants.forEach((t) => map.set(t.id, t));
    return map;
  }, [tenants]);

  const filtered = useMemo(() => {
    return logs
      .filter((log) => {
        if (
          typeFilter === "errors" &&
          !(
            (log.statusCode && log.statusCode >= 400) ||
            log.type.toLowerCase().includes("error") ||
            log.type.toLowerCase().includes("denied")
          )
        ) {
          return false;
        }
        if (statusFilter !== "all") {
          const code = log.statusCode || 0;
          if (statusFilter === "2xx" && (code < 200 || code >= 300)) return false;
          if (statusFilter === "4xx" && (code < 400 || code >= 500)) return false;
          if (statusFilter === "5xx" && code < 500) return false;
        }
        if (tenantFilter !== "all" && log.tenantId !== tenantFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          return (
            log.type.toLowerCase().includes(q) ||
            (log.path || "").toLowerCase().includes(q) ||
            (log.message || "").toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [logs, typeFilter, statusFilter, tenantFilter, search]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const exportJson = () => {
    if (!filtered.length) return;
    const blob = new Blob([JSON.stringify(filtered, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = "tenant-logs.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    if (!filtered.length) return;
    const headers = [
      "tenantId",
      "type",
      "statusCode",
      "method",
      "path",
      "message",
      "createdAt",
      "meta",
    ];
    const csv = [
      headers.join(","),
      ...filtered.map((log) =>
        headers
          .map((h) => {
            const value =
              h === "meta" ? JSON.stringify(log.meta ?? {}) : (log as any)[h];
            const safe = String(value ?? "").replace(/"/g, '""');
            return `"${safe}"`;
          })
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = "tenant-logs.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrune = async () => {
    setPruneLoading(true);
    try {
      await pruneResetTokens();
      alert("Очистка токенов сброса запущена.");
    } catch (err) {
      alert("Не удалось очистить токены: " + getApiErrorMessage(err));
    } finally {
      setPruneLoading(false);
    }
  };

  return (
    <div className="pl1-page space-y-4 md:space-y-5">
      <div className="pl1-card p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Глобальные логи
            </div>
            <h1 className="text-2xl font-semibold text-slate-50">
              Последние события по всем тенантам
            </h1>
            <p className="text-sm text-slate-400">
              Фильтр по тенанту, типу, статусу и пути. По умолчанию последние
              500 записей со всех тенантов — в том числе маркетинг и API.
            </p>
          </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="pl1-btn-outline px-4 py-[9px] text-sm"
            onClick={() => void load()}
              disabled={loading}
            >
              {loading ? "Обновляем…" : "Обновить"}
            </button>
            <button
              type="button"
              className="pl1-btn-outline px-4 py-[9px] text-sm"
              onClick={exportCsv}
              disabled={!filtered.length}
            >
            CSV
          </button>
          <button
            type="button"
            className="pl1-btn-outline px-4 py-[9px] text-sm"
            onClick={exportJson}
            disabled={!filtered.length}
          >
            JSON
          </button>
          <button
            type="button"
            className="pl1-btn-outline px-4 py-[9px] text-sm"
            onClick={() => void handlePrune()}
            disabled={pruneLoading}
          >
            {pruneLoading ? "Чистим…" : "Очистить токены"}
          </button>
        </div>
      </div>

        {error && (
          <div className="pl1-alert pl1-alert-error mt-3">
            <span className="pl1-alert-badge">ERROR</span>
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="pl1-card p-5 md:p-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="pl1-select"
            value={tenantFilter}
            onChange={(e) => {
              setTenantFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Все тенанты</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            className="pl1-select"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as any);
              setPage(1);
            }}
          >
            <option value="all">Все типы</option>
            <option value="errors">Только ошибки</option>
          </select>
          <select
            className="pl1-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setPage(1);
            }}
          >
            <option value="all">Коды все</option>
            <option value="2xx">2xx</option>
            <option value="4xx">4xx</option>
            <option value="5xx">5xx</option>
          </select>
          <input
            className="pl1-input"
            placeholder="Поиск по типу/пути/сообщению"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ minWidth: 240 }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span className="text-slate-500">Быстро:</span>
          {LOG_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="rounded-full border border-slate-700/80 bg-slate-900/50 px-3 py-1 text-slate-200 hover:bg-slate-800/80"
              onClick={() => {
                setSearch(p.q);
                setTypeFilter("all");
                setPage(1);
              }}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            className="rounded-full border border-slate-700/60 px-3 py-1 text-slate-400 hover:text-slate-200"
            onClick={() => {
              setSearch("");
              setPage(1);
            }}
          >
            Сбросить поиск
          </button>
        </div>

        <div className="space-y-2">
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse h-12 rounded-xl bg-slate-900/70 border border-slate-800/80"
              />
            ))}

          {!loading &&
            paginated.map((log) => {
              const tenant = tenantsMap.get(log.tenantId);
              return (
                <div
                  key={log.id}
                  className="rounded-xl border border-slate-800/80 bg-slate-900/60 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                      <span className="rounded-full border border-slate-700/80 bg-slate-800/80 px-2 py-1">
                        {log.type}
                      </span>
                      {log.statusCode !== null &&
                        log.statusCode !== undefined && (
                          <span
                            className={`rounded-full border px-2 py-1 ${
                              log.statusCode >= 500
                                ? "border-rose-500/60 bg-rose-500/10 text-rose-100"
                                : log.statusCode >= 400
                                  ? "border-amber-500/60 bg-amber-500/10 text-amber-100"
                                  : "border-slate-700/80 bg-slate-800/80 text-slate-200"
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
                    <div className="text-sm text-slate-200">
                      {log.message || "—"}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Тенант: {tenant?.name || log.tenantId}
                    </div>
                    {log.meta && (
                      <div className="text-[11px] text-slate-500 mt-1 break-all">
                        {JSON.stringify(log.meta)}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 text-right">
                    {formatDateTime(log.createdAt)}
                  </div>
                </div>
              );
            })}

          {!loading && paginated.length === 0 && (
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 text-sm text-slate-400">
              Нет логов по выбранным фильтрам.
            </div>
          )}
        </div>

        {!loading && filtered.length > pageSize && (
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
            <div>
              Показано {(page - 1) * pageSize + 1}-
              {Math.min(page * pageSize, filtered.length)} из {filtered.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="pl1-btn-outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Назад
              </button>
              <span>
                Стр. {page} / {Math.ceil(filtered.length / pageSize)}
              </span>
              <button
                type="button"
                className="pl1-btn-outline"
                onClick={() =>
                  setPage((p) =>
                    p >= Math.ceil(filtered.length / pageSize) ? p : p + 1,
                  )
                }
                disabled={page >= Math.ceil(filtered.length / pageSize)}
              >
                Вперёд
              </button>
              <select
                className="pl1-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[25, 50, 100, 200].map((n) => (
                  <option key={n} value={n}>
                    {n} на стр.
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalLogsPage;
